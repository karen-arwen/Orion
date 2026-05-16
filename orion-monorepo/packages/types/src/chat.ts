export type ChatRole = "user" | "assistant" | "system";

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string;
  toolCalls?: ChatToolCall[];
  loading?: boolean;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  moduleId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  module?: string;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  conversationId: string;
  message: ChatMessage;
  toolResults?: Array<{
    server: string;
    tool: string;
    result: string;
  }>;
}
