import React, { useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Cpu,
  Eye,
  CheckCircle2,
  AlertCircle,
  Radio,
  RefreshCw,
  Globe,
  Tag,
  Plus,
  Trash2,
  Database,
  Mic,
  Sparkles,
  Volume2,
  Clock,
  Layers,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';
import type { ProviderHealthDetail } from '@/lib/apiClient';

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const SettingsView: React.FC = () => {
  const {
    workspaceId,
    workspace,
    currentUser,
    switchWorkspace,
    health,
    verifyProviders,
    userSettings,
    updateUserSettings,
    categories,
    createCategory,
    deleteCategory,
    reducedMotion,
    setReducedMotion,
  } = useAppState();

  const [isVerifying, setIsVerifying] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3b82f6');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [tzSuccessMessage, setTzSuccessMessage] = useState<string | null>(null);

  // Custom Slots & Reminders State
  const [newSlotName, setNewSlotName] = useState('');
  const [remindersSuccessMsg, setRemindersSuccessMsg] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      await verifyProviders();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDetectBrowserTimezone = async () => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      await updateUserSettings({ timezone: browserTz });
      setTzSuccessMessage(`Detected & updated timezone to ${browserTz}`);
      setTimeout(() => setTzSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to update timezone:', err);
    }
  };

  const handleTimezoneChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const tz = e.target.value;
      await updateUserSettings({ timezone: tz });
      setTzSuccessMessage(`Saved timezone: ${tz}`);
      setTimeout(() => setTzSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Failed to change timezone:', err);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setIsAddingCat(true);
      await createCategory(newCatName.trim(), newCatColor);
      setNewCatName('');
    } catch (err) {
      console.error('Failed to add category:', err);
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSlotName.trim();
    if (!trimmed) return;

    try {
      const currentSlots = userSettings?.customSlots || [];
      if (!currentSlots.includes(trimmed)) {
        const nextSlots = [...currentSlots, trimmed];
        await updateUserSettings({ customSlots: nextSlots });
      }
      setNewSlotName('');
    } catch (err) {
      console.error('Failed to add slot:', err);
    }
  };

  const handleDeleteSlot = async (slotToDelete: string) => {
    try {
      const currentSlots = userSettings?.customSlots || [];
      const nextSlots = currentSlots.filter((s) => s !== slotToDelete);
      await updateUserSettings({ customSlots: nextSlots });
    } catch (err) {
      console.error('Failed to delete slot:', err);
    }
  };

  const handleUpdateReminderSetting = async (key: string, val: any) => {
    try {
      await updateUserSettings({ [key]: val });
      setRemindersSuccessMsg('Reminder preferences updated');
      setTimeout(() => setRemindersSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to update reminder settings:', err);
    }
  };

  const getStatusBadge = (detail?: ProviderHealthDetail) => {
    const status = detail?.status || 'NOT_VERIFIED';
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        );
      case 'AUTHENTICATION_FAILED':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Auth failed
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unavailable
          </span>
        );
      case 'OFFLINE_MOCK':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Offline mock
          </span>
        );
      case 'NOT_VERIFIED':
      default:
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#232325] text-[#85858b] border border-border/80 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#85858b]" />
            Not verified
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#ededed]">
          Settings & personal preferences
        </h1>
        <p className="text-xs sm:text-sm text-[#85858b]">
          Configure timezones, manage categories, verify live provider connectivity, and customize workspace
        </p>
      </div>

      {/* AI & Speech Provider Health Status (Honest Reporting) */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[#85858b]" />
                <span>Provider health & live integration status</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time operational status for Speech, Gemini extraction, and PostgreSQL storage
              </CardDescription>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleVerify}
              disabled={isVerifying}
              className="text-xs h-8 gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying...' : 'Verify Providers'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Database */}
            <div className="p-3.5 rounded-lg border border-border/80 bg-[#141415] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed] flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-emerald-400" />
                  <span>PostgreSQL (Source of truth)</span>
                </span>
                {getStatusBadge(health?.providers?.database)}
              </div>
              <p className="text-[11px] text-[#85858b]">
                {health?.providers?.database?.details || 'Local PostgreSQL rubi_dev running on port 5432'}
              </p>
            </div>

            {/* Google Gemini */}
            <div className="p-3.5 rounded-lg border border-border/80 bg-[#141415] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Google Gemini (Structured AI)</span>
                </span>
                {getStatusBadge(health?.providers?.gemini)}
              </div>
              <p className="text-[11px] text-[#85858b]">
                Model: <span className="font-mono text-zinc-300">{health?.providers?.gemini?.configuredModel || 'gemini-flash-lite-latest'}</span>
                {health?.providers?.gemini?.lastError && (
                  <span className="text-rose-400 block mt-0.5 truncate">{health.providers.gemini.lastError}</span>
                )}
              </p>
            </div>

            {/* Gnani Prisma STT */}
            <div className="p-3.5 rounded-lg border border-border/80 bg-[#141415] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed] flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-sky-400" />
                  <span>Gnani Prisma STT</span>
                </span>
                {getStatusBadge(health?.providers?.stt)}
              </div>
              <p className="text-[11px] text-[#85858b]">
                {health?.providers?.stt?.details || 'Indic Speech Recognition (English, Hindi, Hinglish)'}
                {health?.providers?.stt?.lastError && (
                  <span className="text-rose-400 block mt-0.5 truncate">{health.providers.stt.lastError}</span>
                )}
              </p>
            </div>

            {/* TTS Provider (Gnani Timbre / ElevenLabs) */}
            <div className="p-3.5 rounded-lg border border-border/80 bg-[#141415] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed] flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-violet-400" />
                  <span>{health?.providers?.tts?.name || 'Neural Speech Synthesis (TTS)'}</span>
                </span>
                {getStatusBadge(health?.providers?.tts)}
              </div>
              <p className="text-[11px] text-[#85858b]">
                Model: <span className="font-mono text-zinc-300">{health?.providers?.tts?.configuredModel || 'timbre-v3.0'}</span>
                {health?.providers?.tts?.lastError && (
                  <span className="text-rose-400 block mt-0.5 truncate">{health.providers.tts.lastError}</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Preference (Phase 3) */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#85858b]" />
            <span>Timezone & deadline conversion</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Ensures "Tomorrow at 5 PM" resolves to exactly 5 PM in your local clock without UTC skew
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-[#85858b] block mb-1">
                Active IANA Timezone (Default: Asia/Kolkata)
              </label>
              <select
                value={userSettings?.timezone || 'Asia/Kolkata'}
                onChange={handleTimezoneChange}
                className="w-full h-9 px-2.5 text-xs rounded-lg border border-border/80 bg-[#141415] text-[#ededed] font-mono"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:pt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectBrowserTimezone}
                className="text-xs h-9 gap-1.5 w-full sm:w-auto"
              >
                <Globe className="h-3.5 w-3.5 text-[#85858b]" />
                <span>Detect from Browser</span>
              </Button>
            </div>
          </div>

          {tzSuccessMessage && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{tzSuccessMessage}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category Manager (Phase 2 & Phase 8) */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#85858b]" />
            <span>Personal task categories</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Manage category tags for personal life, academics, side hustles, and routines
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          {/* Category List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {categories?.map((cat) => (
              <div
                key={cat.id}
                className="p-2.5 rounded-lg border border-border/80 bg-[#141415] flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || '#71717a' }}
                  />
                  <span className="text-[#ededed] truncate font-medium">{cat.name}</span>
                  {cat.isDefault && (
                    <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      Default
                    </span>
                  )}
                </div>

                {!cat.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory(cat.id)}
                    className="h-6 w-6 p-0 text-[#85858b] hover:text-[#e5484d]"
                    title="Delete custom category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add Category Form */}
          <form onSubmit={handleCreateCategory} className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name (e.g. Placement, Health)"
              className="h-8 text-xs flex-1"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="h-8 w-8 rounded border border-border/80 bg-[#141415] cursor-pointer p-0.5"
              title="Pick color"
            />
            <Button
              type="submit"
              disabled={isAddingCat || !newCatName.trim()}
              size="sm"
              className="h-8 px-3 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Custom Time Slots Manager (Customization Freedom) */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#85858b]" />
            <span>Time slots customization</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Configure preferred times of day for task scheduling and recurring routines
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="space-y-2">
            <span className="text-[11px] text-[#85858b] block font-medium">Default slots:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Not decided',
                'After morning',
                'Morning',
                'Afternoon',
                'After College',
                'Before dinner',
                'After dinner',
                'Night',
              ].map((slot) => (
                <span
                  key={slot}
                  className="px-2 py-0.5 rounded text-[11px] bg-[#141415] border border-border/80 text-zinc-300 font-mono"
                >
                  {slot}
                </span>
              ))}
            </div>
          </div>

          {/* User's Custom Slots */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <span className="text-[11px] text-[#85858b] block font-medium">Custom slots:</span>
            {userSettings?.customSlots && userSettings.customSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userSettings.customSlots.map((slot) => (
                  <div
                    key={slot}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141415] border border-indigo-500/30 text-xs text-indigo-300"
                  >
                    <span>{slot}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSlot(slot)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors ml-1"
                      title="Remove custom slot"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#85858b] italic">No custom slots added yet.</p>
            )}
          </div>

          {/* Add Slot Form */}
          <form onSubmit={handleAddSlot} className="flex items-center gap-2 pt-2 border-t border-border/60">
            <Input
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder="e.g. Deep Work, Gym Time, Late Night Study"
              className="h-8 text-xs flex-1"
            />
            <Button
              type="submit"
              disabled={!newSlotName.trim()}
              size="sm"
              className="h-8 px-3 text-xs gap-1 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add slot</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reminder Defaults (Module Three & Customization) */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#85858b]" />
            <span>Reminder preferences & defaults</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Configure automated schedule and deadline reminder timings
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Default Schedule Reminder */}
            <div className="p-3 rounded-lg bg-[#141415] border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed]">Schedule reminder</span>
                <input
                  type="time"
                  value={userSettings?.defaultScheduleReminderTime || '09:00'}
                  onChange={(e) => handleUpdateReminderSetting('defaultScheduleReminderTime', e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-[#ededed]"
                />
              </div>
              <p className="text-[11px] text-[#85858b]">
                Triggered at this time on the day a task is scheduled to start.
              </p>
            </div>

            {/* Default Deadline Reminder */}
            <div className="p-3 rounded-lg bg-[#141415] border border-border/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ededed]">Deadline reminder</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={userSettings?.defaultDeadlineReminderDaysBefore ?? 2}
                    onChange={(e) => handleUpdateReminderSetting('defaultDeadlineReminderDaysBefore', Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-[#ededed]"
                  >
                    <option value={1}>1 day before</option>
                    <option value={2}>2 days before</option>
                    <option value={3}>3 days before</option>
                    <option value={5}>5 days before</option>
                    <option value={7}>1 week before</option>
                  </select>
                  <input
                    type="time"
                    value={userSettings?.defaultDeadlineReminderTime || '09:00'}
                    onChange={(e) => handleUpdateReminderSetting('defaultDeadlineReminderTime', e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-[#ededed]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#85858b]">
                Triggered prior to the final deadline so you have advance warning.
              </p>
            </div>
          </div>

          {remindersSuccessMsg && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{remindersSuccessMsg}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Workspace Settings */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#85858b]" />
            <span>Workspace profile</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Multi-tenant data isolation ensures zero bleed across personal or project contexts
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#141415] border border-border/80 text-xs">
            <div>
              <span className="text-[#85858b] block text-[10px]">Current workspace</span>
              <span className="font-medium text-[#ededed] text-sm">
                {workspace?.name || 'Gnani AI Showcase'}
              </span>
              <span className="font-mono text-[11px] text-[#85858b] block mt-0.5">
                {workspaceId}
              </span>
            </div>

            <div>
              <span className="text-[#85858b] block text-[10px]">User profile</span>
              <span className="font-medium text-[#ededed] text-sm">
                {currentUser?.name || 'Alex Morgan'}
              </span>
              <span className="text-[11px] text-[#85858b] block mt-0.5">
                {currentUser?.email || 'alex@example.com'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility & UX Preferences */}
      <Card className="border-border/80 bg-[#19191b]">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#85858b]" />
            <span>Accessibility & motion</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Motion and tactile responsiveness settings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-[#141415]">
            <div>
              <p className="text-xs font-medium text-[#ededed]">Reduced motion</p>
              <p className="text-[11px] text-[#85858b]">
                Disable animations, pulsing indicators, and transitions
              </p>
            </div>
            <Button
              variant={reducedMotion ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReducedMotion(!reducedMotion)}
              className="text-xs h-8"
            >
              {reducedMotion ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
