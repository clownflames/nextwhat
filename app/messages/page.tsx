// app/messages/page.tsx

"use client";

import { useEffect, useState } from "react";

type Message = {
  id: number;
  messageId: string;
  from: string | null;
  to: string | null;
  type: string;
  status: string | null;
  body: string | null;
  mediaId: string | null;
  mimeType: string | null;
  fileName: string | null;
  caption: string | null;
  createdAt: string;
  rawData: any;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    try {
      const res = await fetch("/api/messages");
      const data = await res.json();

      setMessages(data.messages || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            WhatsApp Messages
          </h1>

          <button
            onClick={fetchMessages}
            className="bg-green-500 px-4 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                  {message.type}
                </span>

                {message.status && (
                  <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">
                    {message.status}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-zinc-400">
                    From:
                  </span>{" "}
                  {message.from || "-"}
                </p>

                <p>
                  <span className="text-zinc-400">
                    To:
                  </span>{" "}
                  {message.to || "-"}
                </p>

                <p>
                  <span className="text-zinc-400">
                    Message ID:
                  </span>{" "}
                  {message.messageId}
                </p>

                {message.body && (
                  <div>
                    <p className="text-zinc-400 mb-1">
                      Body:
                    </p>

                    <div className="bg-zinc-800 p-3 rounded-xl whitespace-pre-wrap">
                      {message.body}
                    </div>
                  </div>
                )}

                {message.caption && (
                  <p>
                    <span className="text-zinc-400">
                      Caption:
                    </span>{" "}
                    {message.caption}
                  </p>
                )}

                {message.fileName && (
                  <p>
                    <span className="text-zinc-400">
                      File:
                    </span>{" "}
                    {message.fileName}
                  </p>
                )}

                {message.mimeType && (
                  <p>
                    <span className="text-zinc-400">
                      Mime:
                    </span>{" "}
                    {message.mimeType}
                  </p>
                )}

                <p>
                  <span className="text-zinc-400">
                    Created:
                  </span>{" "}
                  {new Date(
                    message.createdAt
                  ).toLocaleString()}
                </p>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-green-400">
                  Raw Data
                </summary>

                <pre className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl overflow-auto text-xs mt-3">
                  {JSON.stringify(
                    message.rawData,
                    null,
                    2
                  )}
                </pre>
              </details>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="text-center py-20 text-zinc-500">
              No messages found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}