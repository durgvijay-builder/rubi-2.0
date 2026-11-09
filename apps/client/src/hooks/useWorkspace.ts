import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient.js';

export function useWorkspace() {
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => {
    return localStorage.getItem('rubi_workspace_id') || 'workspace-rubi-demo-001';
  });
  const [workspace, setWorkspace] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      apiClient.setWorkspaceId(workspaceId);
      const data = await apiClient.getWorkspace();
      setWorkspace(data.workspace);
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const switchWorkspace = (newId: string) => {
    setWorkspaceIdState(newId);
    localStorage.setItem('rubi_workspace_id', newId);
    apiClient.setWorkspaceId(newId);
  };

  return {
    workspaceId,
    workspace,
    currentUser,
    isLoading,
    error,
    switchWorkspace,
    refetchWorkspace: fetchWorkspace,
  };
}
