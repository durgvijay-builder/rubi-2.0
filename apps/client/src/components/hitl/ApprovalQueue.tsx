import React, { useState } from 'react';
import { CheckCheck, Trash2, AlertTriangle, AlertCircle, Cpu } from 'lucide-react';
import { ActionEditor } from './ActionEditor.js';
import { DiscardModal } from './DiscardModal.js';
import type { CandidateTask } from '../../lib/apiClient.js';

interface ApprovalQueueProps {
  candidates: CandidateTask[];
  summary?: string;
  ambiguities: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
  tokensTelemetry: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  isApproving?: boolean;
  onUpdateCandidate: (tempId: string, updates: Partial<CandidateTask>) => void;
  onApproveSingle: (tempId: string) => void;
  onRejectSingle: (tempId: string) => void;
  onBatchApprove: () => void;
  onDiscardAll: () => void;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({
  candidates,
  summary,
  ambiguities,
  hasCycle,
  cycleNodes,
  tokensTelemetry,
  isApproving = false,
  onUpdateCandidate,
  onApproveSingle,
  onRejectSingle,
  onBatchApprove,
  onDiscardAll,
}) => {
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  if (candidates.length === 0) {
    return null;
  }

  const costFormatted = (tokensTelemetry.estimatedCostUsd || 0).toFixed(5);
  const totalTokens = tokensTelemetry.totalTokens || 0;

  return (
    <section
      data-testid="hitl-review-deck"
      aria-label="Action items review"
      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 animate-in fade-in"
    >
      {/* Header bar: Title & Telemetry Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            Action Items Review (HITL)
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              {candidates.length} {candidates.length === 1 ? 'task' : 'tasks'} staged
            </span>
          </h2>
          {summary && <p className="text-xs text-slate-400 mt-0.5">{summary}</p>}
        </div>

        {/* Token and Cost Telemetry Badge */}
        <div
          data-testid="tokens-telemetry-badge"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-xs font-medium text-slate-300 shadow-sm"
        >
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {totalTokens} tokens (${costFormatted} USD)
          </span>
        </div>
      </div>

      {/* DAG Circular Dependency Alert Banner */}
      {hasCycle && (
        <div
          data-testid="cycle-error-banner"
          role="alert"
          className="bg-red-950/80 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Circular dependency detected!</strong>
            <span>
              Circular prerequisite detected: Task Alpha cannot depend on Task Beta while Task Beta depends on Task Alpha.
              Batch approval is disabled until circular references are resolved.
            </span>
            {cycleNodes && cycleNodes.length > 0 && (
              <span className="block mt-1 font-mono text-xs text-red-300">
                Involved nodes: {cycleNodes.join(' ↔ ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ambiguity Warning Banner */}
      {ambiguities && ambiguities.length > 0 && (
        <div
          data-testid="ambiguity-warning"
          role="alert"
          className="bg-amber-950/70 border border-amber-700 text-amber-200 px-4 py-3 rounded-lg text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Ambiguity detected:</strong>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5">
              {ambiguities.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Candidate Cards List */}
      <div className="flex flex-col gap-3">
        {candidates.map((task, index) => (
          <ActionEditor
            key={task.tempId || index}
            task={task}
            index={index}
            onUpdate={onUpdateCandidate}
            onApprove={onApproveSingle}
            onReject={onRejectSingle}
          />
        ))}
      </div>

      {/* Batch Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
        <button
          type="button"
          data-testid="discard-all-btn"
          onClick={() => setShowDiscardModal(true)}
          className="min-h-[44px] min-w-[44px] w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>Discard All</span>
        </button>

        <button
          type="button"
          data-testid="batch-approve-btn"
          disabled={hasCycle || Boolean(isApproving)}
          onClick={onBatchApprove}
          className="min-h-[44px] min-w-[44px] w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Approve All Valid Tasks</span>
        </button>
      </div>

      <DiscardModal
        isOpen={showDiscardModal}
        onConfirm={() => {
          setShowDiscardModal(false);
          onDiscardAll();
        }}
        onCancel={() => setShowDiscardModal(false)}
      />
    </section>
  );
};
