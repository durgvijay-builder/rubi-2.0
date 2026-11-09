import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../lib/apiClient.js';
import { formatDuration } from '../lib/utils.js';
import { startWavRecording, convertBlobToWav, type WavRecorderHandle } from '../lib/wavRecorder.js';

export type ProcessingState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'understanding'
  | 'awaiting_approval';

export interface UseVoicePipelineOptions {
  onExtractionReady?: (data: any) => void;
}

export function useVoicePipeline(_options?: UseVoicePipelineOptions) {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  const [ttsSpokenText, setTtsSpokenText] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wavHandleRef = useRef<WavRecorderHandle | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Clear timer helper
  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const processTranscription = async (blob: Blob) => {
    setProcessingState('uploading');
    try {
      // Transcode any recorded audio format to genuine 16kHz mono WAV for Gnani Prisma STT
      const wavBlob = await convertBlobToWav(blob);
      setProcessingState('transcribing');
      const result = await apiClient.transcribeAudio(wavBlob);
      const text = result.transcript || result.text || '';
      setTranscript(text);
      setConfidence(result.confidence ?? 0.95);
      setDetectedLanguage(result.language || 'en');
    } catch (err) {
      setAudioError((err as Error).message);
    } finally {
      setProcessingState('idle');
    }
  };

  // Start Voice Recording
  const startRecording = useCallback(async () => {
    setAudioError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;

      // Try genuine 16kHz mono WAV recording via Web Audio API first
      try {
        const wavHandle = await startWavRecording(stream);
        wavHandleRef.current = wavHandle;
        mediaRecorderRef.current = null;
      } catch (wavErr) {
        // Fallback to MediaRecorder if AudioContext is unavailable
        audioChunksRef.current = [];
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          } else {
            mimeType = '';
          }
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          await processTranscription(audioBlob);
        };

        recorder.start(250);
      }

      setIsRecording(true);
      setRecordingSeconds(1);
      setProcessingState('recording');

      let secs = 1;
      timerIntervalRef.current = setInterval(() => {
        secs += 1;
        setRecordingSeconds(secs);
      }, 1000);
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone access was denied. Please allow microphone permissions or upload an audio file.'
        : err.message || 'Failed to start recording';
      setAudioError(msg);
      setProcessingState('idle');
      setIsRecording(false);
      stopTimer();
    }
  }, []);

  // Stop Voice Recording
  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    stopTimer();

    // If using WAV recorder
    if (wavHandleRef.current) {
      const handle = wavHandleRef.current;
      wavHandleRef.current = null;
      try {
        const wavBlob = await handle.stop();
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach((track) => track.stop());
          activeStreamRef.current = null;
        }
        await processTranscription(wavBlob);
      } catch (err) {
        setAudioError((err as Error).message);
        setProcessingState('idle');
      }
      return;
    }

    // If using MediaRecorder fallback
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // File Upload Fallback
  const handleFileUpload = useCallback(async (file: File) => {
    setAudioError(null);

    // Boundary check 1: 25MB file size limit (TC-BOUND-02)
    if (file.size > 25 * 1024 * 1024) {
      setAudioError('Audio file exceeds the maximum allowed size of 25MB.');
      return;
    }

    // Boundary check 2: Unsupported media formats (TC-BOUND-03)
    const validExtensions = ['.wav', '.mp3', '.webm', '.ogg', '.m4a'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const isAudioType = file.type.startsWith('audio/') || file.type === 'application/ogg';

    if (!hasValidExt && !isAudioType) {
      setAudioError('Only WAV, MP3, WebM, and OGG audio formats are supported.');
      return;
    }

    setProcessingState('uploading');
    try {
      // Transcode uploaded audio to genuine 16kHz mono WAV for Gnani Prisma STT
      const wavBlob = await convertBlobToWav(file);
      setProcessingState('transcribing');
      const result = await apiClient.transcribeAudio(wavBlob);
      const text = result.transcript || result.text || '';
      setTranscript(text);
      setConfidence(result.confidence ?? 0.95);
      setDetectedLanguage(result.language || 'en');
    } catch (err) {
      setAudioError((err as Error).message);
    } finally {
      setProcessingState('idle');
    }
  }, []);

  // Spoken TTS Confirmation
  const playConfirmation = useCallback(async (text: string) => {
    try {
      setTtsSpokenText(text);
      const result = await apiClient.synthesizeSpeech(text);
      if (result.audioBase64) {
        setTtsAudioUrl(`data:${result.mimeType || 'audio/wav'};base64,${result.audioBase64}`);
      } else if (result.audioUrl) {
        setTtsAudioUrl(result.audioUrl);
      } else {
        // Stream binary url directly
        setTtsAudioUrl(`/api/speech/synthesize?text=${encodeURIComponent(text)}`);
      }
    } catch (err) {
      console.warn('TTS playback error:', err);
    }
  }, []);

  const formattedTimer = formatDuration(recordingSeconds);
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return {
    processingState,
    setProcessingState,
    isRecording,
    recordingSeconds,
    formattedTimer,
    audioError,
    setAudioError,
    transcript,
    setTranscript,
    wordCount,
    confidence,
    detectedLanguage,
    ttsSpokenText,
    setTtsSpokenText,
    ttsAudioUrl,
    setTtsAudioUrl,
    startRecording,
    stopRecording,
    handleFileUpload,
    playConfirmation,
  };
}
