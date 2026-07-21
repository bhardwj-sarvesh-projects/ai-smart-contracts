import React, { useState } from 'react';
import { Folder, FileCode, Plus, Trash2, ChevronRight, ChevronDown, RefreshCw, Zap } from 'lucide-react';
import { ProjectFile } from '../types';

interface FileTreeProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onOpenDeployPanel?: () => void;
}

export default function FileTree({
  files,
  activeFilePath,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onOpenDeployPanel
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    contracts: true,
    programs: true,
    sources: true,
    test: true,
    scripts: true
  });
  const [newFileName, setNewFileName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('contracts');

  // Group files into standard virtual folders
  const getFolderStructure = () => {
    const folders: Record<string, ProjectFile[]> = {
      root: []
    };

    files.forEach(file => {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        const folderName = parts[0];
        if (!folders[folderName]) {
          folders[folderName] = [];
        }
        folders[folderName].push(file);
      } else {
        folders.root.push(file);
      }
    });

    return folders;
  };

  const folders = getFolderStructure();

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    let path = newFileName.trim();
    if (selectedFolder !== 'root' && !path.startsWith(selectedFolder + '/')) {
      path = `${selectedFolder}/${path}`;
    }

    onAddFile(path);
    setNewFileName('');
    setShowAddForm(false);
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith('.sol')) return <span className="text-amber-500 font-bold text-xs">Ξ</span>;
    if (path.endsWith('.rs')) return <span className="text-orange-500 font-bold text-xs">🦀</span>;
    if (path.endsWith('.move')) return <span className="text-teal-400 font-bold text-xs">M</span>;
    if (path.endsWith('.py')) return <span className="text-blue-400 font-bold text-xs">Py</span>;
    if (path.endsWith('.md')) return <span className="text-blue-300 font-bold text-xs">↓</span>;
    return <FileCode className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 select-none">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Project Explorer</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          title="New File"
          id="btn-add-file"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateFile} className="p-3 bg-slate-950 border-b border-slate-800 space-y-2">
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] text-slate-500 uppercase">Folder Destination</label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs rounded p-1 text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="contracts">contracts / programs</option>
              <option value="test">test</option>
              <option value="scripts">scripts</option>
              <option value="root">Root Directory</option>
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] text-slate-500 uppercase">File Name (with ext)</label>
            <input
              type="text"
              placeholder="e.g. Escrow.sol"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs rounded p-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2 py-1 text-[10px] hover:bg-slate-800 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-1 text-[10px] bg-cyan-600 text-white rounded hover:bg-cyan-500 font-medium"
            >
              Create
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
        {/* Render Folder Groups */}
        {Object.keys(folders).map((folderKey) => {
          if (folderKey === 'root') return null;
          const isExpanded = expandedFolders[folderKey];
          const folderFiles = folders[folderKey];

          if (folderFiles.length === 0) return null;

          return (
            <div key={folderKey} className="space-y-0.5">
              <div
                onClick={() => toggleFolder(folderKey)}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800/60 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Folder className="w-4 h-4 text-sky-400" />
                <span className="truncate">{folderKey}</span>
              </div>

              {isExpanded && (
                <div className="pl-4 border-l border-slate-800/80 ml-3.5 space-y-0.5">
                  {folderFiles.map((file) => {
                    const isActive = file.path === activeFilePath;
                    return (
                      <div
                        key={file.path}
                        className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-slate-800 text-white border-l-2 border-cyan-500'
                            : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                        }`}
                        onClick={() => onSelectFile(file.path)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-4 h-4 flex items-center justify-center">
                            {getFileIcon(file.path)}
                          </div>
                          <span className="truncate">{file.path.split('/').slice(1).join('/')}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${file.path}?`)) {
                              onDeleteFile(file.path);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-rose-400 transition-all"
                          title="Delete File"
                          id={`btn-delete-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Render Root Files */}
        {folders.root && folders.root.length > 0 && (
          <div className="space-y-0.5 pt-2 border-t border-slate-800/50 mt-2">
            {folders.root.map((file) => {
              const isActive = file.path === activeFilePath;
              return (
                <div
                  key={file.path}
                  className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white border-l-2 border-cyan-500'
                      : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                  onClick={() => onSelectFile(file.path)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-4 h-4 flex items-center justify-center">
                      {getFileIcon(file.path)}
                    </div>
                    <span className="truncate">{file.path}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${file.path}?`)) {
                        onDeleteFile(file.path);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-rose-400 transition-all"
                    title="Delete File"
                    id={`btn-delete-root-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {onOpenDeployPanel && (
              <button
                onClick={onOpenDeployPanel}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 mt-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 dark:text-cyan-400 cursor-pointer transition-all font-bold text-left animate-pulse"
                style={{ animationDuration: '3s' }}
                id="btn-sidebar-deploy-panel"
              >
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs">Deploy & Pipeline</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
