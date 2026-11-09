export interface STTOptions {
  language?: ('en' | 'hi' | 'hi-en') | undefined;
  model?: string | undefined;
  encoding?: string | undefined;
  mimeType?: string | undefined;
  filename?: string | undefined;
  format?: ('wav' | 'webm' | 'ogg' | 'mp3' | 'flac' | 'unknown') | undefined;
  sampleRate?: number | undefined;
}

export interface STTResult {
  text: string;
  language: string;
  confidence: number;
  durationMs: number;
  isMock: boolean;
}

export interface ISTTAdapter {
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult>;
}
