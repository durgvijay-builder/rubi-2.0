import React from 'react';
import { NavLink } from 'react-router';
import { useAppState } from '@/context/AppStateContext';
import {
  LayoutDashboard,
  Mic,
  CheckSquare,
  ShieldCheck,
  History,
  Sliders,
  Radio,
  Repeat,
  Bell,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RubiBrandMark } from '@/components/brand/RubiBrandMark';

export const Sidebar: React.FC = () => {
  const { stagedCandidates, tasks, routines, reminders, isRecording, health } = useAppState();

  const pendingApprovalCount = stagedCandidates.length;
  const activeTaskCount = tasks.filter(
    (t: any) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && !t.isArchived,
  ).length;
  const activeRoutineCount = routines ? routines.filter((r: any) => r.isActive).length : 0;
  const pendingReminderCount = reminders ? reminders.filter((r: any) => r.status === 'PENDING').length : 0;

  const getFooterStatus = () => {
    if (!health) return { label: 'CONNECTING...', color: 'bg-zinc-500', text: 'text-zinc-400' };
    if (health.mode === 'offline') {
      return { label: 'OFFLINE / MOCK', color: 'bg-zinc-500', text: 'text-zinc-400' };
    }
    const stt = health.providers?.stt;
    const tts = health.providers?.tts;
    const gemini = health.providers?.gemini;
    if (stt?.status === 'AUTHENTICATION_FAILED' || tts?.status === 'AUTHENTICATION_FAILED' || gemini?.status === 'AUTHENTICATION_FAILED') {
      return { label: 'AUTH FAILED', color: 'bg-rose-500', text: 'text-rose-400' };
    }
    if (stt?.status === 'UNAVAILABLE' || tts?.status === 'UNAVAILABLE' || gemini?.status === 'UNAVAILABLE') {
      return { label: 'DEGRADED', color: 'bg-amber-500', text: 'text-amber-400' };
    }
    if (stt?.status === 'CONNECTED' && gemini?.status === 'CONNECTED') {
      return { label: 'CONNECTED', color: 'bg-[#4cc38a]', text: 'text-[#4cc38a]' };
    }
    return { label: 'LIVE / UNVERIFIED', color: 'bg-amber-400', text: 'text-amber-400' };
  };

  const statusInfo = getFooterStatus();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: '/voice',
      label: 'Voice Studio',
      icon: Mic,
      badge: isRecording ? (
        <span className="flex h-2 w-2 rounded-full bg-ruby-500" />
      ) : null,
    },
    {
      to: '/tasks',
      label: 'Tasks',
      icon: CheckSquare,
      badge: (
        <span className="font-mono text-[11px] text-[#85858b] tabular-nums">
          {activeTaskCount}
        </span>
      ),
    },
    {
      to: '/routines',
      label: 'Routines',
      icon: Repeat,
      badge: (
        <span className="font-mono text-[11px] text-[#85858b] tabular-nums">
          {activeRoutineCount}
        </span>
      ),
    },
    {
      to: '/reminders',
      label: 'Reminders',
      icon: Bell,
      badge:
        pendingReminderCount > 0 ? (
          <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 tabular-nums">
            {pendingReminderCount}
          </span>
        ) : null,
    },
    {
      to: '/approvals',
      label: 'Approvals',
      icon: ShieldCheck,
      badge:
        pendingApprovalCount > 0 ? (
          <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 tabular-nums">
            {pendingApprovalCount}
          </span>
        ) : null,
    },
    {
      to: '/activity',
      label: 'Activity',
      icon: History,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Sliders,
    },
  ];

  return (
    <aside
      className="hidden lg:flex w-60 flex-col justify-between border-r border-border/80 bg-[#0f0f10] p-3 h-full shrink-0 overflow-y-auto"
      aria-label="Desktop Sidebar Navigation"
    >
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="px-3 pt-2 pb-1 border-b border-border/60">
          <RubiBrandMark size={28} showSubtitle={true} />
        </div>

        <div>
          <p className="px-3 pt-1 pb-1.5 text-xs text-[#85858b] font-normal">
            Navigation
          </p>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact ? true : false}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center justify-between rounded-md px-3 h-9 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-[#232325] text-[#ededed] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] border border-border/80'
                        : 'text-[#85858b] hover:bg-[#19191b] hover:text-[#ededed]',
                    )
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-[#85858b] group-hover:text-[#ededed]" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Status Panel */}
      <div className="rounded-lg border border-border/80 bg-[#19191b] p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-normal text-[#ededed]">Voice Engine</span>
          <span className={`flex items-center gap-1 font-mono text-[11px] ${statusInfo.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.color}`} />
            {statusInfo.label}
          </span>
        </div>
        <p className="text-[11px] text-[#85858b] leading-relaxed">
          {health?.mode === 'live'
            ? 'Live AI services with human gate verification.'
            : 'Offline deterministic mock mode for local development.'}
        </p>
      </div>
    </aside>
  );
};
