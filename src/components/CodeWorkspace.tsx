import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { ProjectFile } from '../types';
import { ZoomIn, ZoomOut, Eye, Sun, Moon, Sparkles, Code2 } from 'lucide-react';

interface CodeWorkspaceProps {
  files: ProjectFile[];
  activeFilePath: string;
  onFileContentChange: (path: string, content: string) => void;
  onSelectFile: (path: string) => void;
}

function CodeWorkspaceComponent({
  files,
  activeFilePath,
  onFileContentChange,
  onSelectFile
}: CodeWorkspaceProps) {
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(13);
  const [showMinimap, setShowMinimap] = useState(true);

  const editorRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangeRef = useRef<{ path: string; value: string } | null>(null);
  const prevFilePathRef = useRef<string>(activeFilePath);
  const mountTimeRef = useRef<number>(performance.now());

  const activeFile = useMemo(() => {
    return files.find(f => f.path === activeFilePath) || files[0];
  }, [files, activeFilePath]);

  const getNormalizedContent = useCallback((fileContent: any): string => {
    if (typeof fileContent === 'string') return fileContent;
    if (fileContent && typeof fileContent === 'object') {
      const obj = fileContent as any;
      if (typeof obj.code === 'string') return obj.code;
      if (typeof obj.src === 'string') return obj.src;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.contract === 'string') return obj.contract;
      return JSON.stringify(fileContent, null, 2);
    }
    return '';
  }, []);

  // Flush any pending debounced file saves immediately
  const flushPendingChanges = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingChangeRef.current) {
      onFileContentChange(pendingChangeRef.current.path, pendingChangeRef.current.value);
      pendingChangeRef.current = null;
    }
  }, [onFileContentChange]);

  // Track file switching performance (<100ms target)
  useEffect(() => {
    if (prevFilePathRef.current !== activeFilePath) {
      flushPendingChanges();
      const start = performance.now();
      prevFilePathRef.current = activeFilePath;
      
      // Request animation frame to measure switch frame render time
      requestAnimationFrame(() => {
        const duration = performance.now() - start;
        console.log(`[PERF] ⏱️ File Switch (${activeFilePath}): ${duration.toFixed(2)}ms`);
      });
    }
  }, [activeFilePath, flushPendingChanges]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      flushPendingChanges();
    };
  }, [flushPendingChanges]);

  const getMonacoLanguage = useCallback((path: string) => {
    if (!path) return 'plaintext';
    if (path.endsWith('.sol')) return 'solidity';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.move')) return 'rust';
    if (path.endsWith('.js') || path.endsWith('.test.js')) return 'javascript';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  }, []);

  // Debounced editor change handler (300ms) to prevent 60fps typing lag
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFile || value === undefined) return;
    
    pendingChangeRef.current = { path: activeFile.path, value };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingChangeRef.current) {
        onFileContentChange(pendingChangeRef.current.path, pendingChangeRef.current.value);
        pendingChangeRef.current = null;
      }
    }, 300);
  }, [activeFile, onFileContentChange]);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    const duration = performance.now() - mountTimeRef.current;
    console.log(`[PERF] ⚡ Monaco Editor Ready: ${duration.toFixed(2)}ms`);
  }, []);

  const handleTabClick = useCallback((path: string) => {
    if (path !== activeFilePath) {
      flushPendingChanges();
      onSelectFile(path);
    }
  }, [activeFilePath, flushPendingChanges, onSelectFile]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 overflow-hidden">
      {/* Tab Bars */}
      <div className="flex bg-slate-950 border-b border-slate-800 items-center justify-between px-2 select-none">
        <div className="flex overflow-x-auto max-w-[80%] scrollbar-none">
          {files.map((file) => {
            const isActive = file.path === activeFilePath;
            const fileName = file.path.split('/').pop() || file.path;
            return (
              <button
                key={file.path}
                onClick={() => handleTabClick(file.path)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium border-r border-slate-900 transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white border-t-2 border-cyan-500'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'
                }`}
              >
                <span>{fileName}</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2 py-1 pr-1">
          <button
            onClick={() => setFontSize(prev => Math.min(prev + 1, 20))}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setFontSize(prev => Math.max(prev - 1, 10))}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`p-1 hover:bg-slate-800 rounded transition-colors ${showMinimap ? 'text-cyan-400' : 'text-slate-500'}`}
            title="Toggle Minimap"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setEditorTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title="Switch Theme"
          >
            {editorTheme === 'vs-dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 relative">
        {activeFile ? (
          <Editor
            height="100%"
            theme={editorTheme}
            language={getMonacoLanguage(activeFile.path)}
            value={getNormalizedContent(activeFile.content)}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              fontSize: fontSize,
              minimap: { enabled: showMinimap },
              automaticLayout: true,
              wordWrap: 'on',
              lineHeight: 20,
              folding: true,
              scrollBeyondLastLine: false,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              fontFamily: '"Fira Code", "JetBrains Mono", Menlo, Monaco, Consolas, monospace',
              padding: { top: 8 }
            }}
            loading={
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-3 font-mono text-xs text-slate-500">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                  <Code2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                </div>
                <span>Initializing Monaco Editor...</span>
              </div>
            }
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs">
            <p>Select a file from the explorer sidebar to begin editing.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(CodeWorkspaceComponent);

