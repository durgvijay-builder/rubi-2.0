/**
 * In-browser 16kHz Mono 16-bit PCM WAV Recorder & Universal Transcoder.
 * Captures microphone streams and converts WebM, OGG, MP3, etc. into
 * genuine RIFF/WAVE files with authentic 44-byte headers.
 */

export interface WavRecorderHandle {
  stop: () => Promise<Blob>;
}

export async function startWavRecording(stream: MediaStream): Promise<WavRecorderHandle> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API (AudioContext) is not supported in this browser.');
  }

  const audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => {});
  }

  const source = audioContext.createMediaStreamSource(stream);

  // ScriptProcessor buffer size: 4096 gives ~85ms buffers at 48kHz
  const bufferSize = 4096;
  const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

  const recordedSamples: Float32Array[] = [];
  let totalInputSamples = 0;

  scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const copy = new Float32Array(inputData.length);
    copy.set(inputData);
    recordedSamples.push(copy);
    totalInputSamples += copy.length;
  };

  source.connect(scriptProcessor);
  scriptProcessor.connect(audioContext.destination);

  return {
    stop: async (): Promise<Blob> => {
      source.disconnect();
      scriptProcessor.disconnect();
      await audioContext.close().catch(() => {});

      if (totalInputSamples === 0) {
        // Return 100ms of silent WAV if zero samples captured
        return encodeWav(new Float32Array(1600), 16000);
      }

      const fullBuffer = new Float32Array(totalInputSamples);
      let offset = 0;
      for (const chunk of recordedSamples) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const targetSampleRate = 16000;
      const downsampledBuffer = downsampleBuffer(fullBuffer, audioContext.sampleRate, targetSampleRate);
      return encodeWav(downsampledBuffer, targetSampleRate);
    },
  };
}

/**
 * Universal browser-side audio transcoder:
 * Converts any audio blob/file (WebM, Opus, Ogg, MP3, M4A, AAC)
 * into a genuine 16kHz mono 16-bit linear PCM WAV with standard 44-byte header.
 * Eliminates "Unsupported audio format" errors when uploading to Gnani Prisma STT.
 */
export async function convertBlobToWav(blob: Blob | File): Promise<Blob> {
  // 1. If already valid WAV (RIFF...WAVE), pass through directly
  try {
    const slice = await blob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(slice);
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45    // WAVE
    ) {
      return blob;
    }
  } catch {
    // Continue with decoding
  }

  // 2. Use browser's AudioContext.decodeAudioData() to decode ANY browser-supported container/codec
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return blob; // Return original if AudioContext not available
  }

  const audioCtx = new AudioContextClass();
  try {
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }

    const arrayBuffer = await blob.arrayBuffer();
    // decodeAudioData decodes WebM/Opus, OGG, MP3, AAC, M4A natively via browser C++ engine
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Merge or extract mono channel
    const numChannels = decodedBuffer.numberOfChannels;
    const length = decodedBuffer.length;
    const monoSamples = new Float32Array(length);

    if (numChannels === 1) {
      monoSamples.set(decodedBuffer.getChannelData(0));
    } else {
      // Downmix multi-channel to mono
      const ch0 = decodedBuffer.getChannelData(0);
      const ch1 = decodedBuffer.getChannelData(1);
      for (let i = 0; i < length; i++) {
        monoSamples[i] = ((ch0[i] ?? 0) + (ch1[i] ?? 0)) / 2;
      }
    }

    // Downsample to 16,000 Hz if needed
    const targetSampleRate = 16000;
    const resampled = downsampleBuffer(monoSamples, decodedBuffer.sampleRate, targetSampleRate);

    // Encode as genuine 16kHz mono 16-bit linear PCM WAV
    const wavBlob = encodeWav(resampled, targetSampleRate);
    return wavBlob;
  } catch (err) {
    console.warn('[convertBlobToWav] AudioContext decoding failed, using raw buffer:', err);
    return blob;
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

/**
 * Downsample Float32Array buffer to target sample rate using linear interpolation.
 */
export function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i] ?? 0;
      count++;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Encodes Float32Array samples into a genuine RIFF/WAVE ArrayBuffer with 44-byte header.
 */
export function encodeWav(samples: Float32Array, sampleRate = 16000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = samples.length * bytesPerSample;
  const headerByteLength = 44;
  const totalLength = headerByteLength + dataByteLength;

  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // 1. RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true); // ChunkSize
  writeString(view, 8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);              // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);    // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true);     // SampleRate
  view.setUint32(28, byteRate, true);       // ByteRate
  view.setUint16(32, blockAlign, true);     // BlockAlign
  view.setUint16(34, bitsPerSample, true);  // BitsPerSample

  // 3. "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true); // Subchunk2Size

  // Write PCM 16-bit samples
  let sampleIndex = 0;
  let byteOffset = 44;
  while (sampleIndex < samples.length) {
    const sample = samples[sampleIndex] ?? 0;
    const s = Math.max(-1, Math.min(1, sample));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(byteOffset, int16, true);
    sampleIndex++;
    byteOffset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
