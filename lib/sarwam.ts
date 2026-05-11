import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { whatsappMessageTable } from "@/db/schema/whatsapp";
import { client, PHONE_ID } from "@/client";
import { SarvamAIClient } from "sarvamai";


const sarvamClient = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API!,
});


// =========================
// SARVAM AI API CALL
// =========================
async function callSarvamAI(userMessage: string): Promise<string> {
    try {
        const response = await sarvamClient.chat.completions({
            model: "sarvam-105b",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful WhatsApp assistant. Keep responses short (max 2-3 sentences), friendly, and conversational.",
                },
                {
                    role: "user",
                    content: userMessage,
                },
            ],
            temperature: 0.7,
            top_p: 1,
            // max_tokens: 300,
        });

        const aiReply = response.choices[0].message.content || 
                       "Sorry, I couldn't process that. Please try again.";

        console.log(response)
        
        return aiReply;
    } catch (error) {
        console.error("Sarvam AI Error:", error);
        throw error;
    }
}

// =========================
// MARK MESSAGE AS READ
// =========================
async function markMessageAsRead(messageId: string) {
    try {
        await client.messages.markRead({
            phoneNumberId: PHONE_ID,
            messageId: messageId,
        });
    } catch (error) {
        console.error("Mark read error:", error);
    }
}

// =========================
// MAIN REPLY FUNCTION
// =========================
interface ReplyOptions {
    from: string;
    body: string;
    messageId?: string;
    markAsRead?: boolean;
    saveToDatabase?: boolean;
}

interface ReplyResult {
    success: boolean;
    reply?: string;
    error?: string;
    messageId?: string;
}

export async function sendWhatsAppReply(options: ReplyOptions): Promise<ReplyResult> {
    const { from, body, messageId, markAsRead = true, saveToDatabase = true } = options;
    
    try {
        console.log(`📨 Sending reply to ${from}: "${body.substring(0, 50)}..."`);
        
        // Mark as read if requested
        if (markAsRead && messageId) {
            await markMessageAsRead(messageId);
        }
        
        // Generate AI response
        let aiReply: string;
        try {
            aiReply = await callSarvamAI(body);
        } catch {
            // Fixed: Removed unused variable 'aiError'
            aiReply = "I'm having technical issues right now. Please try again in a moment. 🙏";
        }
        
        // Send WhatsApp message
        await client.messages.sendText({
            phoneNumberId: PHONE_ID,
            to: from,
            body: aiReply,
        });
        
        // Save to database if requested
        if (saveToDatabase && messageId) {
            await db.insert(whatsappMessageTable).values({
                messageId: `reply_${Date.now()}_${from}`,
                from: PHONE_ID,
                to: from,
                type: "text",
                body: aiReply,
                replyed: true,
                status: null,
                mediaId: null,
                mediaUrl: null,
                mimeType: null,
                fileName: null,
                caption: null,
                buttonText: null,
                buttonPayload: null,
                forwarded: false,
                billable: null,
                pricingModel: null,
                pricingCategory: null,
                rawData: null,
                whatsappTimestamp: String(Math.floor(Date.now() / 1000)),
            });
        }
        
        console.log(`✅ Reply sent successfully to ${from}`);
        
        return {
            success: true,
            reply: aiReply,
            messageId: messageId,
        };
        
    } catch (error) {
        console.error(`❌ Failed to send reply to ${from}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            messageId: messageId,
        };
    }
}

// =========================
// PROCESS PENDING MESSAGES
// =========================
export async function processPendingMessages(limit: number = 5): Promise<{
    processed: number;
    results: ReplyResult[];
}> {
    try {
        // Get unreplied messages
        const messages = await db
            .select()
            .from(whatsappMessageTable)
            .where(
                and(
                    eq(whatsappMessageTable.replyed, false),
                    eq(whatsappMessageTable.type, "text")
                )
            )
            .orderBy(asc(whatsappMessageTable.id))
            .limit(limit);
        
        if (messages.length === 0) {
            return { processed: 0, results: [] };
        }
        
        const results: ReplyResult[] = [];
        
        for (const message of messages) {
            const result = await sendWhatsAppReply({
                from: message.from!,
                body: message.body!,
                messageId: message.messageId,
                markAsRead: true,
                saveToDatabase: false,
            });
            
            // Mark as replied in database
            if (result.success) {
                await db
                    .update(whatsappMessageTable)
                    .set({ replyed: true })
                    .where(eq(whatsappMessageTable.id, message.id));
            }
            
            results.push(result);
            
            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return {
            processed: results.length,
            results,
        };
        
    } catch (error) {
        console.error("Process pending messages error:", error);
        return { processed: 0, results: [] };
    }
}

// =========================
// BULK REPLY FUNCTION
// =========================
interface BulkReplyOptions {
    messages: Array<{
        from: string;
        body: string;
        messageId?: string;
    }>;
    delayBetween?: number;
}

export async function sendBulkWhatsAppReplies(options: BulkReplyOptions): Promise<ReplyResult[]> {
    const { messages, delayBetween = 1000 } = options;
    const results: ReplyResult[] = [];
    
    for (const msg of messages) {
        const result = await sendWhatsAppReply({
            from: msg.from,
            body: msg.body,
            messageId: msg.messageId,
        });
        
        results.push(result);
        
        if (delayBetween > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBetween));
        }
    }
    
    return results;
}