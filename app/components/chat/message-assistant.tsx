import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import { textFromMessage } from "@/lib/chat-store/messages/api"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { cn } from "@/lib/utils"
import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { ArrowClockwise, Check, Copy } from "@phosphor-icons/react"
import { useCallback, useRef } from "react"
import { getSources } from "./get-sources"
import { QuoteButton } from "./quote-button"
import { SearchImages } from "./search-images"
import { SourcesList } from "./sources-list"
import { ToolInvocation } from "./tool-invocation"
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
  const reasoningPart = parts?.find(
    (part): part is { type: "reasoning"; text: string } => part.type === "reasoning"
  )
  const contentNullOrEmpty = children === null || children === ""
  const isLastStreaming = status === "streaming" && isLast
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
          "relative flex min-w-full flex-col gap-2",
          isLast && "pb-8"
        )}
        {...(isQuoteEnabled && { "data-message-id": messageId })}
      >
        {reasoningPart && reasoningPart.text && (
          <Reasoning isStreaming={status === "streaming"}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoningPart.text}</ReasoningContent>
          </Reasoning>
        )}

        {toolInvocationParts.length > 0 && preferences.showToolInvocations && (
          <ToolInvocation toolInvocations={toolInvocationParts} />
        )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults as never[]} />
        )}

        {contentNullOrEmpty ? null : (
          <MessageContent
            className={cn(
              "prose dark:prose-invert relative min-w-full bg-transparent p-0",
              "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
            )}
          >
            <MessageResponse>{children}</MessageResponse>
          </MessageContent>
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
