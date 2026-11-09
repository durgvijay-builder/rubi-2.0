import React, { useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DiscardModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="w-10 h-10 rounded-full bg-amber-950/60 border border-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-base">Discard All Extracted Tasks?</h3>
            <p className="text-xs text-slate-400">This will clear the staged review queue without saving to database.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium inline-flex items-center gap-1.5 shadow"
          >
            <Trash2 className="w-4 h-4" />
            <span>Confirm Discard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
