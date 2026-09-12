import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { textFromMessage } from "@/lib/chat-store/messages/api"
import { parseCanvasSegments } from "@/lib/canvas/parse"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { ArrowClockwise, Check, Copy, FileText } from "@phosphor-icons/react"
import { useCallback, useRef } from "react"
import { CanvasBlock } from "./canvas-block"
import { getSources } from "./get-sources"
import { Loader } from "./loader"
import type { OpencodePermissionData } from "./permission-card"
import { QuoteButton } from "./quote-button"
import { SearchImages } from "./search-images"
import { SourcesList } from "./sources-list"
import { segmentParts, WorkGroup } from "./work-group"
import { turnFromParts } from "@/lib/turn"
import { useAssistantMessageSelection } from "./useAssistantMessageSelection"

type MessageAssistantProps = {
  parts: UIMessage["parts"]
  isLast?: boolean
  hasScrollAnchor?: boolean
  copied?: boolean
  copyToClipboard?: () => void
  onReload?: () => void
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  messageId: string
  onQuote?: (text: string, messageId: string) => void
}

export function MessageAssistant({
  parts,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  status,
  className,
  messageId,
  onQuote,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences()
  const children = textFromMessage({ parts })
  const sources = getSources(parts)
  const toolInvocationParts = parts?.filter(isToolUIPart) ?? []
  const permissionParts =
    parts?.filter(
      (part): part is { type: "data-opencode-permission"; id?: string; data: OpencodePermissionData } =>
        part.type === "data-opencode-permission"
    ) ?? []
  const reasoningPart = parts?.find(
    (part): part is { type: "reasoning"; text: string } => part.type === "reasoning"
  )
  const runs = segmentParts(parts ?? [])
  const answerText = children
  const contentNullOrEmpty = answerText === null || answerText === ""
  const isLastStreaming = status === "streaming" && isLast
  const turn = turnFromParts(parts)
  const { chatId } = useChatSession()
  const { openCanvas } = useWorkspace()
  const handleOpenInCanvas = useCallback(async () => {
    if (!chatId || contentNullOrEmpty) return
    const res = await fetch("/api/cloud9/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title: "Untitled", content: answerText }),
    })
    if (!res.ok) return
    const canvas = await res.json()
    openCanvas(canvas.id, canvas.title, canvas.content)
  }, [chatId, contentNullOrEmpty, answerText, openCanvas])
  const searchImageResults =
    toolInvocationParts
      .filter(
        (part) =>
          getToolName(part) === "imageSearch" && part.state === "output-available"
      )
      .flatMap((part) => {
        const output = part.output as
          | { content?: Array<{ type: string; results?: unknown[] }> }
          | undefined
        const imagesContent = output?.content?.find((c) => c.type === "images")
        return imagesContent?.results ?? []
      }) ?? []
  const hasVisiblePart =
    Boolean(reasoningPart?.text) ||
    toolInvocationParts.length > 0 ||
    permissionParts.length > 0 ||
    searchImageResults.length > 0 ||
    !contentNullOrEmpty
  const showThinking =
    (status === "submitted" || status === "streaming") && !hasVisiblePart

  const isQuoteEnabled = !preferences.multiModelEnabled
  const messageRef = useRef<HTMLDivElement>(null)
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  )
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId)
      clearSelection()
    }
  }, [selectionInfo, onQuote, clearSelection])

  return (
    <Message
      from="assistant"
      className={cn(
        "group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
        hasScrollAnchor && "min-h-scroll-anchor",
        className
      )}
    >
      <div
        ref={messageRef}
        className={cn(
          "relative flex w-full min-w-0 max-w-full flex-col gap-2",
          isLast && "pb-8"
        )}
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {showThinking && <Loader />}

        {runs.map((run, i) =>
          run.kind === "work" ? (
            <WorkGroup
              key={i}
              parts={run.parts}
              streaming={Boolean(
                isLast &&
                  i === runs.length - 1 &&
                  (status === "streaming" || status === "submitted")
              )}
              timings={turn?.tools}
              showTools={preferences.showToolInvocations}
            />
          ) : (
            parseCanvasSegments(run.text).map((segment, j) =>
              segment.kind === "canvas" ? (
                <CanvasBlock
                  key={`${i}-${j}`}
                  title={segment.title}
                  content={segment.content}
                  complete={segment.complete}
                  streaming={Boolean(isLastStreaming)}
                />
              ) : segment.text.trim() ? (
                <MessageContent
                  key={`${i}-${j}`}
                  className={cn(
                    "prose dark:prose-invert relative w-full min-w-0 max-w-full bg-transparent p-0",
                    "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
                  )}
                >
                  <MessageResponse>{segment.text}</MessageResponse>
                </MessageContent>
              ) : null
            )
          )
        )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults as never[]} />
        )}

        {sources && sources.length > 0 && <SourcesList sources={sources} />}

        {Boolean(isLastStreaming || contentNullOrEmpty) ? null : (
          <MessageActions
            className={cn(
              "-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100"
            )}
          >
            <MessageAction
              tooltip={copied ? "Copied!" : "Copy text"}
              label="Copy text"
              className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </MessageAction>
            <MessageAction
              tooltip="Open in canvas"
              label="Open in canvas"
              className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
              onClick={handleOpenInCanvas}
            >
              <FileText className="size-4" />
            </MessageAction>
            {isLast ? (
              <MessageAction
                tooltip="Regenerate"
                label="Regenerate"
                className="hover:bg-accent/60 text-muted-foreground hover:text-foreground rounded-full bg-transparent"
                onClick={onReload}
              >
                <ArrowClockwise className="size-4" />
              </MessageAction>
            ) : null}
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            mousePosition={selectionInfo.position}
            onQuote={handleQuoteBtnClick}
            messageContainerRef={messageRef}
            onDismiss={clearSelection}
          />
        )}
      </div>
    </Message>
  )
}
