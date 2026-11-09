import { Page } from '@playwright/test';
import { createSyntheticWavBuffer } from '../fixtures/audio-tones.js';

/**
 * Injects deterministic browser-level Web Audio / MediaStream and MediaRecorder
 * mocks into the browser page context before navigation.
 *
 * Ensures that even in headless CI without physical audio hardware,
 * navigator.mediaDevices.getUserMedia() succeeds, MediaRecorder fires ondataavailable,
 * and valid WAV/WebM audio blobs are emitted.
 */
export async function injectBrowserAudioMocks(page: Page, options: { simulateEmptyAudio?: boolean } = {}) {
  const { simulateEmptyAudio = false } = options;

  await page.addInitScript((opts) => {
    // Check if navigator.mediaDevices exists
    if (!navigator.mediaDevices) {
      (navigator as any).mediaDevices = {};
    }

    // Mock getUserMedia
    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      // Create a mock AudioContext if available
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          return dst.stream;
        } catch {
          // fallback
        }
      }

      // Fallback synthetic MediaStream
      const canvas = document.createElement('canvas');
      const stream = (canvas as any).captureStream ? canvas.captureStream(25) : new MediaStream();
      return stream;
    };

    // Mock MediaRecorder if requested or if browser needs deterministic behavior
    const OriginalMediaRecorder = window.MediaRecorder;
    (window as any)._originalMediaRecorder = OriginalMediaRecorder;

    class MockMediaRecorder extends EventTarget {
      public state: 'inactive' | 'recording' | 'paused' = 'inactive';
      public stream: MediaStream;
      public mimeType: string = 'audio/webm;codecs=opus';
      public ondataavailable: ((event: any) => void) | null = null;
      public onstop: ((event: any) => void) | null = null;
      public onerror: ((event: any) => void) | null = null;

      private _intervalId: any = null;

      constructor(stream: MediaStream, options?: any) {
        super();
        this.stream = stream;
        if (options?.mimeType) {
          this.mimeType = options.mimeType;
        }
      }

      start(timeslice?: number) {
        this.state = 'recording';
        const emitChunk = () => {
          if (this.state !== 'recording') return;
          // Generate a dummy blob or empty blob
          const byteLength = opts.simulateEmptyAudio ? 0 : 2048;
          const dummyData = new Uint8Array(byteLength);
          const blob = new Blob([dummyData], { type: this.mimeType });
          const event = new Event('dataavailable') as any;
          event.data = blob;
          if (this.ondataavailable) {
            this.ondataavailable(event);
          }
          this.dispatchEvent(event);
        };

        if (timeslice && timeslice > 0) {
          this._intervalId = setInterval(emitChunk, timeslice);
        }
      }

      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        if (this._intervalId) {
          clearInterval(this._intervalId);
          this._intervalId = null;
        }

        // Emit final chunk
        const byteLength = opts.simulateEmptyAudio ? 0 : 4096;
        const dummyData = new Uint8Array(byteLength);
        const blob = new Blob([dummyData], { type: this.mimeType });
        const dataEvent = new Event('dataavailable') as any;
        dataEvent.data = blob;
        if (this.ondataavailable) {
          this.ondataavailable(dataEvent);
        }
        this.dispatchEvent(dataEvent);

        // Emit stop
        const stopEvent = new Event('stop');
        if (this.onstop) {
          this.onstop(stopEvent);
        }
        this.dispatchEvent(stopEvent);
      }

      pause() {
        this.state = 'paused';
      }

      resume() {
        this.state = 'recording';
      }

      static isTypeSupported(type: string) {
        return true;
      }
    }

    // Only override if not already mocked
    if (!(window as any)._mediaRecorderMocked) {
      (window as any).MediaRecorder = MockMediaRecorder;
      (window as any)._mediaRecorderMocked = true;
    }
  }, { simulateEmptyAudio });
}

/**
 * Attaches a synthetic WAV audio file buffer to a file input element.
 */
export async function uploadSyntheticAudioFile(
  page: Page,
  fileInputSelector: string,
  buffer: Buffer,
  fileName: string = 'test-tone.wav',
  mimeType: string = 'audio/wav'
) {
  await page.setInputFiles(fileInputSelector, {
    name: fileName,
    mimeType: mimeType,
    buffer: buffer,
  });
}

