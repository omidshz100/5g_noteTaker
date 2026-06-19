export interface TranscriptEntry {
  id: string;
  text: string;
  speakerId: string;
  speakerDisplayName: string;
  confidence: number;
  startOffset: string;
  endOffset: string;
  spokenLanguageTag?: string;
}

export interface TranscriptData {
  entries: TranscriptEntry[];
}

export interface Speaker {
  id: string;
  name: string;
  count: number;
}

export interface EntryGroup {
  speakerId: string;
  name: string;
  startOffset: string;
  entries: TranscriptEntry[];
}

export interface Session {
  id: number;
  filename: string;
  data: TranscriptData;
  title: string;
  date: string;
  lecturer: string;
  speakers: Speaker[];
  duration: string | null;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  inputTokens?: number;
  outputTokens?: number;
  costEur?: number;
}
