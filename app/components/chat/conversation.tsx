import {
  Conversation as ConversationRoot,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { useRef } from "react"
import { Loader } from "./loader"
import { Message } from "./message"

type ConversationProps = {
  messages: ZolaUIMessage[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  onQuote?: (text: string, messageId: string) => void
  isUserAuthenticated?: boolean
}

export function Conversation({
  messages,
  status = "ready",
  onDelete,
  onEdit,
  onReload,
  onQuote,
  isUserAuthenticated,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)

  if (!messages || messages.length === 0)
    return <div className="h-full w-full"></div>

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
        <div className="h-app-header bg-background flex w-full lg:hidden lg:h-0" />
        <div className="h-app-header bg-background flex w-full mask-b-from-4% mask-b-to-100% lg:hidden" />
      </div>
      <ConversationRoot className="relative w-full">
        <ConversationContent
          className="flex w-full flex-col items-center pt-20 pb-4"
          style={{
            scrollbarGutter: "stable both-edges",
            scrollbarWidth: "none",
          }}
        >
          {messages?.map((message, index) => {
            const isLast =
              index === messages.length - 1 && status !== "submitted"
            const hasScrollAnchor =
              isLast && messages.length > initialMessageCount.current

            return (
              <Message
                key={message.id}
                id={message.id}
                variant={message.role}
                parts={message.parts}
                isLast={isLast}
                onDelete={onDelete}
                onEdit={onEdit}
                onReload={onReload}
                hasScrollAnchor={hasScrollAnchor}
                status={status}
                onQuote={onQuote}
                messageGroupId={message.metadata?.message_group_id ?? null}
                isUserAuthenticated={isUserAuthenticated}
              />
            )
          })}
          {status === "submitted" &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "user" && (
              <div className="group min-h-scroll-anchor flex w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
                <Loader />
              </div>
            )}
        </ConversationContent>
        <div className="absolute bottom-0 flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-6 pb-2">
          <ConversationScrollButton className="absolute top-[-50px] right-[30px] bottom-auto left-auto translate-x-0" />
        </div>
      </ConversationRoot>
    </div>
  )
}
