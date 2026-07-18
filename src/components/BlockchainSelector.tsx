import React, { useState, useEffect } from 'react';
import { X, Layers, Sparkles, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { SmartContractTemplate } from '../types';
import { BLOCKCHAINS, TEMPLATES } from '../data/templates';

interface BlockchainSelectorProps {
  onClose: () => void;
  onCreateProject: (projectData: {
    name: string;
    description: string;
    blockchain: string;
    language: string;
    framework: string;
    contractType: string;
    prompt: string;
  }) => void;
  isGenerating: boolean;
}

const SMART_CONTRACT_TYPES = [
  'ERC20 Token',
  'ERC721 NFT',
  'ERC1155 Multi-Token',
  'Escrow Exchange',
  'DAO Voting & Governance',
  'Multisig Wallet',
  'Staking & Yield Farming',
  'Lending & Borrowing Pool',
  'DEX / Automated Market Maker',
  'Cross-Chain Bridge',
  'Token Vesting / Lockbox',
  'NFT Marketplace / Auction',
  'Custom Contract'
];

export default function BlockchainSelector({
  onClose,
  onCreateProject,
  isGenerating
}: BlockchainSelectorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBlockchain, setSelectedBlockchain] = useState('ethereum');
  const [selectedLanguage, setSelectedLanguage] = useState('solidity');
  const [selectedFramework, setSelectedFramework] = useState('Hardhat');
  const [selectedType, setSelectedType] = useState('ERC20 Token');
  const [prompt, setPrompt] = useState('');

  // Find configuration for the selected blockchain
  const activeBlockchainConfig = BLOCKCHAINS.find(b => b.id === selectedBlockchain) || BLOCKCHAINS[0];

  // Update selected language and framework dynamically on blockchain switch
  useEffect(() => {
    if (activeBlockchainConfig.languages.length > 0) {
      const defaultLang = activeBlockchainConfig.languages[0];
      setSelectedLanguage(defaultLang.id);
      if (defaultLang.frameworks.length > 0) {
        setSelectedFramework(defaultLang.frameworks[0]);
      } else {
        setSelectedFramework('Default');
      }
    }
  }, [selectedBlockchain]);

  // Update frameworks on language switch
  useEffect(() => {
    const langConfig = activeBlockchainConfig.languages.find(l => l.id === selectedLanguage);
    if (langConfig && langConfig.frameworks.length > 0) {
      setSelectedFramework(langConfig.frameworks[0]);
    } else {
      setSelectedFramework('Default');
    }
  }, [selectedLanguage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateProject({
      name: name.trim(),
      description: description.trim(),
      blockchain: selectedBlockchain,
      language: selectedLanguage,
      framework: selectedFramework,
      contractType: selectedType,
      prompt: prompt.trim()
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configure New Smart Contract Project</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Project Name */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Project Name</label>
              <input
                type="text"
                required
                placeholder="e.g. USDC Escrow Platform"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Contract Type */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Contract Blueprint / Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                {SMART_CONTRACT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Description */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Enterprise escrow contract holding ERC20 deposits and exchanging native SOL securely."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Blockchain Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Blockchain Network</label>
              <select
                value={selectedBlockchain}
                onChange={(e) => setSelectedBlockchain(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                {BLOCKCHAINS.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Language Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                {activeBlockchainConfig.languages.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Framework Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Dev Framework</label>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                {activeBlockchainConfig.languages.find(l => l.id === selectedLanguage)?.frameworks.map(f => (
                  <option key={f} value={f}>{f}</option>
                )) || <option value="Default">Default</option>}
              </select>
            </div>
          </div>

          {/* AI Specification Builder Prompt */}
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Describe Contract Requirements (AI Specification Prompt)
              </label>
              <span className="text-[9px] text-cyan-400 font-mono font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto Expanded Specifications
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="e.g. Create a secure payment splitter contract where funds are split 60/40 between two predefined wallet addresses with safe withdrawal methods and reentrancy protections..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none font-mono"
            />
          </div>

          {/* Warning or Explanations */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <strong>Security Protocol Enabled:</strong> The prompt is automatically expanded to satisfy OpenZeppelin rules, Solc gas optimizations, safe integer arithmetic, reentrancy guards, and access permissions logic before the AI writes the smart contracts.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !name.trim()}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating Workspace...
                </>
              ) : (
                <>
                  Generate Contracts <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
