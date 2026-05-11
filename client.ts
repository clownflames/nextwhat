import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import dotenv from 'dotenv'
dotenv.config()

export const PHONE_ID = process.env.PHONE_ID!

export const client = new WhatsAppClient({
    accessToken:process.env.TOKEN!
})

