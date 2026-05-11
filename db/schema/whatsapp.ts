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

    // whatsapp message id
    messageId: text("message_id").notNull(),

    // sender
    from: varchar("from_number", {
      length: 30,
    }).notNull(),

    // receiver
    to: varchar("to_number", {
      length: 30,
    }),

    // text,image,audio,video,document,status
    type: varchar("type", {
      length: 50,
    }).notNull(),

    // sent, delivered, read, failed
    status: varchar("status", {
      length: 50,
    }),

    // actual text
    body: text("body"),

    // media fields
    mediaId: text("media_id"),
    mediaUrl: text("media_url"),
    mimeType: text("mime_type"),
    fileName: text("file_name"),
    caption: text("caption"),

    // button/interactions
    buttonText: text("button_text"),
    buttonPayload: text("button_payload"),

    // forwarded
    forwarded: boolean("forwarded")
      .default(false)
      .notNull(),

    // pricing
    billable: boolean("billable"),
    pricingModel: text("pricing_model"),
    pricingCategory: text("pricing_category"),

    // full raw webhook data
    rawData: jsonb("raw_data").notNull(),

    // whatsapp timestamp
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