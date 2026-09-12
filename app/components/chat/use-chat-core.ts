import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import type { Attachment } from "@/lib/file-handling"
import { getEffectiveAgentId } from "@/lib/config"
import { API_ROUTE_CHAT } from "@/lib/routes"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import type { UserProfile } from "@/lib/user/types"
import { DefaultChatTransport, type FileUIPart } from "ai"
import { useChat } from "@ai-sdk/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type UseChatCoreProps = {
  initialMessages: ZolaUIMessage[]
  draftValue: string
  cacheAndAddMessage: (message: ZolaUIMessage) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (
    uid: string,
    input: string,
    incognito?: boolean
  ) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
  incognito?: boolean
}

function attachmentsToFileParts(attachments?: Attachment[] | null): FileUIPart[] {
  if (!attachments?.length) return []
  return attachments.map((attachment) => ({
    type: "file",
    mediaType: attachment.contentType,
    filename: attachment.name,
    url: attachment.url,
  }))
}

function textPart(text: string) {
  return { type: "text" as const, text }
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  checkLimitsAndNotify,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
  incognito = false,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  // v5 useChat no longer owns input state; we manage it ourselves.
  const [input, setInput] = useState(draftValue)

  // Header AgentPicker selection (mirrors the default in agent-picker.tsx).
  const { preferences } = useUserPreferences()
  const agentId = getEffectiveAgentId(preferences.selectedAgentId)

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Chats operations
  const { updateTitle } = useChats()

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    console.error("Chat error:", error)
    console.error("Error message:", error.message)
    let errorMsg = error.message || "Something went wrong."

    if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
      errorMsg = "Something went wrong. Please try again."
    }

    toast({
      title: errorMsg,
      status: "error",
    })
  }, [])

  const transport = useMemo(
    () => new DefaultChatTransport({ api: API_ROUTE_CHAT }),
    []
  )

  // Initialize useChat
  const { messages, status, error, regenerate, stop, setMessages, sendMessage } =
    useChat<ZolaUIMessage>({
      messages: initialMessages,
      transport,
      onFinish: async ({ message }) => {
        cacheAndAddMessage(message)
        try {
          const effectiveChatId =
            chatId ||
            prevChatIdRef.current ||
            (typeof window !== "undefined"
              ? localStorage.getItem("guestChatId")
              : null)

          if (!effectiveChatId) return
          await syncRecentMessages(effectiveChatId, setMessages, 2)
        } catch (error) {
          console.error("Message ID reconciliation failed: ", error)
        }
      },
      onError: handleError,
    })

  // useChat v5+ reads `messages` only once; the provider loads history
  // (cache, then DB) after mount, so push each load into the chat state.
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return
    setMessages(initialMessages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages])

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Reset messages when navigating from a chat to home
  if (
    prevChatIdRef.current !== null &&
    chatId === null &&
    messages.length > 0
  ) {
    setMessages([])
  }
  prevChatIdRef.current = chatId

  // Submit action
  const submit = useCallback(async () => {
    setIsSubmitting(true)

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage: ZolaUIMessage = {
      id: optimisticId,
      role: "user",
      parts: [
        textPart(input),
        ...attachmentsToFileParts(optimisticAttachments),
      ],
      metadata: { createdAt: new Date().toISOString() },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    const submittedInput = input
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      const allowed = await checkLimitsAndNotify(uid)
      if (!allowed) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      const currentChatId = await ensureChatExists(uid, submittedInput, incognito)
      if (!currentChatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      prevChatIdRef.current = currentChatId

      if (submittedInput.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticAttachments)
        return
      }

      let attachments: Attachment[] | null = []
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(uid, currentChatId)
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          cleanupOptimisticAttachments(optimisticAttachments)
          return
        }
      }

      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)

      sendMessage(
        {
          text: submittedInput,
          files: attachmentsToFileParts(attachments),
        },
        {
          body: {
            chatId: currentChatId,
            userId: uid,
            model: selectedModel,
            isAuthenticated,
            systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
            enableSearch,
            incognito,
            agentId,
          },
        }
      )

      if (!incognito) {
        cacheAndAddMessage({
          ...optimisticMessage,
          parts: [
            textPart(submittedInput),
            ...attachmentsToFileParts(attachments),
          ],
        })
      }
      clearDraft()

      if (messages.length > 0 && !incognito) {
        bumpChat(currentChatId)
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticAttachments)
      toast({ title: "Failed to send message", status: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    user,
    files,
    createOptimisticAttachments,
    input,
    setMessages,
    setFiles,
    checkLimitsAndNotify,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    sendMessage,
    cacheAndAddMessage,
    clearDraft,
    messages.length,
    bumpChat,
    setIsSubmitting,
    incognito,
    agentId,
  ])

  const submitEdit = useCallback(
    async (messageId: string, newContent: string) => {
      // Block edits while sending/streaming
      if (isSubmitting || status === "submitted" || status === "streaming") {
        toast({
          title: "Please wait until the current message finishes sending.",
          status: "error",
        })
        return
      }

      if (!newContent.trim()) return

      if (!chatId) {
        toast({ title: "Missing chat.", status: "error" })
        return
      }

      // Find edited message
      const editIndex = messages.findIndex(
        (m) => String(m.id) === String(messageId)
      )
      if (editIndex === -1) {
        toast({ title: "Message not found", status: "error" })
        return
      }

      const target = messages[editIndex]
      const cutoffIso = target?.metadata?.createdAt
      if (!cutoffIso) {
        console.error("Unable to locate message timestamp.")
        return
      }

      if (newContent.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: "error",
        })
        return
      }

      // Store original messages for potential rollback
      const originalMessages = [...messages]
      const targetAttachments = target.parts.filter((p) => p.type === "file")

      const optimisticId = `optimistic-edit-${Date.now().toString()}`
      const optimisticEditedMessage: ZolaUIMessage = {
        id: optimisticId,
        role: "user",
        parts: [textPart(newContent), ...targetAttachments],
        metadata: { createdAt: new Date().toISOString() },
      }

      try {
        const trimmedMessages = messages.slice(0, editIndex)
        setMessages([...trimmedMessages, optimisticEditedMessage])

        try {
          const { writeToIndexedDB } = await import("@/lib/chat-store/persist")
          await writeToIndexedDB("messages", {
            id: chatId,
            messages: trimmedMessages,
          })
        } catch {}

        // Get user validation
        const uid = await getOrCreateGuestUserId(user)
        if (!uid) {
          setMessages(originalMessages)
          toast({ title: "Please sign in and try again.", status: "error" })
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages(originalMessages)
          return
        }

        const currentChatId = await ensureChatExists(uid, newContent)
        if (!currentChatId) {
          setMessages(originalMessages)
          return
        }

        prevChatIdRef.current = currentChatId

        // If this is an edit of the very first user message, update chat title
        if (editIndex === 0 && target.role === "user") {
          try {
            await updateTitle(currentChatId, newContent)
          } catch {}
        }

        sendMessage(
          {
            text: newContent,
            files: targetAttachments as FileUIPart[],
          },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
              enableSearch,
              incognito,
              agentId,
              editCutoffTimestamp: cutoffIso, // Backend will delete messages from this timestamp
            },
          }
        )

        bumpChat(currentChatId)
      } catch (error) {
        console.error("Edit failed:", error)
        setMessages(originalMessages)
        toast({ title: "Failed to apply edit", status: "error" })
      }
    },
    [
      chatId,
      messages,
      user,
      checkLimitsAndNotify,
      ensureChatExists,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      sendMessage,
      setMessages,
      bumpChat,
      updateTitle,
      isSubmitting,
      status,
      agentId,
      incognito,
    ]
  )

  // Handle suggestion
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)
      const optimisticId = `optimistic-${Date.now().toString()}`
      const optimisticMessage: ZolaUIMessage = {
        id: optimisticId,
        role: "user",
        parts: [textPart(suggestion)],
        metadata: { createdAt: new Date().toISOString() },
      }

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const uid = await getOrCreateGuestUserId(user)

        if (!uid) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        const allowed = await checkLimitsAndNotify(uid)
        if (!allowed) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          return
        }

        const currentChatId = await ensureChatExists(uid, suggestion)

        if (!currentChatId) {
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          return
        }

        prevChatIdRef.current = currentChatId

        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))

        sendMessage(
          { text: suggestion },
          {
            body: {
              chatId: currentChatId,
              userId: uid,
              model: selectedModel,
              isAuthenticated,
              systemPrompt: SYSTEM_PROMPT_DEFAULT,
              incognito,
              agentId,
            },
          }
        )
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        toast({ title: "Failed to send suggestion", status: "error" })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      ensureChatExists,
      selectedModel,
      user,
      sendMessage,
      checkLimitsAndNotify,
      isAuthenticated,
      setMessages,
      setIsSubmitting,
      incognito,
      agentId,
    ]
  )

  // Handle reload
  const handleReload = useCallback(async () => {
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return
    }

    regenerate({
      body: {
        chatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        incognito,
        agentId,
      },
    })
  }, [
    user,
    chatId,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    regenerate,
    incognito,
    agentId,
  ])

  // Handle input change
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      setDraftValue(value)
    },
    [setDraftValue]
  )

  return {
    // Chat state
    messages,
    input,
    status,
    error,
    stop,
    setMessages,
    setInput,
    sendMessage,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,
  }
}
