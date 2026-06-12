import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAgent } from '../src/hooks/useAgent';

// Mock fetch
global.fetch = vi.fn();

describe('useAgent Hook', () => {
  const mockFetchTree = vi.fn();
  const mockRefreshFiles = vi.fn();
  const mockSetDesktopPanel = vi.fn();
  const isMobile = false;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for /api/health
    fetch.mockImplementation((url) => {
      if (url === '/api/health') {
        return Promise.resolve({
          json: () => Promise.resolve({
            ollama: true,
            ollama_url: 'http://localhost:11434',
            models: ['gpt-4', 'claude-3']
          }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
  });

  it('should initialize with default values and fetch models', async () => {
    const { result } = renderHook(() => useAgent(mockFetchTree, mockRefreshFiles, isMobile, mockSetDesktopPanel));

    expect(result.current.msgs).toEqual([]);
    expect(result.current.status).toBe('idle');
    
    // Wait for useEffect to trigger fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.models).toEqual(['gpt-4', 'claude-3']);
    expect(result.current.model).toBe('gpt-4');
  });

  it('should handle different event types via handleEv', async () => {
    const { result } = renderHook(() => useAgent(mockFetchTree, mockRefreshFiles, isMobile, mockSetDesktopPanel));

    // We need to access handleEv, but it's not returned by the hook. 
    // However, it's used inside send. Let's test the state changes by simulating a send stream.
    
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data:{"type":"step","message":"Step 1"}\n\n'));
        controller.enqueue(new TextEncoder().encode('data:{"type":"thought","message":"Thinking..."}\n\n'));
        controller.enqueue(new TextEncoder().encode('data:{"type":"tool_call","tool":"read_file","args":{"path":"test.txt"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('data:{"type":"final","message":"Done!"}\n\n'));
        controller.close();
      }
    });

    fetch.mockImplementation((url) => {
      if (url === '/api/run') {
        return Promise.resolve({
          body: mockStream,
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    await act(async () => {
      await result.current.send('Hello');
    });

    expect(result.current.stepCount).toBe(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.msgs).toContainEqual(expect.objectContaining({ role: 'agent', content: 'Done!' }));
    expect(result.current.msgs).toContainEqual(expect.objectContaining({ role: 'user', content: 'Hello' }));
  });

  it('should handle confirm_request event', async () => {
    const { result } = renderHook(() => useAgent(mockFetchTree, mockRefreshFiles, isMobile, mockSetDesktopPanel));

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data:{"type":"confirm_request","runId":"123","tool":"delete","preview":"rm -rf /"}\n\n'));
        controller.close();
      }
    });

    fetch.mockImplementation((url) => {
      if (url === '/api/run') return Promise.resolve({ body: mockStream });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    await act(async () => {
      await result.current.send('Delete everything');
    });

    expect(result.current.confirm).toEqual({ runId: '123', tool: 'delete', preview: 'rm -rf /' });
  });

  it('should clear session', async () => {
    const { result } = renderHook(() => useAgent(mockFetchTree, mockRefreshFiles, isMobile, mockSetDesktopPanel));
    
    fetch.mockImplementation((url) => {
      if (url === '/api/state') return Promise.resolve({ ok: true });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    await act(async () => {
      await result.current.clearSession();
    });

    expect(result.current.msgs).toContainEqual(expect.objectContaining({ role: 'sys', content: 'Session cleared.' }));
    expect(result.current.status).toBe('idle');
  });

  it('should handle errors during send', async () => {
    const { result } = renderHook(() => useAgent(mockFetchTree, mockRefreshFiles, isMobile, mockSetDesktopPanel));

    fetch.mockImplementation((url) => {
      if (url === '/api/run') return Promise.reject(new Error('Network Fail'));
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    await act(async () => {
      await result.current.send('Fail me');
    });

    expect(result.current.msgs).toContainEqual(expect.objectContaining({ role: 'ev', type: 'error', message: 'Error: Network Fail' }));
    expect(result.current.running).toBe(false);
  });
});
