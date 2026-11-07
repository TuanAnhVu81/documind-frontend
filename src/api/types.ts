export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type PageParams = { page?: number; size?: number };
export type User = { id: string; email: string };
export type Credentials = { email: string; password: string };
export type Csrf = { token: string; headerName: string };
export type Session = { accessToken: string; tokenType: string; expiresIn: number; user: User };
export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETING';
export type Document = {
  id: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount: number | null;
  paragraphCount: number | null;
  chunkCount: number | null;
  attempts: number | null;
  nextRetryAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};
export type UploadResult = { id: string; status: DocumentStatus };
export type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
export type Source = {
  sourceId: string;
  documentId: string;
  filename: string | null;
  locationType: 'PAGE' | 'PARAGRAPH';
  pageNumber: number | null;
  paragraphIndex: number | null;
  startOffset: number | null;
  endOffset: number | null;
  snippet: string | null;
  availability: 'AVAILABLE' | 'DELETED';
};
export type Message = {
  id: string;
  conversationId: string;
  ordinal: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status: 'GENERATING' | 'COMPLETE' | 'INCOMPLETE' | 'ERROR';
  outcome:
    | 'ANSWER'
    | 'NO_EVIDENCE'
    | 'CLARIFICATION_REQUIRED'
    | 'CITATION_VALIDATION_FAILED'
    | 'SOURCE_DELETED'
    | 'PROVIDER_ERROR'
    | 'PERSISTENCE_ERROR'
    | 'CLIENT_DISCONNECTED'
    | 'TIMEOUT'
    | null;
  sources: Source[];
  createdAt: string;
};
export type MessagePage = { items: Message[]; hasMore: boolean; nextBeforeOrdinal: number | null };
export type GenerationUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  embeddingTokens: number | null;
  estimatedCostUsd: number | null;
  estimated: boolean;
};
export type Usage = GenerationUsage & {
  periodStart: string;
  periodEnd: string;
  questionCount: number;
};
export type ChatRequest = { content: string; documentIds?: string[] };
export type ChatEvents = {
  start: {
    generationId: string;
    userMessageId: string;
    assistantMessageId: string;
    replayed: boolean;
  };
  token: { text: string };
  sources: { sources: Source[] };
  done: { message: Message; usage: GenerationUsage };
  error: {
    code: string;
    message: string;
    generationId: string;
    assistantMessageId: string;
    status: string;
    discardPartial: boolean;
    requestId: string;
  };
  heartbeat: Record<string, never>;
};
