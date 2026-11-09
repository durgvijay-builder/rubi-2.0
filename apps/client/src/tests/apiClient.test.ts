import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../lib/apiClient.js';

describe('ApiClient (HTTP Ports & Isolation)', () => {
  let client: ApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new ApiClient('workspace-rubi-primary-001', 'http://localhost:3001');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('initializes with default workspace header x-workspace-id: workspace-rubi-primary-001', () => {
    expect(client.getWorkspaceId()).toBe('workspace-rubi-primary-001');
  });

  it('allows dynamic workspace switching', () => {
    client.setWorkspaceId('workspace-secondary-team-222');
    expect(client.getWorkspaceId()).toBe('workspace-secondary-team-222');
  });

  it('transcribeAudio sends audio payload with x-workspace-id header', async () => {
    const mockResponse = {
      text: 'kal dopahar ko sprint planning karni hai',
      transcript: 'kal dopahar ko sprint planning karni hai',
      language: 'hi-en',
      confidence: 0.94,
      isMock: true,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const blob = new Blob(['fake audio buffer'], { type: 'audio/wav' });
    const result = await client.transcribeAudio(blob);

    expect(result.text).toBe(mockResponse.text);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/speech/transcribe',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-workspace-id': 'workspace-rubi-primary-001',
        }),
      })
    );
  });

  it('synthesizeSpeech sends json payload with voice and text', async () => {
    const mockResponse = {
      audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      mimeType: 'audio/wav',
      durationMs: 1200,
      spokenText: 'Action items approved successfully.',
      voiceUsed: 'en-US-Standard',
      isMock: true,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await client.synthesizeSpeech('Action items approved successfully.');
    expect(result.spokenText).toBe('Action items approved successfully.');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/speech/synthesize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-workspace-id': 'workspace-rubi-primary-001',
        }),
        body: JSON.stringify({ text: 'Action items approved successfully.', voice: 'en-US-Standard' }),
      })
    );
  });

  it('getTasks appends query parameters for archived and search', async () => {
    const mockTasks = {
      tasks: [
        {
          id: 'task-1',
          workspaceId: 'workspace-rubi-primary-001',
          title: 'Search Target Task',
          description: null,
          status: 'TO_DO',
          priority: 'HIGH',
          assignee: 'Durgvijay',
          deadline: null,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dependencies: [],
        },
      ],
      total: 1,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTasks,
    } as Response);

    const result = await client.getTasks({ archived: false, search: 'Target' });
    expect(result.tasks).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?archived=false&search=Target',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-workspace-id': 'workspace-rubi-primary-001',
        }),
      })
    );
  });

  it('approveBatch propagates HTTP 422 error on circular dependency failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'Unprocessable Entity',
        message: 'Cannot commit batch: circular dependency unresolved.',
      }),
    } as Response);

    await expect(
      client.approveBatch([
        {
          tempId: 't1',
          title: 'Circular Task 1',
          priority: 'HIGH',
          dependencies: ['t2'],
        },
      ])
    ).rejects.toThrow('Cannot commit batch: circular dependency unresolved.');
  });
});
