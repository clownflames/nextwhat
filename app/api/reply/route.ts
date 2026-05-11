// app/api/cron/reply/route.ts

import { NextRequest, NextResponse } from "next/server";
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




// =========================
// REPLY TO MESSAGES
// =========================
export async function POST(req: NextRequest) {
    try {
        // Parse request body (for immediate replies)
        let immediateReply = false;
        let immediateFrom = null;
        let immediateBody = null;
        
        try {
            const body = await req.json();
            if (body.from && body.body) {
                immediateReply = true;
                immediateFrom = body.from;
                immediateBody = body.body;
            }
        } catch (e) {
            // No body or invalid JSON - continue with normal flow
        }

        // Initialize Sarvam AI Client
        const sarvam = new SarvamAIClient({
            apiSubscriptionKey: process.env.SARVAM_API!,
        });

        let messagesToProcess = [];

        if (immediateReply && immediateFrom && immediateBody) {
            // Immediate reply for single message
            messagesToProcess = [{
                from: immediateFrom,
                body: immediateBody,
                type: "text",
                id: null // temporary
            }];
        } else {
            // Get unreplied messages from database
            messagesToProcess = await db
                .select()
                .from(whatsappMessageTable)
                .where(
                    and(
                        eq(whatsappMessageTable.replyed, false),
                        eq(whatsappMessageTable.type, "text")
                    )
                )
                .orderBy(asc(whatsappMessageTable.id))
                .limit(5);
        }

        const results = [];

        for (const message of messagesToProcess) {
            try {
                // Validate message
                if (!message.body || !message.from) {
                    // If it's a DB record, mark as replied to avoid infinite loop
                    if (message.id) {
                        await db
                            .update(whatsappMessageTable)
                            .set({ replyed: true })
                            .where(eq(whatsappMessageTable.id, message.id));
                    }
                    continue;
                }

                console.log(`Processing message from ${message.from}: ${message.body}`);

                // Generate AI response with better error handling
                let aiReply = "Sorry, I could not understand. Could you please rephrase?";
                
                try {
                    const response = await sarvam.chat.completions({
                        model: "sarvam-105b",
                        messages: [
                            {
                                role: "system",
                                content: "You are a helpful WhatsApp assistant. Keep responses short, friendly, and conversational. Reply in the same language as the user.",
                            },
                            {
                                role: "user",
                                content: message.body,
                            },
                        ],
                        temperature: 0.7,
                        top_p: 1,
                        max_tokens: 300, // Uncommented for better responses
                    });

                    console.log("AI Response:", JSON.stringify(response, null, 2));

                    // Extract response safely
                    if (response?.choices?.[0]?.message?.content) {
                        aiReply = response.choices[0].message.content;
                    } else if (response?.outputs?.[0]?.text) {
                        // Alternative response structure
                        aiReply = response.outputs[0].text;
                    }
                    
                } catch (aiError) {
                    console.error("AI Generation Error:", aiError);
                    // Fallback response
                    aiReply = "I'm having trouble right now. Please try again in a moment.";
                }

                // Send WhatsApp reply
                try {
                    await client.messages.sendText({
                        phoneNumberId: PHONE_ID,
                        to: message.from,
                        body: aiReply,
                    });
                    console.log(`Reply sent to ${message.from}: ${aiReply}`);
                } catch (whatsappError) {
                    console.error("WhatsApp Send Error:", whatsappError);
                    aiReply = "Failed to send message. Please try again.";
                }

                // Mark as replied only for database records
                if (message.id) {
                    await db
                        .update(whatsappMessageTable)
                        .set({ replyed: true })
                        .where(eq(whatsappMessageTable.id, message.id));
                }

                results.push({
                    id: message.id || "immediate",
                    user: message.from,
                    message: message.body,
                    reply: aiReply,
                    success: true
                });

                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error("Message processing error:", error);
                results.push({
                    id: message.id || "unknown",
                    user: message.from,
                    message: message.body,
                    error: String(error),
                    success: false
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            immediate: immediateReply,
            results,
        });

    } catch (error) {
        console.error("Reply API Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Internal Server Error",
                details: String(error)
            },
            { status: 500 }
        );
    }
}
