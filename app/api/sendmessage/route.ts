// app/api/sendmessage/route.ts
import { client } from '@/client'
import { NextResponse } from 'next/server'



interface SendMessageRequest {
  phoneNumber: string
  message: string
}

interface SendMessageResponse {
  success: boolean
  message?: string
  error?: string
  to?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: SendMessageRequest = await request.json()
    const { phoneNumber, message } = body

    client.messages.sendText({
        phoneNumberId:process.env.PHONE_ID!,
        to:phoneNumber,
        body:message
    })

    return NextResponse.json({success:true})
  }
  catch(e){
    return NextResponse.json({error:"true"},{status:500})
  }
}