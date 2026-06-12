import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditor } from '../src/hooks/useEditor';

// Mock fetch
global.fetch = vi.fn();

describe('useEditor Hook', () => {
  const isMobile = false;
  const mockSetMobileTab = vi.fn();
  const mockAddSys = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetch.mockReset();
    fetch.mockImplementation((url) => {
      return Promise.resolve({
        json: () => Promise.resolve({ content: 'default content', ok: true })
      });
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTab).toBeNull();
    expect(result.current.selPath).toBeNull();
    expect(result.current.editorMode).toBe('edit');
  });

  it('should open a file and add it to tabs', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/api/file')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            content: 'console.log("test");',
            error: null
          })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    const node = { path: '/test/file.js', name: 'file.js', ext: 'js' };

    await act(async () => {
      await result.current.openFile(node);
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].path).toBe('/test/file.js');
    expect(result.current.tabs[0].content).toBe('console.log("test");');
    expect(result.current.activeTab).toBe('/test/file.js');
  });

  it('should handle file not found error', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/api/file')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            content: '',
            error: 'File not found'
          })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    const node = { path: '/nonexistent/file.js', name: 'file.js', ext: 'js' };

    await act(async () => {
      await result.current.openFile(node);
    });

    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTab).toBeNull();
  });

  it('should save file content', async () => {
    fetch.mockImplementation((url) => {
      if (url === '/api/file' && url.includes('path')) {
        return Promise.resolve({
          json: () => Promise.resolve({ ok: true })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    // First open a file
    await act(async () => {
      await result.current.openFile({ path: '/test/file.js', name: 'file.js', ext: 'js' });
    });

    // Then change content
    await act(async () => {
      result.current.changeContent('new content');
    });

    expect(result.current.tabs[0].content).toBe('new content');
    expect(result.current.tabs[0].dirty).toBe(true);

    // Now save
    await act(async () => {
      await result.current.saveFile();
    });

    expect(result.current.tabs[0].dirty).toBe(false);
    expect(mockAddSys).toHaveBeenCalledWith('💾 Saved: file.js');
  });

  it('should handle save error', async () => {
    fetch.mockImplementation((url) => {
      if (url === '/api/file') {
        return Promise.resolve({
          json: () => Promise.resolve({ ok: false, error: 'Save failed' })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    await act(async () => {
      await result.current.openFile({ path: '/test/file.js', name: 'file.js', ext: 'js' });
    });

    await act(async () => {
      await result.current.saveFile();
    });

    expect(mockAddSys).toHaveBeenCalledWith(expect.stringContaining('❌'));
  });

  it('should change content and update undo stack', async () => {
    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    // Open file first
    await act(async () => {
      await result.current.openFile({ path: '/test/file.js', name: 'file.js', ext: 'js' });
    });

    // Change content multiple times
    act(() => {
      result.current.changeContent('line 1');
    });

    act(() => {
      result.current.changeContent('line 1\nline 2');
    });

    expect(result.current.tabs[0].content).toBe('line 1\nline 2');
    expect(result.current.tabs[0].dirty).toBe(true);
    expect(result.current.tabs[0].undoStack).toHaveLength(2); // Should have 2 undo states
  });

  it('should undo and redo changes', async () => {
    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    // Open file first
    await act(async () => {
      await result.current.openFile({ path: '/test/file.js', name: 'file.js', ext: 'js' });
    });

    // Make changes
    act(() => {
      result.current.changeContent('line 1');
    });

    act(() => {
      result.current.changeContent('line 1\nline 2');
    });

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.tabs[0].content).toBe('line 1');
    expect(result.current.tabs[0].dirty).toBe(true);

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(result.current.tabs[0].content).toBe('line 1\nline 2');
  });

  it('should close active tab', async () => {
    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    // Open two files
    await act(async () => {
      await result.current.openFile({ path: '/test/file1.js', name: 'file1.js', ext: 'js' });
    });
    await act(async () => {
      await result.current.openFile({ path: '/test/file2.js', name: 'file2.js', ext: 'js' });
    });

    expect(result.current.tabs).toHaveLength(2);

    // Close first tab
    act(() => {
      result.current.closeTab('/test/file1.js');
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].path).toBe('/test/file2.js');
  });

  it('should refresh files when content differs', async () => {
    fetch.mockImplementation((url) => {
      if (url.includes('/api/file')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            content: 'updated content'
          })
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    const { result } = renderHook(() => useEditor(isMobile, mockSetMobileTab, mockAddSys));

    // Open file with original content
    await act(async () => {
      await result.current.openFile({ path: '/test/file.js', name: 'file.js', ext: 'js' });
    });

    // Manually set different content to simulate external change
    act(() => {
      result.current.tabs[0].content = 'old content';
      result.current.tabs[0].original = 'old content';
    });

    await act(async () => {
      await result.current.refreshFiles();
    });

    expect(result.current.tabs[0].content).toBe('updated content');
    expect(result.current.tabs[0].dirty).toBe(true);
  });
});
