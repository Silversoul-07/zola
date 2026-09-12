import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  profileImage: text("profile_image"),
  systemPrompt: text("system_prompt"),
  favoriteModels: jsonb("favorite_models").$type<string[]>().default([]),
  messageCount: integer("message_count").default(0),
  dailyMessageCount: integer("daily_message_count").default(0),
  dailyReset: timestamp("daily_reset", { withTimezone: true }),
  dailyProMessageCount: integer("daily_pro_message_count").default(0),
  dailyProReset: timestamp("daily_pro_reset", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title"),
  model: text("model"),
  systemPrompt: text("system_prompt"),
  // Session id on the agent's own runtime (currently OpenCode), reused across
  // turns for the same chat. Null for Hermes and non-agent chats.
  runtimeSessionId: text("runtime_session_id"),
  public: boolean("public").default(false),
  pinned: boolean("pinned").notNull().default(false),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content"),
  experimentalAttachments: jsonb("experimental_attachments"),
  parts: jsonb("parts"),
  messageGroupId: text("message_group_id"),
  model: text("model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const userKeys = pgTable(
  "user_keys",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.provider] })]
)

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layout: text("layout").default("sidebar"),
  promptSuggestions: boolean("prompt_suggestions").default(false),
  showToolInvocations: boolean("show_tool_invocations").default(true),
  showConversationPreviews: boolean("show_conversation_previews").default(
    true
  ),
  multiModelEnabled: boolean("multi_model_enabled").default(false),
  hiddenModels: jsonb("hidden_models").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const chatAttachments = pgTable("chat_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
