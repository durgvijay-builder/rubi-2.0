import React from 'react';
import { Outlet } from 'react-router';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

export const AppShell: React.FC = () => {
  return (
    <div className="h-screen w-full bg-[#141415] text-[#ededed] flex flex-col font-sans antialiased selection:bg-ruby-600/30 selection:text-white overflow-hidden">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-ruby-600 focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Persistent Top Navigation Bar */}
      <TopBar />

      <div className="flex-1 flex w-full overflow-hidden relative">
        {/* Desktop Persistent Sidebar - NEVER SCROLLS WITH PAGE */}
        <Sidebar />

        {/* Main Content Area - ONLY THIS SCROLLS */}
        <main
          id="main-content"
          className="flex-1 h-full w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12 min-w-0 overflow-y-auto overflow-x-hidden focus:outline-none"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation (<lg) */}
      <BottomNav />
    </div>
  );
};

