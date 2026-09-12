import { syncRecentMessages } from "@/app/components/chat/syncRecentMessages"
import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { useChats } from "@/lib/chat-store/chats/provider"
import type { ZolaUIMessage } from "@/lib/chat-store/messages/api"
import { AGENTS, MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
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
  /** This chat's stored agent (chats.agent_id), overrides the header preference for this chat only. */
  chatAgentId?: string | null
  /** The workspace pane's active canvas tab, if any — tells the agent which document it's editing. */
  activeCanvas?: { id: string; title: string } | null
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
  chatAgentId,
  activeCanvas,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(false)
  // v5 useChat no longer owns input state; we manage it ourselves.
  const [input, setInput] = useState(draftValue)

  // Header AgentPicker selection (mirrors the default in agent-picker.tsx).
  // A chat that was started with a given agent keeps that agent when
  // reopened, regardless of what the header preference has moved on to.
  const { preferences } = useUserPreferences()
  const agentId = chatAgentId || getEffectiveAgentId(preferences.selectedAgentId)
  const runtime = AGENTS.find((a) => a.id === agentId)?.runtime

  // OpenCode agent mode picker (build/plan/...); not persisted, resets to
  // "build" per session/chat (see .claude/docs/runtime-coverage.md item 2).
  const [agentMode, setAgentMode] = useState("build")

  // Per-chat thinking effort picker; persisted across chats/sessions.
  const [reasoningEffort, setReasoningEffortState] = useState(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("zola:reasoning-effort") ?? "auto")
      : "auto"
  )
  const setReasoningEffort = useCallback((value: string) => {
    setReasoningEffortState(value)
    if (typeof window !== "undefined") {
      localStorage.setItem("zola:reasoning-effort", value)
    }
  }, [])

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
  const { updateTitle, refresh: refreshChats } = useChats()

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
  const { messages, status, error, regenerate, stop: rawStop, setMessages, sendMessage } =
    useChat<ZolaUIMessage>({
      messages: initialMessages,
      transport,
      onFinish: async ({ message }) => {
        cacheAndAddMessage(message)
        // ponytail: the server generates the title after it persists the reply;
        // poll once instead of streaming a title event through the message.
        setTimeout(() => void refreshChats(), 3000)
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

  // Stop button: the fetch abort above doesn't reach OpenCode's own server-side
  // session (see .claude/docs/runtime-coverage.md item 1), so also call its
  // abort endpoint for OpenCode chats. Best-effort; the fetch abort already
  // stops the UI regardless of whether this call succeeds.
  const stop = useCallback(() => {
    rawStop()
    if (runtime === "opencode" && chatId) {
      fetch("/api/cloud9/opencode/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      }).catch(() => {})
    }
  }, [rawStop, runtime, chatId])

  // useChat v5+ reads `messages` only once; the provider loads history
  // (cache, then DB) after mount. Push a load into the chat state only when
  // the chat changed or the chat state is still empty. Replacing on every
  // provider update dropped the optimistic user message after a reply.
  const loadedChatIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return
    const chatChanged = loadedChatIdRef.current !== chatId
    // The provider loads the cache first (possibly stale: user turn only when
    // the user left mid-run) and the DB copy after; take any load that has
    // more messages than the live state.
    if (chatChanged || initialMessages.length > messages.length) {
      loadedChatIdRef.current = chatId
      setMessages(initialMessages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages, chatId])

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt])

  // Reset messages when navigating from a chat to home (in an effect:
  // calling setMessages during render triggers React's setState-in-render
  // warning under useChat v5+).
  useEffect(() => {
    if (prevChatIdRef.current !== null && chatId === null && messages.length > 0) {
      setMessages([])
    }
    prevChatIdRef.current = chatId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  // Submit action. `overrideText`, when passed, sends that text instead of the
  // composer's `input` state — used by the canvas selection prompt so it can
  // submit through the normal chat pipeline without going through the textbox.
  const submit = useCallback(async (overrideText?: string) => {
    setIsSubmitting(true)

    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      setIsSubmitting(false)
      return
    }

    const textToSend = overrideText ?? input
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : []

    const optimisticMessage: ZolaUIMessage = {
      id: optimisticId,
      role: "user",
      parts: [
        textPart(textToSend),
        ...attachmentsToFileParts(optimisticAttachments),
      ],
      metadata: { createdAt: new Date().toISOString() },
    }

    setMessages((prev) => [...prev, optimisticMessage])
    const submittedInput = textToSend
    if (!overrideText) setInput("")

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
      // The live chat state now belongs to this chat; the history sync
      // effect must not replace it when the URL switches to /c/<id>.
      loadedChatIdRef.current = currentChatId
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
            agentMode,
            reasoningEffort,
            ...(activeCanvas
              ? { canvasId: activeCanvas.id, canvasTitle: activeCanvas.title }
              : {}),
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
    agentMode,
    reasoningEffort,
    activeCanvas,
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
        loadedChatIdRef.current = currentChatId
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
              agentMode,
              reasoningEffort,
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
      agentMode,
      reasoningEffort,
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
        loadedChatIdRef.current = currentChatId

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
              agentMode,
              reasoningEffort,
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
      agentMode,
      reasoningEffort,
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
        agentMode,
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
    agentMode,
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
    runtime,
    agentMode,
    setAgentMode,
    reasoningEffort,
    setReasoningEffort,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
    submitEdit,
  }
}
