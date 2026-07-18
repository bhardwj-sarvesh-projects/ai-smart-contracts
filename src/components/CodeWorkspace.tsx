import React from 'react';
import Editor from '@monaco-editor/react';
import { ProjectFile } from '../types';
import { Settings, ZoomIn, ZoomOut, Eye, Sun, Moon, Sparkles } from 'lucide-react';

interface CodeWorkspaceProps {
  files: ProjectFile[];
  activeFilePath: string;
  onFileContentChange: (path: string, content: string) => void;
  onSelectFile: (path: string) => void;
}

export default function CodeWorkspace({
  files,
  activeFilePath,
  onFileContentChange,
  onSelectFile
}: CodeWorkspaceProps) {
  const [editorTheme, setEditorTheme] = React.useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = React.useState(13);
  const [showMinimap, setShowMinimap] = React.useState(true);

  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  const getMonacoLanguage = (path: string) => {
    if (path.endsWith('.sol')) return 'solidity';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.move')) return 'rust'; // Move shares rust tokenizer syntax highlighting well
    if (path.endsWith('.js') || path.endsWith('.test.js')) return 'javascript';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      onFileContentChange(activeFile.path, value);
    }
  };

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
                onClick={() => onSelectFile(file.path)}
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
          {/* Zoom Actions */}
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

          {/* Minimap toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`p-1 hover:bg-slate-800 rounded transition-colors ${showMinimap ? 'text-cyan-400' : 'text-slate-500'}`}
            title="Toggle Minimap"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Theme switch */}
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
            value={activeFile.content}
            onChange={handleEditorChange}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2 font-mono text-xs text-slate-500">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-spin" />
                <span>Loading Editor Modules...</span>
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
