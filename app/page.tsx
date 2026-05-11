'use client'

import React, { useState, KeyboardEvent, ChangeEvent, FormEvent } from 'react'
import { Send, Phone, MessageCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

// Type definitions
interface StatusType {
  type: 'success' | 'error'
  message: string
}

interface ApiResponse {
  success?: boolean
  error?: string
  message?: string
  to?: string
}

export default function Page(): React.JSX.Element {
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [status, setStatus] = useState<StatusType | null>(null)
  const [characterCount, setCharacterCount] = useState<number>(0)

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const cleaned: string = value.replace(/\D/g, '')
    // Limit to 15 digits (international format)
    const limited: string = cleaned.slice(0, 15)
    
    // Format as +X XXX XXX XXXX (example)
    if (limited.length <= 1) return limited
    if (limited.length <= 4) return `+${limited}`
    if (limited.length <= 7) return `+${limited.slice(0, 1)} ${limited.slice(1)}`
    if (limited.length <= 10) return `+${limited.slice(0, 1)} ${limited.slice(1, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`
    return `+${limited.slice(0, 1)} ${limited.slice(1, 4)} ${limited.slice(4, 7)} ${limited.slice(7, 11)} ${limited.slice(11)}`
  }

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const formatted: string = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const text: string = e.target.value
    setMessage(text)
    setCharacterCount(text.length)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    
    // Validation
    const rawPhone: string = phoneNumber.replace(/\D/g, '')
    if (!rawPhone || rawPhone.length < 10) {
      setStatus({
        type: 'error',
        message: 'Please enter a valid phone number'
      })
      return
    }

    if (!message.trim()) {
      setStatus({
        type: 'error',
        message: 'Please enter a message'
      })
      return
    }

    setIsLoading(true)
    setStatus(null)

    try {
      const response: Response = await fetch('/api/sendmessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: rawPhone,
          message: message.trim(),
        }),
      })

      const data: ApiResponse = await response.json()

      if (response.ok) {
        setStatus({
          type: 'success',
          message: data.message || 'Message sent successfully!'
        })
        setMessage('')
        setCharacterCount(0)
        // Optional: Clear phone number after success
        // setPhoneNumber('')
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to send message'
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setStatus({
        type: 'error',
        message: 'Network error. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Create a synthetic form event
      const syntheticEvent = {
        preventDefault: () => {},
      } as FormEvent<HTMLFormElement>
      handleSubmit(syntheticEvent)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold">Send WhatsApp Message</h1>
            </div>
            <p className="text-green-100 text-sm">
              Send instant messages to any WhatsApp number
            </p>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Phone Number Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4 text-green-500" />
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 text-sm">🇮🇳</span>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="+91 12345 67890"
                  className="w-full pl-12 pr-4 py-3 border text-black border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Enter full international number (e.g., +91 for India)
              </p>
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MessageCircle className="w-4 h-4 text-green-500" />
                Message
              </label>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyPress}
                  rows={4}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 border text-black border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all outline-none resize-none"
                  disabled={isLoading}
                  maxLength={4096}
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {characterCount}/4096
                </div>
              </div>
            </div>

            {/* Status Message */}
            {status && (
              <div className={`flex items-center gap-2 p-3 rounded-xl ${
                status.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {status.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <p className="text-sm font-medium">{status.message}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Message
                </>
              )}
            </button>

            {/* Info Note */}
            <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
              <p>Messages are sent via WhatsApp Business API</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}