import { sendWhatsAppReply } from "@/lib/sarwam";
import { NextRequest } from "next/server";



export async function GET(req: NextRequest) {

    sendWhatsAppReply({
        from: "916378695548",
        body: "hello ai",
        messageId: "wamid.HBgMOTE2Mzc4Njk1NTQ4FQIAEhgWM0VCMDVBRjVCQjFDRkNFMTNENjlERgA=",
        markAsRead: true,
        saveToDatabase: false
    }).catch(err => console.error("Reply error:", err));
    
}