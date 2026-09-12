import { canvasSystemPromptAddendum } from "@/lib/canvas/prompt"
import { maybeGenerateTitle } from "@/lib/title"
import { AGENTS, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import type { Attachment } from "@/lib/file-handling"
import { hermesRequest } from "@/lib/hermes/client"
import { hermesResponsesToUIMessageStream } from "@/lib/hermes/stream"
import { opencodeCreateSession, opencodeRequest } from "@/lib/opencode/client"
import { opencodeEventsToUIMessageStream } from "@/lib/opencode/stream"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai"
import { gte, and, eq, isNull } from "drizzle-orm"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: UIMessage[]
  chatId: string
  model: string
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  editCutoffTimestamp?: string
  /** When true, nothing about this turn is written to the database. */
  incognito?: boolean
  /** Header AgentPicker selection. Always a real agent id. */
  agentId?: string
  /** OpenCode agent mode picker (build/plan/...); ignored by other runtimes. */
  agentMode?: string
  /** Per-chat thinking effort picker ("auto"/"low"/"medium"/"high"); "auto" leaves the runtime default. */
  reasoningEffort?: string
  /** Set by the client when a canvas tab is active; triggers the ```canvas protocol addendum below. */
  canvasId?: string
  canvasTitle?: string
}

function textFromParts(message: UIMessage | undefined): string {
  if (!message) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function attachmentsFromParts(message: UIMessage | undefined): Attachment[] {
  if (!message) return []
  return message.parts
    .filter(
      (p): p is { type: "file"; mediaType: string; filename?: string; url: string } =>
        p.type === "file"
    )
    .map((p) => ({
      name: p.filename || "attachment",
      contentType: p.mediaType,
      url: p.url,
    }))
}

async function persistAssistantMessage({
  shouldPersist,
  chatId,
  message,
  message_group_id,
  model,
  userText,
}: {
  shouldPersist: boolean
  chatId: string
  message: UIMessage
  message_group_id?: string
  model: string
  userText?: string
}) {
  if (!shouldPersist) return
  const saved = await storeAssistantMessage({
    chatId,
    messages: [{ role: "assistant", parts: message.parts }],
    message_group_id,
    model,
  })
  if (!saved) return
  const assistantText = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  try {
    await maybeGenerateTitle({ chatId, userText: userText ?? "", assistantText })
  } catch (err) {
    console.error("Title generation failed:", err)
  }
}

// Drain a tee'd copy of the SSE stream server-side so the run (and its
// onFinish persistence) completes even when the browser navigates away
// mid-reply; the tee's other branch is what the client cancels.
const drain = ({ stream }: { stream: ReadableStream<string> }) =>
  stream.pipeTo(new WritableStream()).catch(() => {})

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })
    }
    const userId = user.id

    const {
      messages,
      chatId,
      model,
      systemPrompt,
      enableSearch,
      message_group_id,
      editCutoffTimestamp,
      incognito,
      agentId,
      agentMode,
      reasoningEffort,
      canvasId,
      canvasTitle,
    } = (await req.json()) as ChatRequest

    const effort =
      reasoningEffort && reasoningEffort !== "auto" ? reasoningEffort : undefined
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const lastUserText =
      lastUser?.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n") ?? ""

    if (!messages || !chatId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const shouldPersist = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated: true,
      incognito,
      agentId,
    })

    if (shouldPersist) {
      await incrementMessageCount({ userId })
    }

    // Stamp the chat with the agent it was started with (once), so reopening
    // it later shows the same agent regardless of the header preference at
    // that time (see .claude/docs/runtime-coverage.md item 4).
    if (shouldPersist && agentId) {
      await db
        .update(schema.chats)
        .set({ agentId })
        .where(and(eq(schema.chats.id, chatId), isNull(schema.chats.agentId)))
    }

    const userMessage = messages[messages.length - 1]

    // If editing, delete messages from cutoff BEFORE saving the new user message
    if (shouldPersist && editCutoffTimestamp) {
      try {
        await db
          .delete(schema.messages)
          .where(
            and(
              eq(schema.messages.chatId, chatId),
              gte(schema.messages.createdAt, new Date(editCutoffTimestamp))
            )
          )
      } catch (err) {
        console.error("Failed to delete messages from cutoff:", err)
      }
    }

    if (shouldPersist && userMessage?.role === "user") {
      await logUserMessage({
        userId,
        chatId,
        content: textFromParts(userMessage),
        attachments: attachmentsFromParts(userMessage),
        model,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    // Canvas protocol is always on so a first "write me a doc" request can
    // open a canvas; the title hint is added only while one is open.
    const effectiveSystemPrompt = `${systemPrompt || SYSTEM_PROMPT_DEFAULT}

${canvasSystemPromptAddendum(canvasId ? canvasTitle : undefined)}`

    const runtime = agentId
      ? AGENTS.find((a) => a.id === agentId)?.runtime ?? "hermes"
      : undefined

    // OpenCode is a coder agent (bash/edit/read/... tools) that runs its own
    // server-side session; we post the latest user turn to that session and
    // stream its event bus back, mapped to the UI message stream protocol.
    if (runtime === "opencode") {
      const [chatRow] = await db
        .select({
          title: schema.chats.title,
          runtimeSessionId: schema.chats.runtimeSessionId,
        })
        .from(schema.chats)
        .where(eq(schema.chats.id, chatId))

      let sessionId = chatRow?.runtimeSessionId ?? undefined
      if (!sessionId) {
        const session = await opencodeCreateSession(
          chatRow?.title ?? undefined
        )
        sessionId = session.id
        if (shouldPersist) {
          await db
            .update(schema.chats)
            .set({ runtimeSessionId: sessionId })
            .where(eq(schema.chats.id, chatId))
        }
      }

      const userText = textFromParts(userMessage)

      const eventStream = await opencodeRequest({
        sessionId,
        text: userText,
        model,
        agent: agentMode,
        system: canvasSystemPromptAddendum(canvasId ? canvasTitle : undefined),
        // opencode.json declares low/medium/high only; xhigh is Hermes-only.
        variant: effort === "xhigh" ? "high" : effort,
      })

      const stream = opencodeEventsToUIMessageStream(eventStream, {
        sessionId,
        onFinish: async ({ message }) =>
          persistAssistantMessage({
            shouldPersist,
            chatId,
            message,
            message_group_id,
            model,
            userText: lastUserText,
          }),
      })

      return createUIMessageStreamResponse({ stream, consumeSseStream: drain })
    }

    // Hermes Agent runs its own model + tools server-side on our VM; bypass
    // streamText entirely and stream its /v1/responses SSE straight through.
    // "hermes-agent" is sent through as-is: Hermes treats it as "use the
    // agent's own default", any other model id is a LiteLLM lane it also honours.
    if (agentId) {
      const hermesRes = await hermesRequest({
        messages,
        model,
        chatId,
        systemPrompt: effectiveSystemPrompt,
        modelOptions: effort ? { reasoning: { effort } } : undefined,
      })

      const stream = hermesResponsesToUIMessageStream(
        hermesRes.body as ReadableStream<Uint8Array>,
        {
          onFinish: async ({ message }) =>
            persistAssistantMessage({
              shouldPersist,
              chatId,
              message,
              message_group_id,
              model,
              userText: lastUserText,
            }),
        }
      )

      return createUIMessageStreamResponse({ stream, consumeSseStream: drain })
    }

    const { getEffectiveApiKey } = await import("@/lib/user-keys")
    const provider = getProviderForModel(model)
    const apiKey =
      (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
      undefined
    const apiSdk = modelConfig.apiSdk

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          model: apiSdk(apiKey, { enableSearch }),
          system: effectiveSystemPrompt,
          messages: await convertToModelMessages(messages),
          tools: {} as ToolSet,
          onError: (err: unknown) => {
            console.error("Streaming error occurred:", err)
          },
        })
        writer.merge(
          result.toUIMessageStream({ sendReasoning: true, sendSources: true })
        )
      },
      onFinish: async ({ responseMessage }) =>
        persistAssistantMessage({
          shouldPersist,
          chatId,
          message: responseMessage,
          message_group_id,
          model,
          userText: lastUserText,
        }),
      onError: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })

    return createUIMessageStreamResponse({ stream, consumeSseStream: drain })
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
