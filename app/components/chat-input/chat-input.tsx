"use client"

import { APP_NAME } from "@/lib/config"

import { ModelSelector } from "@/components/common/model-selector/base"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input"
import { Button } from "@/components/ui/button"
import { getModelInfo } from "@/lib/models"
import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { PromptSystem } from "../suggestions/prompt-system"
import { AgentModeSelect } from "./agent-mode-select"
import { ButtonFileUpload } from "./button-file-upload"
import { ButtonSearch } from "./button-search"
import { FileList } from "./file-list"
import { ThinkingEffortSelect } from "./thinking-effort-select"
import { ContextMeter } from "./context-meter"
import type { LanguageModelUsage } from "ai"

type ChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  hasMessages?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  onSuggestion: (suggestion: string) => void
  hasSuggestions?: boolean
  onSelectModel: (model: string) => void
  selectedModel: string
  isUserAuthenticated: boolean
  stop: () => void
  status?: "submitted" | "streaming" | "ready" | "error"
  setEnableSearch: (enabled: boolean) => void
  enableSearch: boolean
  quotedText?: { text: string; messageId: string } | null
  showAgentMode?: boolean
  agentMode?: string
  onAgentModeChange?: (mode: string) => void
  reasoningEffort?: string
  onReasoningEffortChange?: (effort: string) => void
  turnUsage?: LanguageModelUsage
}

export function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  onSuggestion,
  hasSuggestions,
  onSelectModel,
  selectedModel,
  isUserAuthenticated,
  stop,
  status,
  setEnableSearch,
  enableSearch,
  quotedText,
  showAgentMode,
  agentMode,
  onAgentModeChange,
  reasoningEffort,
  onReasoningEffortChange,
  turnUsage,
}: ChatInputProps) {
  const selectModelConfig = getModelInfo(selectedModel)
  const hasSearchSupport = Boolean(selectModelConfig?.webSearch)
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    if (isSubmitting) {
      return
    }

    if (status === "streaming") {
      stop()
      return
    }

    onSend()
  }, [isSubmitting, onSend, status, stop])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitting) {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && status === "streaming") {
        e.preventDefault()
        return
      }

      if (e.key === "Enter" && !e.shiftKey) {
        if (isOnlyWhitespace(value)) {
          return
        }

        e.preventDefault()
        onSend()
      }
    },
    [isSubmitting, onSend, status, value]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const hasImageContent = Array.from(items).some((item) =>
        item.type.startsWith("image/")
      )

      if (!isUserAuthenticated && hasImageContent) {
        e.preventDefault()
        return
      }

      if (isUserAuthenticated && hasImageContent) {
        const imageFiles: File[] = []

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              const newFile = new File(
                [file],
                `pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
                { type: file.type }
              )
              imageFiles.push(newFile)
            }
          }
        }

        if (imageFiles.length > 0) {
          onFileUpload(imageFiles)
        }
      }
      // Text pasting will work by default for everyone
    },
    [isUserAuthenticated, onFileUpload]
  )

  useEffect(() => {
    if (quotedText) {
      const quoted = quotedText.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      onValueChange(value ? `${value}\n\n${quoted}\n\n` : `${quoted}\n\n`)

      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotedText, onValueChange])

  useMemo(() => {
    if (!hasSearchSupport && enableSearch) {
      setEnableSearch?.(false)
    }
  }, [hasSearchSupport, enableSearch, setEnableSearch])

  return (
    <div className="relative flex w-full flex-col gap-4">
      {hasSuggestions && (
        <PromptSystem
          onValueChange={onValueChange}
          onSuggestion={onSuggestion}
          value={value}
        />
      )}
      <div
        className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1"
        onClick={() => textareaRef.current?.focus()}
      >
        <PromptInput
          className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
          maxHeight={200}
          value={value}
          onValueChange={onValueChange}
        >
          <FileList files={files} onFileRemove={onFileRemove} />
          <PromptInputTextarea
            ref={textareaRef}
            placeholder={`Ask ${APP_NAME}`}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="min-h-[36px] pt-2 pl-3 text-[15px] leading-[1.3] sm:text-[15px] md:text-[15px]"
          />
          <PromptInputActions className="w-full justify-between p-1">
            <div className="flex items-center gap-1">
              <ButtonFileUpload
                onFileUpload={onFileUpload}
                isUserAuthenticated={isUserAuthenticated}
                model={selectedModel}
              />
              <ModelSelector
                selectedModelId={selectedModel}
                setSelectedModelId={onSelectModel}
                isUserAuthenticated={isUserAuthenticated}
                className="rounded-full"
              />
              {onReasoningEffortChange ? (
                <ThinkingEffortSelect
                  value={reasoningEffort ?? "auto"}
                  onChange={onReasoningEffortChange}
                />
              ) : null}
              <ContextMeter usage={turnUsage} modelId={selectedModel} />
              {showAgentMode && onAgentModeChange ? (
                <AgentModeSelect
                  value={agentMode || "build"}
                  onChange={onAgentModeChange}
                />
              ) : null}
              {hasSearchSupport ? (
                <ButtonSearch
                  isSelected={enableSearch}
                  onToggle={setEnableSearch}
                  isAuthenticated={isUserAuthenticated}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-1">
            <PromptInputAction
              tooltip={status === "streaming" ? "Stop" : "Send"}
            >
              <Button
                size="sm"
                className="size-8 rounded-full transition-all duration-300 ease-out"
                disabled={!value || isSubmitting || isOnlyWhitespace(value)}
                type="button"
                onClick={handleSend}
                aria-label={status === "streaming" ? "Stop" : "Send message"}
              >
                {status === "streaming" ? (
                  <StopIcon className="size-4" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </Button>
            </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
