import React from 'react';
import { NavLink } from 'react-router';
import { useAppState } from '@/context/AppStateContext';
import {
  LayoutDashboard,
  CheckSquare,
  Mic,
  ShieldCheck,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const BottomNav: React.FC = () => {
  const { stagedCandidates, isRecording } = useAppState();
  const pendingCount = stagedCandidates.length;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-[#0f0f10]/95 backdrop-blur-md pb-safe"
      aria-label="Mobile Navigation Bar"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {/* Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] text-xs transition-colors',
              isActive ? 'text-[#ededed] font-medium' : 'text-[#85858b] hover:text-[#ededed]',
            )
          }
          aria-label="Home Overview"
        >
          <LayoutDashboard className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Overview</span>
        </NavLink>

        {/* Tasks */}
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] text-xs transition-colors',
              isActive ? 'text-[#ededed] font-medium' : 'text-[#85858b] hover:text-[#ededed]',
            )
          }
          aria-label="Tasks List"
        >
          <CheckSquare className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Tasks</span>
        </NavLink>

        {/* Center Voice Studio Trigger */}
        <div className="flex-1 flex justify-center -mt-4">
          <NavLink
            to="/voice"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center h-12 w-12 rounded-full border border-border/80 shadow-md transition-transform active:scale-95',
                isRecording
                  ? 'bg-rose-600 text-white'
                  : isActive
                  ? 'bg-[#ededed] text-[#141415]'
                  : 'bg-[#232325] text-[#ededed] hover:bg-[#2c2c30]',
              )
            }
            aria-label="Voice Studio"
          >
            <Mic className="h-5 w-5" />
          </NavLink>
        </div>

        {/* Approvals */}
        <NavLink
          to="/approvals"
          className={({ isActive }) =>
            cn(
              'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] text-xs transition-colors',
              isActive ? 'text-[#ededed] font-medium' : 'text-[#85858b] hover:text-[#ededed]',
            )
          }
          aria-label="Approvals"
        >
          <div className="relative">
            <ShieldCheck className="h-4 w-4 mb-0.5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] px-1 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-mono text-amber-300 border border-amber-500/30">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Approvals</span>
        </NavLink>

        {/* Activity */}
        <NavLink
          to="/activity"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] text-xs transition-colors',
              isActive ? 'text-[#ededed] font-medium' : 'text-[#85858b] hover:text-[#ededed]',
            )
          }
          aria-label="Activity History"
        >
          <History className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Activity</span>
        </NavLink>
      </div>
    </nav>
  );
};

