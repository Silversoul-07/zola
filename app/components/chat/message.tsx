import { textFromMessage } from "@/lib/chat-store/messages/api"
import type { UIMessage } from "ai"
import React, { useState } from "react"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"

type MessageProps = {
  variant: UIMessage["role"]
  id: string
  parts: UIMessage["parts"]
  isLast?: boolean
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => Promise<void> | void
  onReload: () => void
  hasScrollAnchor?: boolean
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  onQuote?: (text: string, messageId: string) => void
  messageGroupId?: string | null
  isUserAuthenticated?: boolean
}

export function Message({
  variant,
  id,
  parts,
  isLast,
  onEdit,
  onReload,
  hasScrollAnchor,
  status,
  className,
  onQuote,
  messageGroupId,
  isUserAuthenticated,
}: MessageProps) {
  const [copied, setCopied] = useState(false)
  const text = textFromMessage({ parts })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }

  if (variant === "user") {
    return (
      <MessageUser
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        onEdit={onEdit}
        id={id}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        className={className}
        messageGroupId={messageGroupId}
        isUserAuthenticated={isUserAuthenticated}
      />
    )
  }

  if (variant === "assistant") {
    return (
      <MessageAssistant
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        isLast={isLast}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        status={status}
        className={className}
        messageId={id}
        onQuote={onQuote}
      />
    )
  }

  return null
}
