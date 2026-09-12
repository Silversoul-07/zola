import type { Message as MessageAISDK } from "ai"
import { fetchClient } from "../../fetch"
import { API_ROUTE_CHATS } from "../../routes"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

export interface ExtendedMessageAISDK extends MessageAISDK {
  message_group_id?: string
  model?: string
}

type DbMessage = {
  id: number | string
  content: string | null
  role: MessageAISDK["role"]
  experimental_attachments?: MessageAISDK["experimental_attachments"]
  created_at: string | null
  parts?: MessageAISDK["parts"]
  message_group_id?: string | null
  model?: string | null
}

function fromDbMessage(message: DbMessage): MessageAISDK {
  return {
    ...message,
    id: String(message.id),
    content: message.content ?? "",
    createdAt: new Date(message.created_at || ""),
    parts: (message?.parts as MessageAISDK["parts"]) || undefined,
    message_group_id: message.message_group_id ?? undefined,
    model: message.model ?? undefined,
  } as MessageAISDK
}

export async function getMessagesFromDb(
  chatId: string
): Promise<MessageAISDK[]> {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`)
  if (!res.ok) return []

  const data: DbMessage[] = await res.json()
  return data.map(fromDbMessage)
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<MessageAISDK[]> {
  const all = await getMessagesFromDb(chatId)
  return all.slice(-limit)
}

async function insertMessageToDb(
  chatId: string,
  message: ExtendedMessageAISDK
) {
  await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: message.role,
      content: message.content,
      experimental_attachments: message.experimental_attachments,
      createdAt: message.createdAt?.toISOString(),
      message_group_id: message.message_group_id || null,
      model: message.model || null,
    }),
  })
}

async function insertMessagesToDb(
  chatId: string,
  messages: ExtendedMessageAISDK[]
) {
  await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        experimental_attachments: message.experimental_attachments,
        createdAt: message.createdAt?.toISOString(),
        message_group_id: message.message_group_id || null,
        model: message.model || null,
      })),
    }),
  })
}

async function deleteMessagesFromDb(chatId: string) {
  const res = await fetchClient(`${API_ROUTE_CHATS}/${chatId}/messages`, {
    method: "DELETE",
  })
  if (!res.ok) {
    console.error("Failed to clear messages from database")
  }
}

type ChatMessageEntry = {
  id: string
  messages: MessageAISDK[]
}

export async function getCachedMessages(
  chatId: string
): Promise<MessageAISDK[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: MessageAISDK[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: MessageAISDK
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: MessageAISDK[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
