// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import {
  normalizeWebhook,
  verifySignature,
} from "@kapso/whatsapp-cloud-api/server";

import { db } from "@/db";
import { whatsappMessageTable } from "@/db/schema/whatsapp";

import { PHONE_ID } from "@/client";
import { date } from "drizzle-orm/mysql-core";

// =========================
// WEBHOOK VERIFICATION
// =========================
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

// =========================
// WEBHOOK EVENTS
// =========================
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify signature
    const ok = verifySignature({
      appSecret: process.env.META_APP_SECRET as string,
      rawBody,
      signatureHeader: req.headers.get("x-hub-signature-256") || "",
    });

    if (!ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const events = normalizeWebhook(payload);

    // =========================
    // SAVE USER MESSAGES
    // =========================
    for (const message of events.messages as any[]) {
      // Skip self messages
      if (String(message.from) === String(PHONE_ID)) {
        continue;
      }

      // Check for duplicate
      const existingMessage = await db
        .select({ id: whatsappMessageTable.id })
        .from(whatsappMessageTable)
        .where(eq(whatsappMessageTable.messageId, String(message.id)))
        .limit(1);

      if (existingMessage.length > 0) {
        continue;
      }

      // Get recipient phone number correctly
      const metadata = payload?.entry?.[0]?.changes?.[0]?.value?.metadata;
      const recipientNumber = metadata?.display_phone_number || null;

      // Save message with proper error handling
      try {
        await db.insert(whatsappMessageTable).values({
          messageId: String(message.id),
          from: message.from || null,
          to: recipientNumber,
          type: message.type || "unknown",
          status: null,
          body: message.type === "text" ? message.text?.body || null : null,
          mediaId: message.image?.id || message.video?.id || message.audio?.id || message.document?.id || null,
          mediaUrl: null,
          mimeType: message.image?.mime_type || message.video?.mime_type || message.audio?.mime_type || message.document?.mime_type || null,
          fileName: message.document?.filename || null,
          caption: message.image?.caption || message.video?.caption || message.document?.caption || null,
          buttonText: message.button?.text || null,
          buttonPayload: message.button?.payload || null,
          forwarded: message.context?.forwarded || false,
          replyed: false,
          billable: null,
          pricingModel: null,
          pricingCategory: null,
          rawData: message,
          whatsappTimestamp: String(message.timestamp || ""),
        });

        // Auto reply trigger (only for text messages)
        if (message.type === "text") {
          // Call reply API asynchronously without waiting
          fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              from: message.from, 
              messageId: message.id,
              body: message.text?.body,
              
            })
          }).catch(err => console.error("Reply API error:", err));
        }
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    // =========================
    // SAVE STATUS EVENTS
    // =========================
    for (const status of events.statuses as any[]) {
      // Status IDs are different - use conversation ID or status ID
      const statusId = status.id || status.message_id;
      
      if (!statusId) continue;

      const existingStatus = await db
        .select({ id: whatsappMessageTable.id })
        .from(whatsappMessageTable)
        .where(eq(whatsappMessageTable.messageId, String(statusId)))
        .limit(1);

      if (existingStatus.length > 0) {
        continue;
      }

      await db.insert(whatsappMessageTable).values({
        messageId: String(statusId),
        from: null,
        to: status.recipient_id || status.recipientId || null,
        type: "status",
        status: status.status || null,
        body: null,
        mediaId: null,
        mediaUrl: null,
        mimeType: null,
        fileName: null,
        caption: null,
        buttonText: null,
        buttonPayload: null,
        forwarded: false,
        replyed: true,
        billable: status.pricing?.billable || false,
        pricingModel: status.pricing?.pricing_model || status.pricing?.pricingModel || null,
        pricingCategory: status.pricing?.category || null,
        rawData: status,
        whatsappTimestamp: String(status.timestamp || ""),
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}