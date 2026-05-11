// db/schema/whatsapp.ts

import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const whatsappMessageTable = pgTable(
  "whatsapp_messages",
  {
    id: serial("id").primaryKey(),

    messageId: text("message_id").notNull(),

    // nullable rakho
    from: varchar("from_number", {
      length: 30,
    }),

    to: varchar("to_number", {
      length: 30,
    }),

    type: varchar("type", {
      length: 50,
    }).notNull(),

    status: varchar("status", {
      length: 50,
    }),

    body: text("body"),

    mediaId: text("media_id"),

    mediaUrl: text("media_url"),

    mimeType: text("mime_type"),

    fileName: text("file_name"),

    caption: text("caption"),

    buttonText: text("button_text"),

    buttonPayload: text("button_payload"),

    forwarded: boolean("forwarded")
      .default(false)
      .notNull(),

    billable: boolean("billable"),

    pricingModel: text("pricing_model"),

    pricingCategory: text("pricing_category"),

    rawData: jsonb("raw_data").notNull(),

    whatsappTimestamp: varchar(
      "whatsapp_timestamp",
      {
        length: 50,
      }
    ),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  }
);