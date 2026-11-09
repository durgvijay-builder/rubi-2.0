import React, { useState } from 'react';
import { useAppState } from '@/context/AppStateContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Check,
  ChevronDown,
  Radio,
  User,
  AudioWaveform,
  Sliders,
  Bell,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router';
import { RubiBrandMark } from '@/components/brand/RubiBrandMark';

export const TopBar: React.FC = () => {
  const {
    workspaceId,
    workspace,
    currentUser,
    switchWorkspace,
    health,
    dueReminders,
  } = useAppState();

  const [customWsOpen, setCustomWsOpen] = useState(false);
  const [customWsInput, setCustomWsInput] = useState('');

  const workspaces = [
    {
      id: 'workspace-rubi-demo-001',
      name: 'Gnani Demo — Launch',
      desc: '6 verified tasks · Multilingual team',
    },
    {
      id: 'workspace-rubi-primary-001',
      name: 'Primary Workspace',
      desc: 'Team operations backlog',
    },
  ];

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWsInput.trim()) {
      switchWorkspace(customWsInput.trim());
      setCustomWsOpen(false);
      setCustomWsInput('');
    }
  };

  const isLive = health?.mode === 'live';
  const getTopStatus = () => {
    if (!health) return { label: 'CONNECTING', dot: 'bg-zinc-500' };
    if (!isLive) return { label: 'ENGINE · MOCK', dot: 'bg-zinc-500' };
    const stt = health.providers?.stt;
    const tts = health.providers?.tts;
    const gemini = health.providers?.gemini;
    if (stt?.status === 'AUTHENTICATION_FAILED' || tts?.status === 'AUTHENTICATION_FAILED' || gemini?.status === 'AUTHENTICATION_FAILED') {
      return { label: 'LIVE · AUTH FAILED', dot: 'bg-rose-500' };
    }
    if (stt?.status === 'UNAVAILABLE' || tts?.status === 'UNAVAILABLE' || gemini?.status === 'UNAVAILABLE') {
      return { label: 'LIVE · DEGRADED', dot: 'bg-amber-500' };
    }
    if (stt?.status === 'CONNECTED' && gemini?.status === 'CONNECTED') {
      return { label: 'LIVE · CONNECTED', dot: 'bg-emerald-400' };
    }
    return { label: 'LIVE · UNVERIFIED', dot: 'bg-amber-400' };
  };
  const topStatus = getTopStatus();

  return (
    <header className="h-14 w-full shrink-0 z-30 flex items-center justify-between border-b border-border/80 bg-[#0f0f10] px-3 sm:px-6">
      {/* Brand & Workspace */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Link
          to="/"
          className="flex items-center text-foreground hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md py-1 shrink-0"
          aria-label="R.U.B.I. Home"
        >
          <RubiBrandMark size={28} showSubtitle={false} />
        </Link>

        {/* Workspace Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 sm:px-2.5 text-xs font-normal border-border/80 bg-[#19191b] hover:bg-[#232325] flex items-center gap-1.5 max-w-[150px] xs:max-w-[180px] sm:max-w-[260px] truncate"
              aria-label="Select Workspace"
            >
              <Building2 className="h-3.5 w-3.5 text-[#85858b] shrink-0" />
              <span className="truncate">
                {workspace?.name || (workspaceId === 'workspace-rubi-demo-001' ? 'Gnani Demo' : workspaceId)}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60 shrink-0 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 bg-[#19191b] border-border/80">
            <DropdownMenuLabel className="text-xs text-[#85858b] font-normal">
              Select Workspace
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                className="flex items-start justify-between py-2 cursor-pointer focus:bg-[#232325]"
              >
                <div>
                  <div className="font-medium text-[#ededed] text-xs flex items-center gap-1.5">
                    {ws.name}
                    {workspaceId === ws.id && <Check className="h-3.5 w-3.5 text-ruby-400" />}
                  </div>
                  <div className="text-[11px] text-[#85858b]">{ws.desc}</div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-border/60" />
            {customWsOpen ? (
              <form onSubmit={handleCustomSubmit} className="p-2 space-y-2">
                <input
                  type="text"
                  placeholder="Enter workspace ID..."
                  value={customWsInput}
                  onChange={(e) => setCustomWsInput(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded border border-border/80 bg-[#141415] text-[#ededed] font-mono"
                  autoFocus
                />
                <div className="flex gap-1 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCustomWsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-7 text-xs bg-ruby-600 hover:bg-ruby-500 text-white">
                    Switch
                  </Button>
                </div>
              </form>
            ) : (
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setCustomWsOpen(true);
                }}
                className="text-xs text-[#85858b] cursor-pointer focus:bg-[#232325]"
              >
                + Enter custom workspace ID...
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side: Signal Engine Status & Profile */}
      <div className="flex items-center gap-3">
        {/* Signal & Gate Stamp */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#19191b] border border-border/80 text-[11px] font-mono">
          <span className={`h-1.5 w-1.5 rounded-full ${topStatus.dot}`} />
          <span className="text-[#a1a1a6] hidden sm:inline">
            {topStatus.label}
          </span>
        </div>

        {/* In-App Notifications Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8 rounded-full border border-border/80 bg-[#19191b] hover:bg-[#232325] text-zinc-300"
              aria-label="Reminders and notifications"
            >
              <Bell className="h-4 w-4" />
              {dueReminders && dueReminders.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                  {dueReminders.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-[#19191b] border-border/80 p-0 shadow-xl">
            <div className="flex items-center justify-between p-3 border-b border-border/80">
              <span className="text-xs font-semibold text-[#ededed] flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-400" />
                Due Reminders
              </span>
              <Link
                to="/reminders"
                className="text-[11px] text-amber-400 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
              {dueReminders && dueReminders.length > 0 ? (
                dueReminders.map((r) => (
                  <div key={r.id} className="p-3 hover:bg-zinc-800/50 transition-colors">
                    <p className="text-xs font-medium text-[#ededed] leading-snug">
                      {r.message || r.title || r.taskTitle || 'Reminder'}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                      {new Date(r.remindAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No active due reminders
                </div>
              )}
            </div>

            <div className="p-2 border-t border-border/80 bg-[#141415]/80 text-center">
              <Link
                to="/reminders"
                className="text-[11px] text-zinc-400 hover:text-white"
              >
                Manage reminder preferences & schedule
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 border border-border/80 bg-[#19191b] hover:bg-[#232325] text-foreground"
              aria-label="User Profile"
            >
              {currentUser?.name ? (
                <span className="font-mono text-xs font-medium text-[#ededed]">
                  {currentUser.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              ) : (
                <User className="h-3.5 w-3.5 text-[#85858b]" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#19191b] border-border/80">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col space-y-0.5">
                <p className="text-xs font-medium text-[#ededed]">
                  {currentUser?.name || 'Alex Morgan'}
                </p>
                <p className="text-[11px] text-[#85858b]">
                  {currentUser?.role || 'User'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/60" />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2 cursor-pointer text-xs text-[#a1a1a6] hover:text-[#ededed] focus:bg-[#232325]">
                <Sliders className="h-3.5 w-3.5" />
                <span>Settings & Preferences</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
