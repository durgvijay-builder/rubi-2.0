import React, { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppStateProvider } from './context/AppStateContext';
import { AppShell } from './components/layout/AppShell';
import { OverviewView } from './views/OverviewView';
import { VoiceView } from './views/VoiceView';
import { TasksView } from './views/TasksView';
import { RoutinesView } from './views/RoutinesView';
import { RemindersView } from './views/RemindersView';
import { ApprovalsView } from './views/ApprovalsView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { Button } from './components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#141415] text-[#ededed] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="rounded-xl bg-[#19191b] border border-border/80 p-3 text-[#e5484d]">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-base font-medium text-[#ededed]">Something went wrong</h2>
          <p className="text-xs text-[#85858b] max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred'}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-[#ededed] hover:bg-white text-[#141415] text-xs h-9 px-4"
          >
            Reload application
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<OverviewView />} />
              <Route path="voice" element={<VoiceView />} />
              <Route path="tasks" element={<TasksView />} />
              <Route path="routines" element={<RoutinesView />} />
              <Route path="reminders" element={<RemindersView />} />
              <Route path="approvals" element={<ApprovalsView />} />
              <Route path="activity" element={<ActivityView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </ErrorBoundary>
  );
}
