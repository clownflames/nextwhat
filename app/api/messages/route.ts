// app/api/messages/route.ts

import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { whatsappMessageTable } from "@/db/schema/whatsapp";

export async function GET() {
  try {
    const messages = await db
      .select()
      .from(whatsappMessageTable)
      .orderBy(desc(whatsappMessageTable.id));

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch messages",
      },
      {
        status: 500,
      }
    );
  }
}