import React from 'react';
import { Loader2, Mic, Upload, FileText, Brain, CheckCircle2 } from 'lucide-react';
import type { ProcessingState as ProcessingStateType } from '../../hooks/useVoicePipeline.js';

interface ProcessingStateProps {
  currentState: ProcessingStateType;
}

const STATE_CONFIG: Record<
  ProcessingStateType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  idle: {
    label: 'Ready / Idle',
    icon: CheckCircle2,
    color: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  recording: {
    label: 'Recording Audio...',
    icon: Mic,
    color: 'bg-red-950/80 text-red-300 border-red-700 animate-pulse',
  },
  uploading: {
    label: 'Uploading Audio...',
    icon: Upload,
    color: 'bg-amber-950/80 text-amber-300 border-amber-700',
  },
  transcribing: {
    label: 'Transcribing Speech (Gnani STT)...',
    icon: FileText,
    color: 'bg-blue-950/80 text-blue-300 border-blue-700',
  },
  understanding: {
    label: 'Understanding Intent (Gemini AI)...',
    icon: Brain,
    color: 'bg-purple-950/80 text-purple-300 border-purple-700',
  },
  awaiting_approval: {
    label: 'Awaiting Human Approval (HITL)...',
    icon: CheckCircle2,
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-700',
  },
};

export const ProcessingState: React.FC<ProcessingStateProps> = ({ currentState }) => {
  const config = STATE_CONFIG[currentState] || STATE_CONFIG.idle;
  const Icon = config.icon;
  const isBusy = currentState !== 'idle' && currentState !== 'awaiting_approval';

  return (
    <div
      data-testid={`processing-state-${currentState}`}
      data-state={currentState}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${config.color}`}
    >
      {isBusy ? (
        <Loader2 data-testid="global-spinner" className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      <span>{config.label}</span>
    </div>
  );
};
