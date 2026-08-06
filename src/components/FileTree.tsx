import React, { useState, useMemo, useCallback } from 'react';
import { Folder, FileCode, Plus, Trash2, ChevronRight, ChevronDown, Zap, Search, Edit2, Copy, FolderPlus, FilePlus } from 'lucide-react';
import { ProjectFile } from '../types';
import { BackgroundTasksWidget } from './BackgroundTasksWidget';

interface FileTreeProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onAddFile: (path: string, content?: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile?: (oldPath: string, newPath: string) => void;
  onOpenDeployPanel?: () => void;
  theme?: 'dark' | 'light';
}

interface ContextMenuState {
  x: number;
  y: number;
  targetPath: string;
  isFolder: boolean;
}

export default function FileTreeComponent({
  files,
  activeFilePath,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onRenameFile,
  onOpenDeployPanel,
  theme = 'dark'
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    contracts: true,
    programs: true,
    sources: true,
    test: true,
    scripts: true,
    interfaces: true,
    libraries: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [targetParentFolder, setTargetParentFolder] = useState('');

  // Inline editing state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const isDark = theme === 'dark';

  // Build recursive directory structure tree
  const treeStructure = useMemo(() => {
    interface TreeNode {
      name: string;
      fullPath: string;
      isFolder: boolean;
      children: Record<string, TreeNode>;
      file?: ProjectFile;
    }

    const root: Record<string, TreeNode> = {};

    const filtered = searchQuery.trim()
      ? files.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
      : files;

    filtered.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isFolder = index < parts.length - 1;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            fullPath: currentPath,
            isFolder,
            children: {},
            file: isFolder ? undefined : file
          };
        }

        if (isFolder) {
          currentLevel = currentLevel[part].children;
        }
      });
    });

    return root;
  }, [files, searchQuery]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  }, []);

  const getFileIcon = (path: string) => {
    if (path.endsWith('.sol')) return <span className="text-amber-500 font-bold text-xs">Ξ</span>;
    if (path.endsWith('.rs')) return <span className="text-orange-500 font-bold text-xs">🦀</span>;
    if (path.endsWith('.move')) return <span className="text-teal-400 font-bold text-xs">M</span>;
    if (path.endsWith('.json')) return <span className="text-yellow-400 font-bold text-xs">&#123;&#125;</span>;
    if (path.endsWith('.md')) return <span className="text-blue-300 font-bold text-xs">↓</span>;
    return <FileCode className="w-3.5 h-3.5 text-slate-400" />;
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, isFolder: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetPath: path,
      isFolder
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleDuplicate = (filePath: string) => {
    const file = files.find(f => f.path === filePath);
    if (!file) return;
    const parts = filePath.split('.');
    const ext = parts.length > 1 ? `.${parts.pop()}` : '';
    const base = parts.join('.');
    const newPath = `${base}_copy${ext}`;
    onAddFile(newPath, file.content);
    closeContextMenu();
  };

  const handleStartRename = (path: string) => {
    setRenamingPath(path);
    setRenameValue(path.split('/').pop() || path);
    closeContextMenu();
  };

  const handleConfirmRename = () => {
    if (!renamingPath || !renameValue.trim()) return;
    const parts = renamingPath.split('/');
    parts.pop();
    const newPath = parts.length > 0 ? `${parts.join('/')}/${renameValue.trim()}` : renameValue.trim();

    if (onRenameFile && newPath !== renamingPath) {
      onRenameFile(renamingPath, newPath);
    }
    setRenamingPath(null);
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    let path = newItemName.trim();
    if (targetParentFolder) {
      path = `${targetParentFolder}/${path}`;
    }

    if (newType === 'file') {
      onAddFile(path, '// Enterprise Smart Contract Module\n');
    } else {
      // Create empty folder placeholder file
      onAddFile(`${path}/.keep`, '');
    }

    setNewItemName('');
    setShowAddModal(false);
  };

  // Render tree recursively
  const renderTree = (nodes: Record<string, any>, depth = 0) => {
    return Object.keys(nodes).map(key => {
      const node = nodes[key];
      const isExpanded = expandedFolders[node.fullPath] ?? true;

      if (node.isFolder) {
        return (
          <div key={node.fullPath} className="select-none">
            <div
              onClick={() => toggleFolder(node.fullPath)}
              onContextMenu={(e) => handleContextMenu(e, node.fullPath, true)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className={`flex items-center gap-1.5 py-1 pr-2 rounded cursor-pointer text-xs font-semibold transition-colors group ${
                isDark ? 'hover:bg-slate-800/60 text-slate-300' : 'hover:bg-slate-200/60 text-slate-800'
              }`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate flex-1">{node.name}</span>

              {/* Quick Hover Add Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetParentFolder(node.fullPath);
                  setNewType('file');
                  setShowAddModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
                title="Add file inside folder"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {isExpanded && node.children && (
              <div>
                {renderTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // File Node
      const isActive = node.fullPath === activeFilePath;
      const isBeingRenamed = renamingPath === node.fullPath;

      return (
        <div
          key={node.fullPath}
          onClick={() => onSelectFile(node.fullPath)}
          onContextMenu={(e) => handleContextMenu(e, node.fullPath, false)}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          className={`group flex items-center justify-between py-1 pr-2 rounded cursor-pointer text-xs transition-colors ${
            isActive
              ? isDark ? 'bg-slate-800 text-white font-semibold border-l-2 border-cyan-400' : 'bg-cyan-100 text-cyan-900 font-semibold border-l-2 border-cyan-500'
              : isDark ? 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200/40 text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              {getFileIcon(node.fullPath)}
            </div>

            {isBeingRenamed ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                onBlur={handleConfirmRename}
                autoFocus
                className="bg-slate-950 border border-cyan-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none w-full"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-emerald-400 border border-slate-700">M</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${node.fullPath}?`)) {
                  onDeleteFile(node.fullPath);
                }
              }}
              className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
              title="Delete File"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div
      onClick={closeContextMenu}
      className={`flex flex-col h-full border-r select-none transition-colors duration-300 relative ${
        isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      {/* Top Header & Quick Action Buttons */}
      <div className={`p-3 border-b flex items-center justify-between transition-colors ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <span className={`text-xs font-extrabold tracking-wider uppercase font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setTargetParentFolder('');
              setNewType('file');
              setShowAddModal(true);
            }}
            className={`p-1 rounded transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Create File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setTargetParentFolder('');
              setNewType('folder');
              setShowAddModal(true);
            }}
            className={`p-1 rounded transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Create Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-2 border-b border-slate-800/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-slate-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full text-xs pl-7 pr-2 py-1 rounded-lg border focus:outline-none focus:border-cyan-500 transition-colors ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Add Modal Form */}
      {showAddModal && (
        <form onSubmit={handleCreateNewItem} className={`p-3 border-b space-y-2 transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 font-mono">
            <span>Create New {newType === 'file' ? 'File' : 'Folder'}</span>
            {targetParentFolder && <span className="text-cyan-400">in {targetParentFolder}</span>}
          </div>
          <input
            type="text"
            placeholder={newType === 'file' ? 'e.g. Vault.sol' : 'e.g. libraries'}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
            className={`w-full text-xs rounded-lg p-1.5 focus:outline-none focus:border-cyan-500 border ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-2.5 py-1 text-[10px] rounded hover:bg-slate-800 text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-1 text-[10px] bg-cyan-600 text-white font-bold rounded hover:bg-cyan-500 cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1 font-mono text-xs scrollbar-thin">
        {renderTree(treeStructure)}
      </div>

      {/* Background Tasks Sidebar Widget */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950/40">
        <BackgroundTasksWidget theme={theme} compact={true} />
      </div>

      {/* Sidebar Deploy Button */}
      {onOpenDeployPanel && (
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/40">
          <button
            onClick={onOpenDeployPanel}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all font-bold text-xs shadow-md border border-cyan-500/30 bg-gradient-to-r from-cyan-600/20 to-indigo-600/20 hover:from-cyan-600/30 hover:to-indigo-600/30 text-cyan-400"
          >
            <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span>Deploy & Pipeline</span>
          </button>
        </div>
      )}

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 w-48 text-xs font-sans text-slate-200"
        >
          <button
            onClick={() => {
              setTargetParentFolder(contextMenu.isFolder ? contextMenu.targetPath : '');
              setNewType('file');
              setShowAddModal(true);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" /> New File
          </button>
          <button
            onClick={() => {
              setTargetParentFolder(contextMenu.isFolder ? contextMenu.targetPath : '');
              setNewType('folder');
              setShowAddModal(true);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
          >
            <FolderPlus className="w-3.5 h-3.5 text-sky-400" /> New Folder
          </button>
          {!contextMenu.isFolder && (
            <button
              onClick={() => handleDuplicate(contextMenu.targetPath)}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" /> Duplicate File
            </button>
          )}
          <button
            onClick={() => handleStartRename(contextMenu.targetPath)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2 text-slate-300"
          >
            <Edit2 className="w-3.5 h-3.5 text-indigo-400" /> Rename
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            onClick={() => {
              onDeleteFile(contextMenu.targetPath);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 flex items-center gap-2 text-rose-400 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
