import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspace } from '../src/hooks/useWorkspace';

// Mock fetch
global.fetch = vi.fn();

const defaultFetchMock = (url, options) => {
  let res = {};
  if (url === '/api/cwd') res = { cwd: '' };
  else if (url === '/api/workspaces') res = [];
  else if (url === '/api/memory') res = { global: {}, workspaces: {} };
  else if (url === '/api/processes') res = [];
  return Promise.resolve({
    json: () => Promise.resolve(res)
  });
};

describe('useWorkspace Hook', () => {
  const mockAddSys = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetch.mockReset();
    fetch.mockImplementation(defaultFetchMock);
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWorkspace(mockAddSys));

    expect(result.current.cwd).toBe('');
    expect(result.current.cwdInput).toBe('');
    expect(result.current.tree).toEqual([]);
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.memory).toEqual({ global: {}, workspaces: {} });
    expect(result.current.taskHistory).toEqual([]);
  });

  it('should fetch file tree and set cwd', async () => {
    fetch.mockImplementation((url) => {
      if (url === '/api/tree') {
        return Promise.resolve({
          json: () => Promise.resolve({
            tree: [{ path: '/test', name: 'test', type: 'dir' }],
            cwd: '/test/project'
          })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    await act(async () => {
      await result.current.fetchTree();
    });

    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0].path).toBe('/test');
    expect(result.current.cwd).toBe('/test/project');
  });

  it('should change working directory', async () => {
    fetch.mockImplementation((url, options) => {
      const method = options?.method || 'GET';
      if (url === '/api/cwd' && method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            cwd: '/new/path',
            error: null
          })
        });
      }
      if (url === '/api/tree') {
        return Promise.resolve({
          json: () => Promise.resolve({
            tree: [],
            cwd: '/new/path'
          })
        });
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    await act(async () => {
      await result.current.changeCwd('/new/path');
    });

    expect(result.current.cwd).toBe('/new/path');
    expect(result.current.cwdInput).toBe('/new/path');
    expect(mockAddSys).toHaveBeenCalledWith('📁 CWD → /new/path');
  });

  it('should handle CWD change error', async () => {
    fetch.mockImplementation((url, options) => {
      const method = options?.method || 'GET';
      if (url === '/api/cwd' && method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            cwd: '',
            error: 'Directory does not exist'
          })
        });
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    await act(async () => {
      await result.current.changeCwd('/invalid/path');
    });

    expect(result.current.cwd).toBe('');
    expect(mockAddSys).toHaveBeenCalledWith('❌ Directory does not exist');
  });

  it('should add memory key-value pair', async () => {
    fetch.mockImplementation((url, options) => {
      const method = options?.method || 'GET';
      if (url === '/api/memory' && method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({})
        });
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    await act(async () => {
      await result.current.addMemory();
    });

    // Should not add empty key
    expect(result.current.memory.global).toEqual({});

    // Set values and try again
    act(() => {
      result.current.setNewMemKey('testKey');
      result.current.setNewMemVal('testValue');
    });

    await act(async () => {
      await result.current.addMemory();
    });

    expect(result.current.memory.global).toEqual({ testKey: 'testValue' });
    expect(result.current.newMemKey).toBe('');
    expect(result.current.newMemVal).toBe('');
  });

  it('should delete memory key-value pair', async () => {
    const { result } = renderHook(() => useWorkspace(mockAddSys));

    // Set initial memory
    act(() => {
      result.current.setMemory({ global: { key1: 'value1', key2: 'value2' }, workspaces: {} });
    });

    await act(async () => {
      await result.current.delMemory('key1');
    });

    expect(result.current.memory.global).toEqual({ key2: 'value2' });
  });

  it('should activate workspace', async () => {
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/workspaces') && url.includes('activate')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            ok: true,
            cwd: '/workspace/path'
          })
        });
      }
      if (url === '/api/tree') {
        return Promise.resolve({
          json: () => Promise.resolve({
            tree: [],
            cwd: '/workspace/path'
          })
        });
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    const workspace = { id: 'ws1', name: 'Test Workspace' };

    await act(async () => {
      await result.current.activateWs(workspace);
    });

    expect(result.current.cwd).toBe('/workspace/path');
    expect(result.current.cwdInput).toBe('/workspace/path');
    expect(mockAddSys).toHaveBeenCalledWith('🗂 Workspace: Test Workspace');
  });

  it('should add workspace', async () => {
    const originalPrompt = global.prompt;
    global.prompt = vi.fn(() => 'NewWorkspace');

    fetch.mockImplementation((url, options) => {
      const method = options?.method || 'GET';
      if (url === '/api/workspaces' && method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            id: 'ws2',
            name: 'NewWorkspace',
            cwd: '/current/path'
          })
        });
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    act(() => {
      result.current.setCwd('/current/path');
    });

    await act(async () => {
      await result.current.addWs();
    });

    expect(global.prompt).toHaveBeenCalledWith('Workspace name:');
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('NewWorkspace');

    global.prompt = originalPrompt;
  });

  it('should cancel workspace creation when prompt is cancelled', async () => {
    const originalPrompt = global.prompt;
    global.prompt = vi.fn(() => null);

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    await act(async () => {
      await result.current.addWs();
    });

    expect(global.prompt).toHaveBeenCalledWith('Workspace name:');
    expect(result.current.workspaces).toHaveLength(0);

    global.prompt = originalPrompt;
  });

  it('should delete workspace', async () => {
    const { result } = renderHook(() => useWorkspace(mockAddSys));

    // Set initial workspaces
    act(() => {
      result.current.setWorkspaces([
        { id: 'ws1', name: 'Workspace 1' },
        { id: 'ws2', name: 'Workspace 2' }
      ]);
    });

    await act(async () => {
      await result.current.delWs('ws1');
    });

    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].id).toBe('ws2');
  });

  it('should handle fetch errors gracefully', async () => {
    fetch.mockImplementation((url, options) => {
      if (url === '/api/tree') {
        throw new Error('Network error');
      }
      return defaultFetchMock(url, options);
    });

    const { result } = renderHook(() => useWorkspace(mockAddSys));

    // Should not throw, just handle error silently
    await act(async () => {
      await result.current.fetchTree();
    });

    expect(result.current.tree).toEqual([]);
    expect(result.current.cwd).toBe('');
  });
});
