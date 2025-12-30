
export enum AppView {
  EDITOR = 'editor',
  AI_VISION = 'ai_vision', // Renamed from OCR
  MULTI_DOC = 'multi_doc',
  AI_RESEARCH = 'ai_research'
}

export enum WordTemplate {
  STANDARD = 'standard',
  ACADEMIC = 'academic',
  NOTE = 'note',
  CUSTOM = 'custom'
}

export interface DocumentState {
  markdown: string;
  isProcessing: boolean;
  progress: number;
}

export interface OCRResult {
  latex: string;
  confidence?: number;
}

export interface DocumentStyle {
  fontFace: string;
  fontSize: number;
  lineSpacing: number;
  headingColor: string;
  textColor: string;
  alignment: string;
  paragraphSpacing: number;
}

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'action' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface ResearchState {
  topic: string;
  isRunning: boolean;
  logs: LogEntry[];
  report: string;
  sources: SearchResult[];
}
