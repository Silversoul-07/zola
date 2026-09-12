/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "@/components/ui/toast"
import { useChat } from "@ai-sdk/react"
import { useMemo, useRef } from "react"

type ModelConfig = {
  id: string
  name: string
  provider: string
}

type ModelChat = {
  model: ModelConfig
  messages: any[]
  isLoading: boolean
  append: (message: any, options?: any) => void
  stop: () => void
}

// Maximum number of models we support
const MAX_MODELS = 10

export function useMultiChat(models: ModelConfig[]): ModelChat[] {
  // Bug fix (state leakage between panes): each useChat hook below is bound
  // to a fixed slot index, but `models` is re-derived every render from
  // selectedModelIds + persisted messages, so its order can shift (e.g. a
  // model gets deselected and a different one now sits at that index). If we
  // mapped models[index] -> chatHooks[index] directly, a slot's messages
  // could suddenly render under a different model's name. Instead we keep a
  // sticky modelId -> slot assignment: a model keeps its slot for the life
  // of the component, and only newly-freed slots are handed to new models.
  const slotAssignmentRef = useRef<(string | null)[]>(
    Array(MAX_MODELS).fill(null)
  )

  const modelsBySlot = useMemo(() => {
    const assignment = slotAssignmentRef.current
    const currentIds = new Set(models.map((m) => m.id))

    // Free slots whose model is no longer requested.
    for (let i = 0; i < assignment.length; i++) {
      if (assignment[i] && !currentIds.has(assignment[i] as string)) {
        assignment[i] = null
      }
    }

    const result: (ModelConfig | null)[] = Array(MAX_MODELS).fill(null)
    models.slice(0, MAX_MODELS).forEach((model) => {
      let slot = assignment.indexOf(model.id)
      if (slot === -1) {
        slot = assignment.indexOf(null)
        if (slot !== -1) assignment[slot] = model.id
      }
      if (slot !== -1) result[slot] = model
    })

    return result
  }, [models])

  // Create a fixed number of useChat hooks to avoid conditional hook calls
  const chatHooks = Array.from({ length: MAX_MODELS }, (_, index) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
      api: "/api/chat",
      onError: (error) => {
        const model = modelsBySlot[index]
        if (model) {
          console.error(`Error with ${model.name}:`, error)
          toast({
            title: `Error with ${model.name}`,
            description: error.message,
            status: "error",
          })
        }
      },
    })
  )

  // Map only the slots that currently hold a model to their chat hooks
  const activeChatInstances = useMemo(() => {
    const instances: ModelChat[] = []
    modelsBySlot.forEach((model, index) => {
      if (!model) return
      const chatHook = chatHooks[index]
      instances.push({
        model,
        messages: chatHook.messages,
        isLoading: chatHook.isLoading,
        append: (message: any, options?: any) => {
          return chatHook.append(message, options)
        },
        stop: chatHook.stop,
      })
    })
    return instances
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsBySlot, ...chatHooks.flatMap((chat) => [chat.messages, chat.isLoading])])

  return activeChatInstances
}
