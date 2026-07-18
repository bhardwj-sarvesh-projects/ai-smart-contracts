import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, Upload, FileCode, CheckCircle, RefreshCw, AlertCircle, 
  ChevronDown, ChevronUp, Download, Sparkles, FileText, CheckCircle2,
  AlertTriangle, Play, HelpCircle, HardDrive, Trash2, Cpu
} from 'lucide-react';
import { Project, ProjectFile, Vulnerability, AuditResult } from '../types';

interface AuditingHubProps {
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (id: string) => void;
  onAuditProject: (id: string, customFiles?: ProjectFile[]) => Promise<any>;
  onApplyFixToProject: (projectId: string, vulnerability: Vulnerability) => Promise<void>;
  theme: 'dark' | 'light';
  isProcessing: boolean;
}

export default function AuditingHub({
  projects,
  activeProject,
  onSelectProject,
  onAuditProject,
  onApplyFixToProject,
  theme,
  isProcessing
}: AuditingHubProps) {
  // Option: 'existing' | 'upload'
  const [auditMode, setAuditMode] = useState<'existing' | 'upload'>('existing');
  
  // Custom uploaded file state
  const [uploadedFiles, setUploadedFiles] = useState<ProjectFile[]>([]);
  const [uploadedChain, setUploadedChain] = useState('ethereum');
  const [uploadedLang, setUploadedLang] = useState('solidity');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auditing interactive step tracker
  const [auditProgressStep, setAuditProgressStep] = useState(0);
  const [auditProgressLogs, setAuditProgressLogs] = useState<string[]>([]);
  const [localAuditResult, setLocalAuditResult] = useState<AuditResult | null>(null);

  const steps = [
    "Parsing contract structures & abstract syntax tree...",
    "Verifying access control modifiers and owner authorizations...",
    "Scanning state variables for potential reentrancy entry-points...",
    "Evaluating integer safety, math overflows and safe transfers...",
    "Constructing AI threat model & synthesizing vulnerabilities...",
    "Compiling final rating report and gas optimization grades..."
  ];

  // Sync loaded project audit report to display automatically
  useEffect(() => {
    if (activeProject && auditMode === 'existing') {
      setLocalAuditResult(activeProject.audit || null);
    } else {
      setLocalAuditResult(null);
    }
  }, [activeProject, auditMode]);

  // Handle step intervals during active AI processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setAuditProgressStep(0);
      setAuditProgressLogs(["[AUDITOR] Initiating professional threat analysis module..."]);
      
      interval = setInterval(() => {
        setAuditProgressStep((prev) => {
          const next = Math.min(prev + 1, steps.length - 1);
          setAuditProgressLogs((logs) => [
            ...logs,
            `[SUCCESS] ${steps[prev]}`,
            `[AUDITOR] Running: ${steps[next]}`
          ]);
          return next;
        });
      }, 2500);
    } else {
      setAuditProgressStep(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string || '';
      const name = file.name;
      const ext = name.split('.').pop() || 'sol';
      
      // Auto-detect parameters based on extension
      let lang = 'solidity';
      let chain = 'ethereum';
      if (ext === 'rs') {
        lang = 'rust';
        chain = 'solana';
      } else if (ext === 'move') {
        lang = 'move';
        chain = 'sui';
      }

      setUploadedLang(lang);
      setUploadedChain(chain);
      setUploadedFiles([{
        path: name,
        content,
        language: lang
      }]);
    };
    reader.readAsText(file);
  };

  const triggerAudit = async () => {
    setLocalAuditResult(null);
    if (auditMode === 'existing') {
      if (!activeProject) return;
      const res = await onAuditProject(activeProject.id);
      if (res) {
        setLocalAuditResult(res);
      }
    } else {
      if (uploadedFiles.length === 0) {
        alert("Please upload at least one smart contract file to begin.");
        return;
      }
      // Create temporary project and audit it
      const res = await onAuditProject('', uploadedFiles);
      if (res) {
        setLocalAuditResult(res);
      }
    }
  };

  // Vulnerability accordion states
  const [expandedVulns, setExpandedVulns] = useState<Record<string, boolean>>({});

  const toggleVuln = (id: string) => {
    setExpandedVulns(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Export Audit Report Markdown File
  const handleExportReportMarkdown = () => {
    if (!localAuditResult) return;
    
    const targetName = auditMode === 'existing' && activeProject ? activeProject.name : uploadedFiles[0]?.path || 'Custom Smart Contract';
    
    let md = `# SMART CONTRACT SECURITY AUDIT REPORT\n\n`;
    md += `**Target Workspace:** ${targetName}\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}\n`;
    md += `**Auditor:** SmartContract.ai Lead Auditor (OpenAI)\n\n`;
    md += `## SECURITY RATING: ${localAuditResult.score}/100\n`;
    md += `* **Code Quality Grade:** ${localAuditResult.codeQuality}/100\n`;
    md += `* **Gas Optimization Level:** ${localAuditResult.gasOptimization}/100\n`;
    md += `* **Structural Complexity Index:** ${localAuditResult.complexity}/10\n\n`;
    md += `## SUMMARY FINDINGS\n\n${localAuditResult.summary}\n\n`;
    md += `## DETECTED VULNERABILITIES (${localAuditResult.vulnerabilities.length})\n\n`;
    
    if (localAuditResult.vulnerabilities.length === 0) {
      md += `*Excellent! No vulnerabilities detected in the analyzed smart contract modules.*\n`;
    } else {
      localAuditResult.vulnerabilities.forEach((v, idx) => {
        md += `### ${idx + 1}. [${v.severity.toUpperCase()}] ${v.title}\n`;
        md += `* **File/Location:** \`${v.file}\` (Line: ${v.line || 'N/A'})\n`;
        md += `* **Description:** ${v.description}\n`;
        md += `* **Remediation Recommendation:** ${v.recommendation}\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-report-${targetName.toLowerCase().replace(/\s+/g, '-')}.md`;
    link.click();
  };

  const applyFix = async (vuln: Vulnerability) => {
    if (auditMode === 'existing' && activeProject) {
      await onApplyFixToProject(activeProject.id, vuln);
      // Re-trigger audit automatically to clear fixed items or refresh
      alert("AI Remediation fix applied successfully! Initiating subsequent validation scan...");
      triggerAudit();
    } else {
      // For uploaded file, recommend manual copy-paste
      alert(`Remediation guide code:\n\n${vuln.recommendation}\n\n(Because this file was uploaded externally, please copy the recommendation to your workspace)`);
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto p-6 md:p-8 space-y-8 min-h-0 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Title */}
      <div>
        <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          🔐 Smart Security Auditing Hub
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Perform state-of-the-art vulnerability scanning and threat-modeling on your smart contract modules.
        </p>
      </div>

      {/* Grid Layout: Config Left, Results Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Control Card */}
        <div className={`p-6 rounded-xl border space-y-6 shadow-sm lg:col-span-1 ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-cyan-400">Select Audit Source</h3>
            <p className="text-[10px] text-slate-400">Choose where the smart contract codebase is loaded from.</p>
          </div>

          {/* Selector Switch tabs */}
          <div className={`p-1 rounded-lg flex gap-1 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
            <button
              onClick={() => {
                setAuditMode('existing');
                setLocalAuditResult(activeProject?.audit || null);
              }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-colors ${
                auditMode === 'existing'
                  ? theme === 'dark'
                    ? 'bg-slate-900 text-cyan-400 border border-slate-800'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Created Contract
            </button>
            <button
              onClick={() => {
                setAuditMode('upload');
                setLocalAuditResult(null);
              }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-colors ${
                auditMode === 'upload'
                  ? theme === 'dark'
                    ? 'bg-slate-900 text-cyan-400 border border-slate-800'
                    : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload Code File
            </button>
          </div>

          {/* Mode contents */}
          {auditMode === 'existing' ? (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-300 block">Select Project Contract</label>
              <select
                value={activeProject?.id || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className={`w-full text-xs p-2.5 rounded-lg border focus:outline-none focus:ring-1 ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800 text-slate-200 focus:ring-cyan-500'
                    : 'bg-white border-slate-200 text-slate-800 focus:ring-cyan-500'
                }`}
              >
                <option value="" disabled>-- Choose Created Contract --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.blockchain})</option>
                ))}
              </select>

              {activeProject && (
                <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                  theme === 'dark' ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-100'
                }`}>
                  <p className="font-semibold text-slate-300">{activeProject.name}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{activeProject.description}</p>
                  <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-500">
                    <span>Ecosystem: {activeProject.blockchain}</span>
                    <span>•</span>
                    <span>Modules: {activeProject.files.length}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Upload module
            <div className="space-y-4">
              {/* Drag n drop container */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : theme === 'dark'
                    ? 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".sol,.rs,.move,.tact,.vy,.py"
                  className="hidden"
                />
                
                {uploadedFiles.length > 0 ? (
                  <div className="space-y-2 text-center">
                    <FileCode className="w-8 h-8 mx-auto text-emerald-400" />
                    <p className="text-xs font-bold truncate max-w-[200px] mx-auto">{uploadedFiles[0].path}</p>
                    <p className="text-[10px] text-slate-400">File size: {(uploadedFiles[0].content.length / 1024).toFixed(2)} KB</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFiles([]);
                      }}
                      className="text-rose-400 text-[10px] hover:underline"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-slate-500" />
                    <p className="text-xs font-semibold">Drag & drop your smart contract</p>
                    <p className="text-[10px] text-slate-400">Supports .sol, .rs (Solana), .move (Sui/Aptos)</p>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded inline-block font-mono mt-1">Browse Files</span>
                  </div>
                )}
              </div>

              {/* Uploaded chain parameters */}
              {uploadedFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Chain</label>
                    <select
                      value={uploadedChain}
                      onChange={(e) => setUploadedChain(e.target.value)}
                      className={`w-full text-xs p-2 rounded-lg border focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <option value="ethereum">Ethereum (L2s)</option>
                      <option value="solana">Solana</option>
                      <option value="sui">Sui Ecosystem</option>
                      <option value="aptos">Aptos Network</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Language</label>
                    <select
                      value={uploadedLang}
                      onChange={(e) => setUploadedLang(e.target.value)}
                      className={`w-full text-xs p-2 rounded-lg border focus:outline-none ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <option value="solidity">Solidity</option>
                      <option value="rust">Rust</option>
                      <option value="move">Move</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            onClick={triggerAudit}
            disabled={isProcessing || (auditMode === 'existing' && !activeProject) || (auditMode === 'upload' && uploadedFiles.length === 0)}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Auditing Workspace...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-emerald-300" />
                Audit Smart Contract
              </>
            )}
          </button>
        </div>

        {/* Right Audit Report / Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Loading progress pane */}
          {isProcessing && (
            <div className={`p-6 rounded-xl border space-y-4 shadow-sm animate-pulse ${
              theme === 'dark' ? 'bg-slate-900/20 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-emerald-400 animate-spin" />
                <div>
                  <h3 className="text-xs uppercase font-bold tracking-wider text-emerald-400">AI Cyber Threat Simulator</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Analysing target code variables for vulnerabilities...</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-1000" 
                  style={{ width: `${((auditProgressStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              {/* Custom Console output logs */}
              <div className="bg-slate-950 rounded-lg p-3 font-mono text-[10px] text-slate-400 border border-slate-900 max-h-36 overflow-y-auto space-y-1">
                {auditProgressLogs.map((log, idx) => (
                  <p key={idx} className={log.includes('[SUCCESS]') ? 'text-emerald-400' : 'text-slate-400'}>
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Audit Result Display */}
          {localAuditResult ? (
            <div className="space-y-6">
              {/* Score header box */}
              <div className={`p-6 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 ${
                theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                {/* Score gauge */}
                <div className="flex items-center gap-4">
                  <div className={`relative flex items-center justify-center h-20 w-20 rounded-full border-4 ${
                    localAuditResult.score >= 90 
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                      : localAuditResult.score >= 75 
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                      : 'border-red-500 bg-red-500/10 text-red-400'
                  }`}>
                    <span className="text-2xl font-bold leading-none">{localAuditResult.score}</span>
                    <span className="absolute bottom-2 text-[6px] uppercase font-black tracking-widest text-slate-400">Score</span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-lg font-bold tracking-tight">Security Audit Approved</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Rating: <span className={
                        localAuditResult.score >= 90 ? 'text-emerald-400' : localAuditResult.score >= 75 ? 'text-amber-400' : 'text-red-400'
                      }>
                        {localAuditResult.score >= 90 ? 'SECURE GRADE A+' : localAuditResult.score >= 75 ? 'WARN GRADE B' : 'CRITICAL THREATS'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Submetrics list */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Code Quality</span>
                    <span className="text-sm font-extrabold text-slate-300">{localAuditResult.codeQuality}/100</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Gas Opt</span>
                    <span className="text-sm font-extrabold text-slate-300">{localAuditResult.gasOptimization}/100</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Complexity</span>
                    <span className="text-sm font-extrabold text-slate-300">{localAuditResult.complexity}/10</span>
                  </div>
                </div>

                {/* Export button */}
                <button
                  onClick={handleExportReportMarkdown}
                  className={`flex items-center gap-1 bg-slate-950 text-slate-300 hover:bg-slate-900 border border-slate-800 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Report
                </button>
              </div>

              {/* Summary box */}
              <div className={`p-5 rounded-xl border space-y-2.5 ${
                theme === 'dark' ? 'bg-slate-900/20 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                  <FileText className="w-4 h-4" />
                  AI Threat-Model Overview
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{localAuditResult.summary}</p>
              </div>

              {/* Vulnerabilities itemized accordion */}
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Detected Vulnerabilities ({localAuditResult.vulnerabilities.length})</span>
                  {localAuditResult.vulnerabilities.length === 0 && <span className="text-emerald-500 font-semibold text-[10px]">Fully Cleaned ✅</span>}
                </h3>

                {localAuditResult.vulnerabilities.length === 0 ? (
                  <div className={`p-6 text-center border rounded-xl bg-emerald-500/5 border-emerald-500/20`}>
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-emerald-400">Excellent! Smart Contract is fully secure.</p>
                    <p className="text-[10px] text-slate-400 mt-1">No vulnerabilities mapping to overflow, reentrancy or authorization failure were detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {localAuditResult.vulnerabilities.map((vuln) => {
                      const isExpanded = !!expandedVulns[vuln.id];
                      
                      // Severity style mapping
                      const sevStyles = {
                        critical: 'bg-red-500/15 text-red-400 border-red-500/30',
                        high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                        medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                        low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                        informational: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }[vuln.severity];

                      return (
                        <div 
                          key={vuln.id}
                          className={`rounded-lg border overflow-hidden transition-all duration-300 ${
                            theme === 'dark' ? 'bg-slate-900/20 border-slate-850' : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Accordion Trigger */}
                          <div 
                            onClick={() => toggleVuln(vuln.id)}
                            className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/10 transition-colors select-none`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded border tracking-wider ${sevStyles}`}>
                                {vuln.severity}
                              </span>
                              <span className="text-xs font-bold truncate text-slate-200">{vuln.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                                {vuln.file} (Line: {vuln.line || 'N/A'})
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </div>
                          </div>

                          {/* Accordion Body */}
                          {isExpanded && (
                            <div className={`p-4 border-t space-y-4 text-xs font-sans ${theme === 'dark' ? 'border-slate-850 bg-slate-950/40' : 'border-slate-100 bg-slate-50/40'}`}>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Flaw Analysis</span>
                                <p className="text-slate-300 leading-relaxed">{vuln.description}</p>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Suggested Mitigation Recommendation</span>
                                <div className="bg-slate-950 p-3 rounded border border-slate-900 text-[11px] font-mono leading-relaxed text-slate-300 whitespace-pre-wrap">
                                  {vuln.recommendation}
                                </div>
                              </div>

                              {/* Apply AI remediation button */}
                              <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                  onClick={() => applyFix(vuln)}
                                  className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 shadow-md transition-all"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                                  Apply AI Remediation Fix
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Idle placeholder
            <div className={`p-12 text-center rounded-xl border border-dashed flex flex-col items-center justify-center space-y-3 min-h-[300px] ${
              theme === 'dark' ? 'border-slate-800 bg-slate-900/10' : 'border-slate-200 bg-white'
            }`}>
              <Shield className="w-12 h-12 text-slate-600" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-300">Auditor Awaiting Input</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Select a created contract or upload a custom smart contract file from the left control card to run detailed, AI-backed static analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
