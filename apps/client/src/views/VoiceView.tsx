import React, { useRef, useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic,
  MicOff,
  UploadCloud,
  Volume2,
  AlertCircle,
  FileText,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Radio,
} from 'lucide-react';
import { useNavigate } from 'react-router';

export const VoiceView: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualInputOpen, setManualInputOpen] = useState(false);

  const {
    processingState,
    isRecording,
    formattedTimer,
    audioError,
    transcript,
    setTranscript,
    wordCount,
    confidence,
    detectedLanguage,
    ttsAudioUrl,
    startRecording,
    stopRecording,
    handleFileUpload,
    extractFromTranscript,
    isExtracting,
    health,
  } = useAppState();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleExtract = async () => {
    const success = await extractFromTranscript();
    if (success) {
      navigate('/approvals');
    }
  };

  // Phase 9: Global Spacebar Voice Recording Shortcut with strict Focus/Dialog guards
  React.useEffect(() => {
    const isEditingText = (el: Element | null): boolean => {
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.getAttribute('contenteditable') === 'true') return true;
      if (el.closest('[role="dialog"]') || el.closest('[data-modal]')) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        if (isEditingText(document.activeElement)) return;
        e.preventDefault();
        if (!isRecording) {
          startRecording();
        } else {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, startRecording, stopRecording]);

  const isLive = health?.mode === 'live';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Studio Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Voice Intelligence Studio
          </Badge>
          <span className="font-mono text-[11px] text-[#85858b]">
            {isLive ? 'PRISMA STT + GEMINI 2.5 LIVE' : 'DETERMINISTIC MOCK ENGINE'}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed]">
          Voice capture and transcription
        </h1>
        <p className="text-xs sm:text-sm text-[#85858b]">
          Dictate standups or operational instructions in English, Hindi, or Hinglish
        </p>
      </div>

      {/* Signal Pipeline Stepper */}
      <div className="rounded-xl border border-border/80 bg-[#19191b] p-3">
        <div className="flex sm:grid sm:grid-cols-5 gap-1.5 overflow-x-auto no-scrollbar text-center text-xs pb-0.5">
          {[
            { id: 'recording', num: '01', label: 'Capture', desc: 'Audio stream' },
            { id: 'uploading', num: '02', label: 'Buffer', desc: 'WAV chunk' },
            { id: 'transcribing', num: '03', label: 'Prisma STT', desc: 'Speech model' },
            { id: 'understanding', num: '04', label: 'Gemini DAG', desc: 'Schema extract' },
            { id: 'awaiting_approval', num: '05', label: 'Human Gate', desc: 'Review staged' },
          ].map((stage) => {
            const isActive = processingState === stage.id || (stage.id === 'understanding' && isExtracting);
            return (
              <div
                key={stage.id}
                className={`p-2 rounded-lg transition-colors border shrink-0 sm:shrink min-w-[96px] sm:min-w-0 ${
                  isActive
                    ? 'bg-[#232325] text-[#ededed] border-border/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent text-[#85858b]'
                }`}
              >
                <div className="font-mono text-[10px] text-[#85858b]">{stage.num}</div>
                <div className="font-medium text-xs whitespace-nowrap">{stage.label}</div>
                <div className="text-[10px] text-[#85858b] whitespace-nowrap">{stage.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {audioError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 flex items-start gap-3 text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">Audio capture notice</p>
            <p className="text-rose-300/80 mt-0.5">{audioError}</p>
          </div>
        </div>
      )}

      {/* Main Studio Deck Console with Tactile Capsule Object */}
      <Card className="border-border/80 bg-[#19191b] overflow-hidden">
        <CardContent className="p-5 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Visual Capsule Object (Moment 1) */}
            <div className="relative shrink-0 flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 bg-[#141415] rounded-xl border border-border/60 overflow-hidden mx-auto md:mx-0">
              <img
                src="/assets/studio-recorder-capsule.jpg"
                alt="Studio field recorder microphone capsule"
                className="w-full h-full object-cover studio-mask"
                width={176}
                height={176}
                loading="eager"
              />
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/10 font-mono text-[10px] text-[#85858b]">
                <span className={`h-1.5 w-1.5 rounded-full ${isRecording ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                <span>{isRecording ? 'REC' : 'STANDBY'}</span>
              </div>
            </div>

            {/* Deck Controls & Timecode */}
            <div className="flex-1 space-y-4 text-center md:text-left w-full">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="font-mono text-xs text-[#85858b]">TIMECODE</span>
                  {detectedLanguage && (
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#232325] text-[#a1a1a6]">
                      {detectedLanguage.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-medium tracking-tight text-[#ededed] tabular-nums">
                  {isRecording ? formattedTimer : '00:00'}
                </div>
                <p className="text-xs text-[#85858b]">
                  {isRecording
                    ? 'Recording voice buffer — speak naturally in English, Hindi, or Hinglish'
                    : processingState === 'transcribing'
                    ? 'Transcribing audio buffer with Prisma STT'
                    : processingState === 'uploading'
                    ? 'Uploading audio chunk to engine'
                    : 'Click record or press Space to capture speech'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1 w-full">
                <Button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`h-10 px-4 text-xs font-medium gap-2 w-full xs:w-auto ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-[#ededed] hover:bg-white text-[#141415]'
                  }`}
                  aria-label={isRecording ? 'Stop recording audio' : 'Start microphone recording'}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span>Stop recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>Record voice</span>
                    </>
                  )}
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".wav,.mp3,.webm,.ogg,.m4a"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 text-xs gap-2 w-full xs:w-auto"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-[#85858b]" />
                  <span>Upload audio</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setManualInputOpen(!manualInputOpen)}
                  className="h-10 text-xs gap-1.5 text-[#85858b] hover:text-[#ededed] w-full xs:w-auto"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{manualInputOpen ? 'Hide editor' : 'Type instead'}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transcript & Extraction Card */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>Spoken transcript</span>
                {transcript && (
                  <span className="font-mono text-xs text-[#85858b] tabular-nums font-normal">
                    {wordCount} words
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Inspect transcribed speech before semantic task extraction
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {confidence !== null && (
                <span className="font-mono text-xs text-[#85858b] tabular-nums">
                  {Math.round(confidence * 100)}% conf
                </span>
              )}
              {transcript && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTranscript('')}
                  className="h-7 text-xs text-[#85858b] hover:text-[#ededed] gap-1 px-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <Textarea
            value={transcript}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTranscript(e.target.value)}
            placeholder="Spoken transcript will appear here automatically. You can also paste or type meeting notes directly..."
            rows={5}
            className="font-sans text-sm leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[#85858b] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#4cc38a]" />
              <span>Silence never implies consent: all tasks require explicit review</span>
            </div>

            <Button
              type="button"
              disabled={!transcript.trim() || isExtracting}
              onClick={handleExtract}
              className="w-full sm:w-auto bg-ruby-600 hover:bg-ruby-500 text-white font-medium gap-2 h-10 px-5 text-xs"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Extracting tasks...</span>
                </>
              ) : (
                <>
                  <span>Extract tasks</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Spoken Confirmation */}
      {ttsAudioUrl && (
        <Card className="border-border/80 bg-[#19191b]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Volume2 className="h-4 w-4 text-[#85858b]" />
              <span>Spoken confirmation (Gnani Timbre TTS)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <audio controls src={ttsAudioUrl} className="w-full h-9 mt-1" autoPlay />
            <p className="text-[11px] text-[#85858b]">
              Auditory feedback synthesised via Gnani Timbre neural speech synthesis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
