// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
    normalizeWebhook,
    verifySignature,
} from "@kapso/whatsapp-cloud-api/server";
import { client, PHONE_ID } from "@/client";

// =========================
// WEBHOOK VERIFICATION
// =========================
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    client.messages.sendText({
        phoneNumberId: PHONE_ID,
        to: process.env.ADMIN_NO!,
        body: "GET Request found"
    })

    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (
        mode === "subscribe" &&
        token === process.env.VERIFY_TOKEN
    ) {
        client.messages.sendText({
            phoneNumberId: PHONE_ID,
            to: process.env.ADMIN_NO!,
            body: "Verifyed"
        })
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

        // verify meta signature
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

        await client.messages.sendText({
            phoneNumberId: PHONE_ID,
            to: process.env.ADMIN_NO!,
            body: "POST Request found"
        })
        await client.messages.sendText({
            phoneNumberId: PHONE_ID,
            to: process.env.ADMIN_NO!,
            body: rawBody
        })
        // parse payload
        const payload = JSON.parse(rawBody);

        // normalize events
        const events = normalizeWebhook(payload);

        // =========================
        // MESSAGES
        // =========================
        events.messages.forEach((message) => {
            console.log("Message:", message);

            /*
            Example:
            if (message.type === "text") {
              console.log(message.text.body);
            }
            */
        });

        // =========================
        // STATUS UPDATES
        // =========================
        events.statuses.forEach((status) => {
            console.log("Status:", status);
        });

        // =========================
        // CALL EVENTS
        // =========================
        events.calls.forEach((call) => {
            console.log("Call:", call);
        });

        // =========================
        // CONTACTS
        // =========================
        console.log("Contacts:", events.contacts);

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
                error: "Internal Server Error",
            },
            {
                status: 500,
            }
        );
    }
}