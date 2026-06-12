import { pgTable, uuid, text, integer, index } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  metadata: text("metadata"),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(), // "user" | "ai"
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => {
  return {
    convIdx: index("idx_messages_conv").on(table.conversationId, table.createdAt),
  };
});
