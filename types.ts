
export enum AppView {
  EDITOR = 'editor',
  AI_VISION = 'ai_vision', // Renamed from OCR
  MULTI_DOC = 'multi_doc'
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
