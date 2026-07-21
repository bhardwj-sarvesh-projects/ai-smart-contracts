import React, { useState } from 'react';
import { History, RotateCcw, Copy, Trash2, Edit3, Heart, Search, FileCode, Check, ArrowRight, Layers } from 'lucide-react';
import { ProjectFile } from '../types';

interface Version {
  id: string;
  timestamp: string;
  prompt: string;
  files: ProjectFile[];
  summary: string;
}

interface VersionHistoryProps {
  versions: Version[];
  onRestore: (version: Version) => void;
  onDuplicate: (version: Version) => void;
  onRenamePrompt: (versionId: string, newName: string) => void;
  onDeleteVersion: (versionId: string) => void;
}

export default function VersionHistory({
  versions,
  onRestore,
  onDuplicate,
  onRenamePrompt,
  onDeleteVersion
}: VersionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedVer1, setSelectedVer1] = useState<Version | null>(null);
  const [selectedVer2, setSelectedVer2] = useState<Version | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  const toggleFavorite = (id: string) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleStartRename = (v: Version) => {
    setRenamingId(v.id);
    setRenamingValue(v.prompt);
  };

  const handleSaveRename = (id: string) => {
    if (renamingValue.trim()) {
      onRenamePrompt(id, renamingValue.trim());
    }
    setRenamingId(null);
  };

  const filteredVersions = (versions || []).filter(v => {
    if (!v) return false;
    const prompt = String(v.prompt || '').toLowerCase();
    const summary = String(v.summary || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();
    return prompt.includes(search) || summary.includes(search);
  });

  const getNormalizedContent = (fileContent: any): string => {
    // 1. Find every component that renders: generatedContract, aiResponse, response, contract, result
    const generatedContract = fileContent;
    const aiResponse = fileContent;
    const response = fileContent;
    const contract = fileContent;
    const result = fileContent;

    // 2. Before rendering, log the object
    console.log("Generated Contract:", generatedContract);

    // 3. Determine the exact runtime type
    const runtimeType = typeof generatedContract;
    console.log("Runtime type of generatedContract:", runtimeType);

    // 4. If it is an object, log keys
    if (runtimeType === 'object' && generatedContract !== null) {
      console.log("Object.keys(generatedContract):", Object.keys(generatedContract));

      // 5. Identify which property contains the actual smart contract source code.
      // Do NOT guess. Inspect the runtime object.
      const obj = generatedContract as any;
      let actualCode = '';
      if (typeof obj.code === 'string') {
        actualCode = obj.code;
      } else if (typeof obj.src === 'string') {
        actualCode = obj.src;
      } else if (typeof obj.content === 'string') {
        actualCode = obj.content;
      } else if (typeof obj.contract === 'string') {
        actualCode = obj.contract;
      } else if (typeof obj.generatedContract === 'string') {
        actualCode = obj.generatedContract;
      } else if (typeof obj.migrations === 'string') {
        actualCode = obj.migrations;
      } else {
        actualCode = JSON.stringify(generatedContract, null, 2);
      }

      // 7. If multiple response formats exist, normalize them into: { code: string }
      const normalized = { code: actualCode };

      // 8. Preserve original object for debugging, but only render the string contract
      console.log("Original object preserved:", generatedContract);
      return normalized.code;
    }

    return typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent || '');
  };

  // Compute a beautiful inline text diff comparison
  const renderDiff = (file1: ProjectFile | undefined, file2: ProjectFile | undefined) => {
    if (!file1 && !file2) return <p className="text-slate-500 text-xs">No file selected for comparison.</p>;
    
    const content1 = file1 ? getNormalizedContent(file1.content) : '';
    const content2 = file2 ? getNormalizedContent(file2.content) : '';

    if (!file1) return <pre className="p-3 bg-emerald-950/20 text-emerald-400 text-[10px] rounded font-mono whitespace-pre-wrap leading-relaxed">+ Entire File Added:\n\n{content2}</pre>;
    if (!file2) return <pre className="p-3 bg-rose-950/20 text-rose-400 text-[10px] rounded font-mono whitespace-pre-wrap leading-relaxed">- Entire File Removed:\n\n{content1}</pre>;

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // A simple line-by-line diff visualizer
    const diffBlocks: React.ReactNode[] = [];
    const maxLength = Math.max(lines1.length, lines2.length);

    let idx1 = 0;
    let idx2 = 0;

    while (idx1 < lines1.length || idx2 < lines2.length) {
      const line1 = lines1[idx1];
      const line2 = lines2[idx2];

      if (line1 === line2) {
        diffBlocks.push(
          <div key={`eq-${idx1}-${idx2}`} className="flex font-mono text-[10px] text-slate-400 py-0.5 px-2 hover:bg-slate-900/30">
            <span className="w-8 text-right pr-2 text-slate-600 select-none">{idx1 + 1}</span>
            <span className="w-8 text-right pr-2 text-slate-600 select-none">{idx2 + 1}</span>
            <span className="whitespace-pre-wrap pl-2">{line1}</span>
          </div>
        );
        idx1++;
        idx2++;
      } else {
        // If lines differ, look ahead to see if it's an insertion or deletion
        const lookAheadDeletion = lines1.slice(idx1, idx1 + 3).indexOf(line2);
        const lookAheadInsertion = lines2.slice(idx2, idx2 + 3).indexOf(line1);

        if (lookAheadDeletion !== -1 && (lookAheadInsertion === -1 || lookAheadDeletion < lookAheadInsertion)) {
          // Lines were deleted from lines1
          for (let i = 0; i < lookAheadDeletion; i++) {
            diffBlocks.push(
              <div key={`del-${idx1}`} className="flex font-mono text-[10px] text-rose-400 bg-rose-950/20 py-0.5 px-2">
                <span className="w-8 text-right pr-2 text-rose-800 select-none">{idx1 + 1}</span>
                <span className="w-8 text-right pr-2 select-none">-</span>
                <span className="whitespace-pre-wrap pl-2 bg-rose-900/10 w-full">{lines1[idx1]}</span>
              </div>
            );
            idx1++;
          }
        } else if (lookAheadInsertion !== -1) {
          // Lines were inserted into lines2
          for (let i = 0; i < lookAheadInsertion; i++) {
            diffBlocks.push(
              <div key={`ins-${idx2}`} className="flex font-mono text-[10px] text-emerald-400 bg-emerald-950/20 py-0.5 px-2">
                <span className="w-8 text-right pr-2 select-none">+</span>
                <span className="w-8 text-right pr-2 text-emerald-800 select-none">{idx2 + 1}</span>
                <span className="whitespace-pre-wrap pl-2 bg-emerald-900/10 w-full">{lines2[idx2]}</span>
              </div>
            );
            idx2++;
          }
        } else {
          // Replacement of lines
          if (idx1 < lines1.length) {
            diffBlocks.push(
              <div key={`rep1-${idx1}`} className="flex font-mono text-[10px] text-rose-400 bg-rose-950/20 py-0.5 px-2">
                <span className="w-8 text-right pr-2 text-rose-800 select-none">{idx1 + 1}</span>
                <span className="w-8 text-right pr-2 select-none">-</span>
                <span className="whitespace-pre-wrap pl-2 bg-rose-900/10 w-full">{lines1[idx1]}</span>
              </div>
            );
            idx1++;
          }
          if (idx2 < lines2.length) {
            diffBlocks.push(
              <div key={`rep2-${idx2}`} className="flex font-mono text-[10px] text-emerald-400 bg-emerald-950/20 py-0.5 px-2">
                <span className="w-8 text-right pr-2 select-none">+</span>
                <span className="w-8 text-right pr-2 text-emerald-800 select-none">{idx2 + 1}</span>
                <span className="whitespace-pre-wrap pl-2 bg-emerald-900/10 w-full">{lines2[idx2]}</span>
              </div>
            );
            idx2++;
          }
        }
      }
    }

    return (
      <div className="border border-slate-800 rounded bg-slate-950 overflow-hidden max-h-[400px] overflow-y-auto">
        {diffBlocks}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      
      {/* Header Panel */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Project History & Versions</span>
        </div>
        {versions.length >= 2 && (
          <button
            onClick={() => setIsComparing(!isComparing)}
            className={`px-2 py-1 text-[10px] rounded font-semibold border transition-all ${
              isComparing
                ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-white'
            }`}
            id="btn-toggle-compare-versions"
          >
            {isComparing ? 'Exit Comparison' : 'Compare Versions'}
          </button>
        )}
      </div>

      {isComparing ? (
        /* Code Compare Dual Diff view */
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto min-h-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Version 1 selection */}
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 uppercase font-mono">Compare Base (Version 1)</label>
              <select
                value={selectedVer1?.id || ''}
                onChange={(e) => setSelectedVer1(versions.find(v => v.id === e.target.value) || null)}
                className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none"
              >
                <option value="">-- Select Version --</option>
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    Ver {versions.length - i} ({v.prompt.slice(0, 30)}...)
                  </option>
                ))}
              </select>
            </div>

            {/* Version 2 selection */}
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 uppercase font-mono">Compare Target (Version 2)</label>
              <select
                value={selectedVer2?.id || ''}
                onChange={(e) => setSelectedVer2(versions.find(v => v.id === e.target.value) || null)}
                className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-xs text-slate-200 font-mono focus:outline-none"
              >
                <option value="">-- Select Version --</option>
                {versions.map((v, i) => (
                  <option key={v.id} value={v.id}>
                    Ver {versions.length - i} ({v.prompt.slice(0, 30)}...)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedVer1 && selectedVer2 ? (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* List files that exist in either version and do comparisons */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {Array.from(new Set([
                  ...selectedVer1.files.map(f => f.path),
                  ...selectedVer2.files.map(f => f.path)
                ])).map(filePath => {
                  const f1 = selectedVer1.files.find(f => f.path === filePath);
                  const f2 = selectedVer2.files.find(f => f.path === filePath);
                  
                  // Check if content matches
                  const isMatch = f1?.content === f2?.content;
                  if (isMatch) return null; // Hide unchanged files to save noise

                  return (
                    <div key={filePath} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 bg-slate-950/80 px-2 py-1 rounded">
                        <FileCode className="w-3 h-3" />
                        <span>{filePath}</span>
                        <span className="text-[8px] text-slate-500 font-bold ml-auto uppercase">modified</span>
                      </div>
                      {renderDiff(f1, f2)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs font-mono text-center p-8 space-y-2">
              <Layers className="w-8 h-8 text-slate-600 animate-pulse" />
              <p>Select both a base version and a comparison target version to generate side-by-side smart contract diff audit blocks.</p>
            </div>
          )}
        </div>
      ) : (
        /* Standard Version List & Actions */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2 border-b border-slate-850 bg-slate-950/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompt updates..."
                className="w-full bg-slate-950 border border-slate-850 rounded-md pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredVersions.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No modifications in project history yet.</p>
            ) : (
              filteredVersions.map((v, idx) => {
                const isFav = favorites.includes(v.id);
                const isRenaming = renamingId === v.id;
                const versionNumber = versions.length - idx;

                return (
                  <div
                    key={v.id}
                    className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg hover:border-slate-800 transition-all space-y-2"
                  >
                    {/* Top title bar */}
                    <div className="flex items-start justify-between gap-1">
                      <div className="space-y-0.5 flex-1 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-cyan-400 font-mono">V{versionNumber}.0</span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        {isRenaming ? (
                          <div className="flex items-center gap-1 pt-1">
                            <input
                              type="text"
                              value={renamingValue}
                              onChange={(e) => setRenamingValue(e.target.value)}
                              className="bg-slate-900 text-xs text-slate-200 border border-cyan-500 rounded px-1.5 py-0.5 focus:outline-none w-full"
                            />
                            <button
                              onClick={() => handleSaveRename(v.id)}
                              className="p-1 text-emerald-400 hover:bg-slate-850 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-white truncate leading-relaxed" title={v.prompt}>
                            {v.prompt}
                          </p>
                        )}
                      </div>

                      {/* Tool Utilities */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleFavorite(v.id)}
                          className={`p-1 rounded hover:bg-slate-850 transition-colors ${isFav ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'}`}
                        >
                          <Heart className="w-3 h-3 fill-current" />
                        </button>
                        <button
                          onClick={() => handleStartRename(v)}
                          className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-850"
                          title="Rename commit prompt"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteVersion(v.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-850"
                          title="Delete commit"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Commit summary description */}
                    <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                      {v.summary}
                    </p>

                    {/* Action Panel */}
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-850/50">
                      <button
                        onClick={() => onRestore(v)}
                        className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1 bg-cyan-600/10 hover:bg-cyan-600/20 px-2 py-0.5 rounded border border-cyan-500/20"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Restore
                      </button>
                      <button
                        onClick={() => onDuplicate(v)}
                        className="text-[9px] text-slate-400 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1 bg-slate-850 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800"
                      >
                        <Copy className="w-2.5 h-2.5" /> Fork / Duplicate
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}
