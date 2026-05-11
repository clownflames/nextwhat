// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
    normalizeWebhook,
    verifySignature,
} from "@kapso/whatsapp-cloud-api/server";

import { db } from "@/db";
import { whatsappMessageTable } from "@/db/schema/whatsapp";

// =========================
// WEBHOOK VERIFICATION
// =========================
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (
        mode === "subscribe" &&
        token === process.env.VERIFY_TOKEN
    ) {
        return new NextResponse(challenge, {
            status: 200,
        });
    }

    return new NextResponse("Verification failed", {
        status: 403,
    });
}

// =========================
// WEBHOOK EVENTS
// =========================
export async function POST(req: NextRequest) {
    try {
        // raw body
        const rawBody = await req.text();

        // verify signature
        const ok = verifySignature({
            appSecret: process.env.META_APP_SECRET as string,
            rawBody,
            signatureHeader:
                req.headers.get("x-hub-signature-256") || "",
        });

        if (!ok) {
            return new NextResponse("Unauthorized", {
                status: 401,
            });
        }

        // parse payload
        const payload = JSON.parse(rawBody);

        // normalize events
        const events = normalizeWebhook(payload);

        // =========================
        // SAVE USER MESSAGES
        // =========================
        for (const message of events.messages as any[]) {
            await db.insert(whatsappMessageTable).values({
                messageId: message.id,

                from: message.from || null,

                to:
                    payload?.entry?.[0]?.changes?.[0]?.value
                        ?.metadata?.display_phone_number || null,

                type: message.type || "unknown",

                status: null,

                body:
                    message.type === "text"
                        ? message.text?.body || null
                        : null,

                mediaId:
                    message.image?.id ||
                    message.video?.id ||
                    message.audio?.id ||
                    message.document?.id ||
                    null,

                mediaUrl: null,

                mimeType:
                    message.image?.mime_type ||
                    message.video?.mime_type ||
                    message.audio?.mime_type ||
                    message.document?.mime_type ||
                    null,

                fileName:
                    message.document?.filename || null,

                caption:
                    message.image?.caption ||
                    message.video?.caption ||
                    message.document?.caption ||
                    null,

                buttonText:
                    (message.button as any)?.text || null,

                buttonPayload:
                    (message.button as any)?.payload || null,

                forwarded:
                    message.context?.forwarded || false,

                billable: null,

                pricingModel: null,

                pricingCategory: null,

                rawData: message,

                whatsappTimestamp:
                    message.timestamp || null,
            });

            await fetch("/api/reply")
        }

        // =========================
        // SAVE STATUS EVENTS
        // =========================
        for (const status of events.statuses as any[]) {
            await db.insert(whatsappMessageTable).values([
                {
                    messageId: status.id,

                    from: null,

                    to:
                        status.recipient_id ||
                        status.recipientId ||
                        null,

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

                    billable:
                        status.pricing?.billable || false,

                    pricingModel:
                        status.pricing?.pricing_model ||
                        status.pricing?.pricingModel ||
                        null,

                    pricingCategory:
                        status.pricing?.category || null,

                    rawData: status,

                    whatsappTimestamp:
                        status.timestamp || null,
                },
            ]);
        }

        return NextResponse.json(
            {
                success: true,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                success: false,
                error: "Internal Server Error",
            },
            {
                status: 500,
            }
        );
    }
}