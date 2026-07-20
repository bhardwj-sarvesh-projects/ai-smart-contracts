import React, { useState, useEffect } from 'react';
import { X, Layers, Sparkles, AlertTriangle, ArrowRight, RefreshCw, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BLOCKCHAINS } from '../data/templates';

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
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh] my-auto"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
              Configure New Smart Contract
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Name */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
                Project Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Escrow Platform"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl h-10 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors w-full"
              />
            </div>

            {/* Contract Type */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
                Blueprint / Contract Standard
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl h-10 px-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer w-full"
              >
                {SMART_CONTRACT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Description */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
              Short Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Multi-signature escrow contract split 60/40 between builders and platform DAO."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl h-10 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors w-full"
            />
          </div>

          {/* Grid of Blockchain Selection Cards (Interactive visual list rather than simple selects) */}
          <div className="flex flex-col space-y-2">
            <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
              Target Blockchain Network
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {BLOCKCHAINS.slice(0, 8).map(b => {
                const isSelected = b.id === selectedBlockchain;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBlockchain(b.id)}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer relative ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/55 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700/80 hover:bg-slate-950/80'
                    }`}
                  >
                    <span className="text-base">
                      {b.id === 'ethereum' ? '🌐' : b.id === 'solana' ? '⚡' : b.id === 'sui' ? '💧' : b.id === 'aptos' ? '🦖' : '⛓️'}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider">
                      {b.name}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 bg-cyan-500 text-slate-950 rounded-full p-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[4]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-selectors (Language and Framework) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Language Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
                Smart Contract Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl h-10 px-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer w-full"
              >
                {activeBlockchainConfig.languages.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Framework Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
                Developer Tool Framework
              </label>
              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl h-10 px-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer w-full"
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
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider font-mono">
                Explain Contract Requirements
              </label>
              <span className="text-[9px] text-cyan-400 font-mono font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" /> AI Agentic Assembler
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Describe exactly what your contract should do. (e.g. Create an ERC20 token with capped minting, owner-only pause function, and optimized gas parameters...)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/25 resize-none font-mono leading-relaxed"
            />
          </div>

          {/* Warning or Explanations */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/80 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              <strong>Enterprise Hardening Protocol:</strong> Your requirements prompt is run through an internal validator layer. It will auto-inject safety modifiers (OpenZeppelin standards, reentrancy locks, arithmetic overflow safeguards) to maintain enterprise-grade compliance.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 sticky bottom-0 bg-slate-900 border-t border-slate-850/30 -mx-6 -mb-6 p-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2.5 border border-slate-800 hover:bg-slate-800/60 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !name.trim()}
              className="px-5.5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Workspace...
                </>
              ) : (
                <>
                  Generate Contracts <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
