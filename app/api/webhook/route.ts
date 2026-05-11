// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  normalizeWebhook,
  verifySignature,
} from "@kapso/whatsapp-cloud-api/server";
import { client, PHONE_ID } from "@/client";

export async function POST(req: NextRequest) {
  try {
    // raw body
    const rawBody = await req.text();

    // verify signature
    const ok = verifySignature({
      appSecret: process.env.META_APP_SECRET as string,
      rawBody,
      signatureHeader: req.headers.get("x-hub-signature-256") || "",
    });



    if (!ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    client.messages.sendText({
        phoneNumberId:PHONE_ID,
        to:process.env.ADMIN_NO!,
        body:rawBody
    })

    // parse payload
    const payload = JSON.parse(rawBody);



    // normalize events
    const events = normalizeWebhook(payload);

    // messages
    events.messages.forEach((message) => {
      console.log("Message:", message);
      

      // yaha handle karo
    });

    // statuses
    events.statuses.forEach((status) => {
      console.log("Status:", status);

      // delivery/read receipts
    });

    // calls
    events.calls.forEach((call) => {
      console.log("Call:", call);
    });

    // contacts
    console.log("Contacts:", events.contacts);

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}