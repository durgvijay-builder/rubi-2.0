import React from 'react';
import { Sparkles, Edit3 } from 'lucide-react';

interface TranscriptionEditorProps {
  transcript: string;
  wordCount: number;
  confidence: number | null;
  isExtracting: boolean;
  onTranscriptChange: (text: string) => void;
  onExtractActions: () => void;
}

export const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
  transcript,
  wordCount,
  confidence,
  isExtracting,
  onTranscriptChange,
  onExtractActions,
}) => {
  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
      {/* Header bar with confidence & hint */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Conversation Transcript</h3>
        </div>

        <div className="flex items-center gap-2">
          {confidence !== null && (
            <div
              data-testid="stt-confidence-badge"
              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
            >
              <span data-testid="confidence-score">STT Confidence: {Math.round(confidence * 100)}%</span>
            </div>
          )}
          <span
            data-testid="transcript-word-count"
            className="text-xs text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full"
          >
            <span data-testid="word-count">{wordCount} words</span>
          </span>
        </div>
      </div>

      <div data-testid="edit-hint-text" className="text-xs text-slate-400">
        Review and edit the transcription before extracting structured tasks.
      </div>

      {/* Editable Textarea */}
      <textarea
        data-testid="transcription-editor"
        name="transcript"
        rows={4}
        value={transcript}
        onChange={(e) => onTranscriptChange(e.target.value)}
        placeholder="Spoken conversation will appear here, or type/paste English, Hindi, or Hinglish notes..."
        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[110px]"
      />

      {/* Extract Actions Button */}
      <div className="flex justify-end pt-1">
        <button
          data-testid="extract-actions-btn"
          disabled={!transcript.trim() || isExtracting}
          onClick={onExtractActions}
          className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm inline-flex items-center gap-2 shadow-md transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span>{isExtracting ? 'Extracting Actions...' : 'Extract Actions'}</span>
        </button>
      </div>
    </div>
  );
};
