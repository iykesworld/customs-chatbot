"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Send, ChevronDown, ChevronUp } from "lucide-react"
// Removed: import Image from "next/image"; 
// Using standard <img> tag to avoid environment dependency issues.

interface Source {
  text: string // The text content of the source snippet
  metadata?: Record<string, unknown>
}

// Adjusted Message interface to correctly handle the structure of the incoming data
interface Message {
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  isLoading?: boolean
  error?: boolean
}

export default function NCSChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome, Officer. I am your instant knowledge assistant. Ask me about tariffs, prohibited items, or the NCS Act.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")

    // 1. Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])

    // 2. Add loading message
    setMessages((prev) => [...prev, { role: "assistant", content: "", isLoading: true }])
    setIsLoading(true)

    try {
      // API call to the FastAPI backend
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userMessage }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // *** CRITICAL FIX: MAP SOURCE FIELDS ***
      // The backend returns 'source_text_preview', but the frontend expects 'text'.
      const transformedSources = (data.sources || []).map((s: any) => ({
        text: s.source_text_preview,
        metadata: s.metadata,
      }))

      // 3. Remove loading message and add actual response
      setMessages((prev) => {
        const newMessages = prev.slice(0, -1)
        return [
          ...newMessages,
          {
            role: "assistant",
            content: data.answer || "I apologize, but I could not generate a response.",
            sources: transformedSources, // Use transformed sources here
          },
        ]
      })
    } catch (error) {
      console.error("Error fetching response:", error)

      // 3b. Remove loading message and add error message
      setMessages((prev) => {
        const newMessages = prev.slice(0, -1)
        return [
          ...newMessages,
          {
            role: "assistant",
            content:
              "I apologize, but I encountered an error connecting to the knowledge base. Please ensure the backend service is running and try again.",
            error: true,
          },
        ]
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 font-sans">
      {/* Header (Deep Blue / Gold Theme) */}
      <header className="border-b border-border bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#004e92] border-2 border-[#FFC72C] shadow-lg">
            {/* Placeholder for NCS Logo using <img> tag */}
            <img 
                src="/ncsLogo.jpeg" 
                alt="NCS Logo Placeholder" 
                width={48} 
                height={48} 
                className="rounded-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#004e92] dark:text-gray-100">
                NCS Internal Inquiry Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Retrieval-Augmented Knowledge Base
            </p>
          </div>
        </div>
      </header>

      {/* Chat Window */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col px-4 py-6">
          <Card className="flex-1 overflow-hidden flex flex-col shadow-2xl rounded-xl">
            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-100 dark:bg-gray-800">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 text-sm animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                    {/* Placeholder for AI Avatar using <img> tag */}
                    <img 
                        src="https://placehold.co/32x32/333333/ffffff?text=AI" 
                        alt="AI Avatar" 
                        width={32} 
                        height={32} 
                        className="rounded-full"
                    />
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#004e92] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-[#004e92] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-[#004e92] rounded-full animate-bounce"></span>
                  </div>
                  <span>AI is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question (e.g., 'What is the duty on second-hand clothes?')"
                  className="flex-1 px-4 py-3 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#004e92] focus:border-transparent transition-shadow"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 bg-[#004e92] hover:bg-blue-800 text-white shadow-lg transition-all duration-200 rounded-full disabled:bg-gray-400"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const [expandedSources, setExpandedSources] = useState(false)
  const isUser = message.role === "user"

  if (message.isLoading) {
    return null
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] flex flex-col ${isUser ? "order-2 items-end" : "order-1 items-start"}`}>
        {/* Chat Bubble */}
        <div
          className={`rounded-xl px-4 py-3 shadow-md ${
            isUser
              ? "bg-[#004e92] text-white rounded-br-none"
              : message.error
                ? "bg-red-100 text-red-800 border border-red-300 rounded-tl-none"
                : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-tl-none"
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Source Citations for AI Message */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setExpandedSources(!expandedSources)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-[#FFC72C] transition-colors p-1"
            >
              <span className="px-2 py-1 rounded-full bg-[#FFC72C]/20 text-[#004e92] border border-[#FFC72C]/50 dark:bg-yellow-900/50 dark:text-[#FFC72C]">
                {message.sources.length} {message.sources.length === 1 ? "Source Cited" : "Sources Cited"}
              </span>
              {expandedSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {expandedSources && (
              <div className="space-y-2 mt-2 border-l-2 border-[#FFC72C] pl-3">
                {message.sources.map((source, idx) => (
                  <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-inner">
                    <div className="font-bold text-[#004e92] dark:text-[#FFC72C] mb-1">Citation {idx + 1}:</div>
                    <div className="text-gray-700 dark:text-gray-300 italic leading-relaxed line-clamp-3">
                      {`"${source.text}"`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
