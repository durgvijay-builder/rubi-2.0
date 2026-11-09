export interface TTSOptions {
  voice?: string;
  language?: string;
  speed?: number;
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationMs: number;
  isMock: boolean;
}

export interface ITTSAdapter {
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}
