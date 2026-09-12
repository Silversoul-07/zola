import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { hermesRequest } from "@/lib/hermes/client"
import { hermesResponsesToDataStream } from "@/lib/hermes/stream"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, ToolSet } from "ai"
import { gte, and, eq } from "drizzle-orm"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  model: string
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  editCutoffTimestamp?: string
  /** When true, nothing about this turn is written to the database. */
  incognito?: boolean
  /** Header AgentPicker selection. "none"/unset routes straight to the model. */
  agentId?: string
}

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
    } = (await req.json()) as ChatRequest

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
        content: userMessage.content,
        attachments: userMessage.experimental_attachments as Attachment[],
        model,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    // Hermes Agent runs its own model + tools server-side on our VM; bypass
    // streamText entirely and stream its /v1/responses SSE straight through.
    // "hermes-agent" is sent through as-is: Hermes treats it as "use the
    // agent's own default", any other model id is a LiteLLM lane it also honours.
    if (agentId && agentId !== "none") {
      const hermesRes = await hermesRequest({
        messages,
        model,
        chatId,
        systemPrompt: effectiveSystemPrompt,
      })

      return new Response(
        hermesResponsesToDataStream(hermesRes.body as ReadableStream<Uint8Array>, {
          messageId: crypto.randomUUID(),
          onFinish: async ({ text, toolParts }) => {
            if (!shouldPersist) return
            await storeAssistantMessage({
              chatId,
              messages: [
                {
                  role: "assistant",
                  content: [
                    ...(text ? [{ type: "text", text }] : []),
                    ...toolParts,
                  ],
                },
              ],
              message_group_id,
              model,
            })
          },
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1",
          },
        }
      )
    }

    const { getEffectiveApiKey } = await import("@/lib/user-keys")
    const provider = getProviderForModel(model)
    const apiKey =
      (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
      undefined

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, { enableSearch }),
      system: effectiveSystemPrompt,
      messages: messages,
      tools: {} as ToolSet,
      maxSteps: 10,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        if (shouldPersist) {
          await storeAssistantMessage({
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
          })
        }
      },
    })

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })
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
