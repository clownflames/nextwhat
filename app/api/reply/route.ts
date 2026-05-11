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
// SARVAM AI API CALL (Direct HTTP)
// =========================
async function callSarvamAI(userMessage: string): Promise<string> {
    try {
        const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-subscription-key": process.env.SARVAM_API!,
            },
            body: JSON.stringify({
                model: "sarvam-105b",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful WhatsApp assistant. Keep responses short (max 2-3 sentences), friendly, and conversational. Reply in the same language as the user.",
                    },
                    {
                        role: "user",
                        content: userMessage,
                    },
                ],
                temperature: 0.7,
                top_p: 1,
                max_tokens: 300,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Sarvam API Error:", response.status, errorText);
            throw new Error(`Sarvam API responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log("Sarvam Response:", JSON.stringify(data, null, 2));

        // Extract response from different possible formats
        let aiReply = null;
        
        if (data.choices?.[0]?.message?.content) {
            aiReply = data.choices[0].message.content;
        } else if (data.output?.text) {
            aiReply = data.output.text;
        } else if (data.response) {
            aiReply = data.response;
        } else if (data.text) {
            aiReply = data.text;
        } else {
            aiReply = "I understand you, but I'm having trouble responding right now. Please try again.";
        }

        return aiReply;
        
    } catch (error) {
        console.error("Sarvam AI Call Failed:", error);
        throw error;
    }
}

// =========================
// POST - Process Messages
// =========================
export async function POST(req: NextRequest) {
    try {
        // Check if immediate reply request
        let immediateFrom = null;
        let immediateBody = null;
        
        try {
            const body = await req.json();
            if (body.from && body.body) {
                immediateFrom = body.from;
                immediateBody = body.body;
                console.log(`Immediate reply request from ${immediateFrom}: ${immediateBody}`);
            }
        } catch (e) {
            // No body - continue with pending messages
        }

        let messagesToProcess = [];

        if (immediateFrom && immediateBody) {
            // Immediate reply
            messagesToProcess = [{
                id: null,
                from: immediateFrom,
                body: immediateBody,
                type: "text"
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

        if (messagesToProcess.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No messages to process",
                processed: 0,
            });
        }

        const results = [];

        for (const message of messagesToProcess) {
            try {
                // Validate message
                if (!message.body || !message.from) {
                    if (message.id) {
                        await db
                            .update(whatsappMessageTable)
                            .set({ replyed: true })
                            .where(eq(whatsappMessageTable.id, message.id));
                    }
                    continue;
                }

                console.log(`🤖 Processing: ${message.from} -> "${message.body}"`);

                // Generate AI response
                let aiReply = "Sorry, I couldn't process your request. Please try again.";
                
                try {
                    aiReply = await callSarvamAI(message.body);
                } catch (aiError) {
                    console.error("AI Error:", aiError);
                    aiReply = "I'm experiencing technical difficulties. Please message again in a moment. 🙏";
                }

                // Send WhatsApp reply
                try {
                    await client.messages.sendText({
                        phoneNumberId: PHONE_ID,
                        to: message.from,
                        body: aiReply,
                    });
                    console.log(`✅ Reply sent to ${message.from}: ${aiReply.substring(0, 50)}...`);
                } catch (whatsappError) {
                    console.error("WhatsApp Send Error:", whatsappError);
                    aiReply = "Failed to send message. Please check your number and try again.";
                }

                // Mark as replied (only for database records)
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
                    status: "sent",
                });

                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Error processing message ${message.id}:`, error);
                results.push({
                    id: message.id || "unknown",
                    user: message.from,
                    message: message.body,
                    error: String(error),
                    status: "failed",
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            immediate: immediateFrom ? true : false,
            results,
        });

    } catch (error) {
        console.error("Reply API Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Internal Server Error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

