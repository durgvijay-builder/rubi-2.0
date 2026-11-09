import React, { useRef, useState, useEffect } from 'react';
import { Mic, Square, Upload, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
  isRecording: boolean;
  formattedTimer: string;
  audioError: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onFileUpload: (file: File) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  formattedTimer,
  audioError,
  onStartRecording,
  onStopRecording,
  onFileUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated visualizer waveform when recording
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.lineWidth = 2;
      ctx.strokeStyle = isRecording ? '#ef4444' : '#64748b';
      ctx.beginPath();

      const numPoints = 30;
      for (let i = 0; i < numPoints; i++) {
        const x = (i / (numPoints - 1)) * width;
        let y = centerY;
        if (isRecording) {
          const amplitude = Math.sin((i * 0.4) + (step * 0.15)) * (height * 0.35);
          y = centerY + amplitude;
        }
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      step += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRecording]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]!;
      onFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]!;
      onFileUpload(file);
    }
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col gap-4">
      {/* Error banner if recording or upload failed */}
      {audioError && (
        <div
          data-testid="audio-error-banner"
          role="alert"
          className="bg-red-950/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span className="leading-snug">{audioError}</span>
        </div>
      )}

      {/* Main Recording Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              data-testid="record-toggle-btn"
              aria-label="Start recording"
              onClick={onStartRecording}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium text-sm inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <Mic className="w-4 h-4" />
              <span>Record Voice</span>
            </button>
          ) : (
            <button
              data-testid="stop-record-btn"
              aria-label="Stop recording"
              onClick={onStopRecording}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-medium text-sm inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 animate-pulse focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Stop Recording</span>
            </button>
          )}

          <div className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Duration</span>
            <div
              data-testid="record-timer"
              className="font-mono text-lg font-bold text-slate-200"
            >
              <span data-testid="recording-duration">{formattedTimer}</span>
            </div>
          </div>
        </div>

        {/* Waveform Canvas Visualizer */}
        <div className="w-full sm:w-48 h-10 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            data-testid="audio-waveform"
            className="waveform w-full h-full rounded"
            width={192}
            height={40}
          />
        </div>
      </div>

      {/* Fallback File Upload Dropzone (< 25MB limit) */}
      <div
        data-testid="upload-dropzone"
        role="button"
        tabIndex={0}
        aria-label="Upload audio recording file"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`w-full border-2 border-dashed rounded-lg p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
          isDragOver
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-slate-700 hover:border-slate-500 bg-slate-950/30'
        }`}
      >
        <Upload className="w-6 h-6 text-slate-400" />
        <div className="text-xs sm:text-sm text-slate-300">
          <span className="font-semibold text-blue-400">Click to upload</span> or drag and drop audio file
        </div>
        <div className="text-[11px] text-slate-500">
          WAV, MP3, WebM, or OGG (Maximum file size: 25MB)
        </div>
        <input
          ref={fileInputRef}
          data-testid="audio-file-input"
          type="file"
          accept=".wav,.mp3,.webm,.ogg,audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
