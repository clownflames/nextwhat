// app/api/cron/reply/route.ts

import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { client, PHONE_ID } from "@/client";

import { db } from "@/db";
import { whatsappMessageTable } from "@/db/schema/whatsapp";

import { SarvamAIClient } from "sarvamai";

export async function GET() {
    try {
        // sarvam ai
        const sarvam = new SarvamAIClient({
            apiSubscriptionKey:
                process.env.SARVAM_API!,
        });

        // get unreplied messages
        const messages = await db
            .select()
            .from(whatsappMessageTable)
            .where(
                and(
                eq(
                    whatsappMessageTable.replyed,
                    false
                ),                
                eq(whatsappMessageTable.type,"text"))
            )
            .orderBy(
                asc(whatsappMessageTable.id)
            )
            .limit(5);

        const results = [];

        for (const message of messages) {
            try {
                // ignore non-text messages
                if (
                    message.type !== "text" ||
                    !message.body ||
                    !message.from
                ) {
                    await db
                        .update(whatsappMessageTable)
                        .set({
                            replyed: true,
                        })
                        .where(
                            eq(
                                whatsappMessageTable.id,
                                message.id
                            )
                        );

                    continue;
                }

                // generate ai response
                const response =
                    await sarvam.chat.completions({
                        model: "sarvam-105b",

                        messages: [
                            {
                                role: "system",
                                content:
                                    "You are a helpful WhatsApp assistant. Reply naturally and keep responses short.",
                            },
                            {
                                role: "user",
                                content: message.body,
                            },
                        ],

                        temperature: 0.7,
                        top_p: 1,
                        // max_tokens: 300,
                    });


                console.log(
                    JSON.stringify(response, null, 2)
                );
                const aiReply =
                    response.choices?.[0]?.message.content
                    ||
                    "Sorry, I could not understand.";

                // send whatsapp reply
                await client.messages.sendText({
                    phoneNumberId: PHONE_ID,
                    to: message.from,
                    body: aiReply,
                });

                // mark message as replied
                await db
                    .update(whatsappMessageTable)
                    .set({
                        replyed: true,
                    })
                    .where(
                        eq(
                            whatsappMessageTable.id,
                            message.id
                        )
                    );

                results.push({
                    id: message.id,
                    user: message.from,
                    message: message.body,
                    reply: aiReply,
                });
            } catch (error) {
                console.error(
                    "Message error:",
                    error
                );
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results,
        });
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