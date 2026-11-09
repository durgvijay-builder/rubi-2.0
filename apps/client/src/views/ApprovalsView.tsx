import React, { useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Coins,
  ArrowRight,
  Layers,
  Calendar,
  Clock,
  Bell,
  Tag,
  CheckSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';

const PRESET_CATEGORIES = ['College', 'Self learning', 'Side hustle', 'Channel', 'Ghar ka!'];
const SLOT_OPTIONS = [
  'Not decided',
  'Morning',
  'Afternoon',
  'After College',
  'Before dinner',
  'After dinner',
  'Night',
];

export const ApprovalsView: React.FC = () => {
  const {
    stagedCandidates,
    extractionSummary,
    ambiguities,
    hasCycle,
    cycleNodes,
    tokensTelemetry,
    updateCandidate,
    approveSingleCandidate,
    rejectSingleCandidate,
    batchApproveCandidates,
    discardAllCandidates,
    isApproving,
    categories: customCategories,
  } = useAppState();

  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});

  // Merge default categories with workspace custom categories
  const allCategoryNames = Array.from(
    new Set([...PRESET_CATEGORIES, ...(customCategories?.map((c) => c.name) || [])])
  );

  const toggleCategory = (tempId: string, currentCategories: string[] = [], cat: string) => {
    const next = currentCategories.includes(cat)
      ? currentCategories.filter((c) => c !== cat)
      : [...currentCategories, cat];
    updateCandidate(tempId, { categories: next });
  };

  const handleAddSubtask = (tempId: string, currentSubtasks: any[] = []) => {
    const inputVal = newSubtaskInputs[tempId]?.trim();
    if (!inputVal) return;

    const nextSubtasks = [
      ...currentSubtasks,
      { title: inputVal, isCompleted: false, order: currentSubtasks.length },
    ];
    updateCandidate(tempId, { subtasks: nextSubtasks });
    setNewSubtaskInputs((prev) => ({ ...prev, [tempId]: '' }));
  };

  const handleToggleSubtask = (tempId: string, currentSubtasks: any[] = [], index: number) => {
    const nextSubtasks = currentSubtasks.map((st, i) => {
      const itemObj = typeof st === 'string' ? { title: st, isCompleted: false, order: i } : { ...st };
      if (i === index) {
        return { ...itemObj, isCompleted: !itemObj.isCompleted };
      }
      return itemObj;
    });
    updateCandidate(tempId, { subtasks: nextSubtasks });
  };

  const handleRemoveSubtask = (tempId: string, currentSubtasks: any[] = [], index: number) => {
    const nextSubtasks = currentSubtasks.filter((_, i) => i !== index);
    updateCandidate(tempId, { subtasks: nextSubtasks });
  };

  // Convert UTC ISO to datetime-local string (YYYY-MM-DDTHH:mm)
  const toLocalInputValue = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const fromLocalInputValue = (localString: string): string | null => {
    if (!localString) return null;
    try {
      const d = new Date(localString);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-xs">
              Personal Review Gate
            </Badge>
            <span className="font-mono text-xs text-[#85858b] tabular-nums">
              {stagedCandidates.length} candidate{stagedCandidates.length === 1 ? '' : 's'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed] mt-1">
            Personal task approvals & staging
          </h1>
          <p className="text-xs sm:text-sm text-[#85858b]">
            Review extracted personal workload, edit categories, effort, schedule, and checklist items before saving to database
          </p>
        </div>

        {stagedCandidates.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscardModalOpen(true)}
              disabled={isApproving}
              className="text-xs text-[#e5484d] hover:text-white hover:bg-rose-950/40 h-9"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              <span>Discard all</span>
            </Button>

            <Button
              size="sm"
              onClick={batchApproveCandidates}
              disabled={isApproving || hasCycle}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-4"
              title={hasCycle ? 'Resolve circular dependency before batch approving' : undefined}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              <span>{isApproving ? 'Saving...' : 'Approve all candidates'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Extraction Telemetry Summary */}
      {extractionSummary && (
        <Card className="border-border/80 bg-[#19191b]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-[#85858b] flex items-center justify-between">
              <span className="text-[#ededed] font-medium">Extraction summary</span>
              {tokensTelemetry && tokensTelemetry.totalTokens > 0 && (
                <span className="font-mono text-[11px] text-[#85858b] tabular-nums">
                  {tokensTelemetry.totalTokens} tokens · ${tokensTelemetry.estimatedCostUsd.toFixed(5)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs sm:text-sm text-[#a1a1a6] leading-relaxed">
              {extractionSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cycle Detection Warning (Kahn's DAG Algorithm) */}
      {hasCycle && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-rose-300">Circular dependency detected</p>
            <p className="text-rose-300/80 leading-relaxed">
              Kahn topological sort identified a circular loop:
              <span className="font-mono font-normal ml-1 bg-black/40 px-1.5 py-0.5 rounded text-white">
                {cycleNodes.join(' → ') || 'Cycle detected'}
              </span>
              . Break the circular dependency to enable batch approval.
            </p>
          </div>
        </div>
      )}

      {/* Ambiguities Alert */}
      {ambiguities && ambiguities.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <HelpCircle className="h-4 w-4" />
            <span>AI flagged {ambiguities.length} ambiguity question{ambiguities.length > 1 ? 's' : ''}</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-300/80 space-y-1 pl-1">
            {ambiguities.map((amb, i) => (
              <li key={i}>{amb}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Candidate Task List / Empty State */}
      {stagedCandidates.length === 0 ? (
        <div className="rounded-xl border border-border/80 p-8 sm:p-12 text-center space-y-4 bg-[#19191b]">
          <div className="relative mx-auto w-32 h-32 sm:w-36 sm:h-36 rounded-xl bg-[#141415] border border-border/60 overflow-hidden flex items-center justify-center">
            <img
              src="/assets/human-gate-interlock.jpg"
              alt="Console safety interlock switch resting in locked state"
              className="w-full h-full object-cover studio-mask"
              width={144}
              height={144}
              loading="eager"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/10 font-mono text-[10px] text-[#85858b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4cc38a]" />
              <span>GATE EMPTY</span>
            </div>
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-medium text-[#ededed]">
              Zero candidate tasks awaiting review
            </h3>
            <p className="text-xs text-[#85858b] leading-relaxed">
              Every personal task extracted from your voice or text is staged here for review before saving to PostgreSQL
            </p>
          </div>

          <div className="pt-1">
            <Link to="/voice">
              <Button size="sm" className="bg-[#ededed] hover:bg-white text-[#141415] text-xs h-9 px-4 gap-1.5">
                <span>Record voice instructions</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {stagedCandidates.map((candidate: any) => {
            const candidateCategories: string[] = Array.isArray(candidate.categories)
              ? candidate.categories
              : [];
            const subtasksList: any[] = Array.isArray(candidate.subtasks)
              ? candidate.subtasks
              : [];

            return (
              <Card
                key={candidate.tempId}
                className={`border-border/80 bg-[#19191b] transition-colors ${
                  candidate.cycleError ? 'border-rose-500/40 bg-rose-500/5' : ''
                }`}
              >
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Header row: Status tag, Cycle warning, Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-[#85858b] font-normal">
                        #{candidate.tempId}
                      </span>
                      {candidate.isRoutine && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                          <RotateCcw className="h-2.5 w-2.5" />
                          <span>Routine ({candidate.recurrencePattern || 'DAILY'})</span>
                        </span>
                      )}
                      {candidate.reminderTime && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Bell className="h-2.5 w-2.5" />
                          <span>With Reminder</span>
                        </span>
                      )}
                      {candidate.cycleError && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-[#e5484d] border border-rose-500/20">
                          Cycle conflict
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rejectSingleCandidate(candidate.tempId)}
                        disabled={isApproving}
                        className="text-xs text-[#e5484d] hover:bg-rose-500/10 h-8 px-2.5"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        <span>Reject</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => approveSingleCandidate(candidate.tempId)}
                        disabled={isApproving || Boolean(candidate.cycleError)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 font-normal"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        <span>Approve</span>
                      </Button>
                    </div>
                  </div>

                  {/* Editable Title */}
                  <div className="space-y-1">
                    <label className="text-xs text-[#85858b]">
                      Task title
                    </label>
                    <Input
                      value={candidate.title}
                      onChange={(e: any) =>
                        updateCandidate(candidate.tempId, { title: e.target.value })
                      }
                      className="font-normal text-xs sm:text-sm h-9"
                      placeholder="e.g. Machine learning session"
                    />
                  </div>

                  {/* Editable Description */}
                  <div className="space-y-1">
                    <label className="text-xs text-[#85858b]">
                      Description / Notes
                    </label>
                    <Textarea
                      value={candidate.description || ''}
                      onChange={(e: any) =>
                        updateCandidate(candidate.tempId, { description: e.target.value })
                      }
                      rows={2}
                      className="text-xs"
                      placeholder="Details, chapters, or original transcript notes"
                    />
                  </div>

                  {/* Categories Multi-Select Pills */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#85858b] flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      <span>Categories</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {allCategoryNames.map((catName) => {
                        const isSelected = candidateCategories.includes(catName);
                        return (
                          <button
                            key={catName}
                            type="button"
                            onClick={() => toggleCategory(candidate.tempId, candidateCategories, catName)}
                            className={`px-2.5 py-1 rounded-md text-xs font-normal border transition-colors ${
                              isSelected
                                ? 'bg-primary/20 border-primary text-primary-foreground'
                                : 'bg-[#232325] border-border/80 text-[#85858b] hover:text-[#ededed]'
                            }`}
                          >
                            {isSelected && <span className="mr-1">✓</span>}
                            {catName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Personal Workload Grid: Priority, Effort Level, Slot */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b]">
                        Priority
                      </label>
                      <select
                        value={candidate.priority || 'MEDIUM'}
                        onChange={(e: any) =>
                          updateCandidate(candidate.tempId, {
                            priority: e.target.value as any,
                          })
                        }
                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-border/80 bg-[#232325] text-[#ededed]"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b]">
                        Effort Level
                      </label>
                      <select
                        value={candidate.effort || 'MEDIUM'}
                        onChange={(e: any) =>
                          updateCandidate(candidate.tempId, {
                            effort: e.target.value as any,
                          })
                        }
                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-border/80 bg-[#232325] text-[#ededed]"
                      >
                        <option value="SMALL">SMALL (Quick win)</option>
                        <option value="MEDIUM">MEDIUM (Standard)</option>
                        <option value="LARGE">LARGE (Deep focus)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b]">
                        Time Slot
                      </label>
                      <select
                        value={candidate.slot || 'Not decided'}
                        onChange={(e: any) =>
                          updateCandidate(candidate.tempId, {
                            slot: e.target.value,
                          })
                        }
                        className="w-full h-9 px-2.5 text-xs rounded-lg border border-border/80 bg-[#232325] text-[#ededed]"
                      >
                        {SLOT_OPTIONS.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date & Time Grid: Schedule vs. Deadline vs. Reminder (Independent Controls) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b] flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-sky-400" />
                        <span>Schedule (When to do)</span>
                      </label>
                      <Input
                        type="datetime-local"
                        value={toLocalInputValue(candidate.schedule || candidate.scheduledStart)}
                        onChange={(e: any) => {
                          const iso = fromLocalInputValue(e.target.value);
                          updateCandidate(candidate.tempId, {
                            schedule: iso,
                            scheduledStart: iso,
                          });
                        }}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b] flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-400" />
                        <span>Deadline (Must finish by)</span>
                      </label>
                      <Input
                        type="datetime-local"
                        value={toLocalInputValue(candidate.deadline)}
                        onChange={(e: any) => {
                          const iso = fromLocalInputValue(e.target.value);
                          updateCandidate(candidate.tempId, { deadline: iso });
                        }}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#85858b] flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-amber-400" />
                        <span>Reminder Time</span>
                      </label>
                      <Input
                        type="datetime-local"
                        value={toLocalInputValue(candidate.reminderTime)}
                        onChange={(e: any) => {
                          const iso = fromLocalInputValue(e.target.value);
                          updateCandidate(candidate.tempId, { reminderTime: iso });
                        }}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Subtasks Checklist */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <label className="text-xs text-[#85858b] flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Subtasks ({subtasksList.length})</span>
                    </label>

                    {subtasksList.length > 0 && (
                      <div className="space-y-1.5">
                        {subtasksList.map((st, idx) => {
                          const isDone = typeof st === 'object' ? Boolean(st.isCompleted) : false;
                          const title = typeof st === 'string' ? st : st.title;
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#232325] text-xs"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => handleToggleSubtask(candidate.tempId, subtasksList, idx)}
                                  className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-emerald-500"
                                />
                                <span className={isDone ? 'line-through text-[#85858b] truncate' : 'text-[#ededed] truncate'}>
                                  {title}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveSubtask(candidate.tempId, subtasksList, idx)}
                                className="h-6 w-6 p-0 text-[#85858b] hover:text-[#e5484d]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Subtask Input */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newSubtaskInputs[candidate.tempId] || ''}
                        onChange={(e) =>
                          setNewSubtaskInputs((prev) => ({
                            ...prev,
                            [candidate.tempId]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask(candidate.tempId, subtasksList);
                          }
                        }}
                        placeholder="Add a checklist item (press Enter)"
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSubtask(candidate.tempId, subtasksList)}
                        className="h-8 px-2 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        <span>Add</span>
                      </Button>
                    </div>
                  </div>

                  {/* Dependencies DAG Links */}
                  {candidate.dependencies && candidate.dependencies.length > 0 && (
                    <div className="pt-1 flex items-center gap-2 text-xs text-[#85858b]">
                      <Layers className="h-3.5 w-3.5" />
                      <span>Depends on:</span>
                      <div className="flex flex-wrap gap-1">
                        {candidate.dependencies.map((dep: any) => (
                          <span
                            key={dep}
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#232325] text-[#a1a1a6] border border-border/60"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Discard All Confirmation Modal */}
      <Dialog open={discardModalOpen} onOpenChange={setDiscardModalOpen}>
        <DialogContent className="bg-[#19191b] border-border/80">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-[#ededed]">Discard staged candidates</DialogTitle>
            <DialogDescription className="text-xs text-[#85858b]">
              This will remove all {stagedCandidates.length} candidate tasks currently in the staging queue. No changes will be made to your database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDiscardModalOpen(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                discardAllCandidates();
                setDiscardModalOpen(false);
              }}
              className="text-xs h-9"
            >
              Discard all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
