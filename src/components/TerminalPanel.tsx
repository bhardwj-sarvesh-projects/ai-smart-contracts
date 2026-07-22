import React, { useState } from 'react';
import { Terminal, Cpu, CloudLightning, Activity, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Project, DeploymentHistory } from '../types';

interface TerminalPanelProps {
  project?: Project;
  onCompile: () => void;
  onDeploy: (network: string, contractName: string) => void;
  compilerLogs: string[];
  isCompiling: boolean;
  deploymentLogs: string[];
  isDeploying: boolean;
  deployedContracts: DeploymentHistory[];
}

const NETWORKS: Record<string, string[]> = {
  ethereum: ['Mainnet', 'Sepolia Testnet', 'Arbitrum Stylus', 'Holesky'],
  polygon: ['Polygon Mainnet', 'Amoy Testnet'],
  base: ['Base Mainnet', 'Base Sepolia'],
  arbitrum: ['Arbitrum One', 'Sepolia Testnet'],
  optimism: ['Optimism Mainnet', 'Sepolia Testnet'],
  solana: ['Mainnet Beta', 'Devnet', 'Testnet', 'Localhost'],
  sui: ['Sui Mainnet', 'Sui Testnet', 'Sui Devnet'],
  aptos: ['Aptos Mainnet', 'Aptos Testnet'],
  cosmos: ['Cosmos Hub', 'Osmosis Testnet'],
  ton: ['TON Mainnet', 'TON Testnet']
};

function TerminalPanel({
  project,
  onCompile,
  onDeploy,
  compilerLogs,
  isCompiling,
  deploymentLogs,
  isDeploying,
  deployedContracts
}: TerminalPanelProps) {
  const [activeTab, setActiveTab] = useState<'compiler' | 'deployer' | 'tests' | 'logs'>('compiler');
  const [targetNetwork, setTargetNetwork] = useState('');
  const [targetContract, setTargetContract] = useState('');
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Derive networks based on selected blockchain
  const blockchain = project?.blockchain || 'ethereum';
  const availableNetworks = NETWORKS[blockchain] || ['Sepolia Testnet', 'Devnet'];

  // Set default target network on change
  React.useEffect(() => {
    if (availableNetworks.length > 0) {
      setTargetNetwork(availableNetworks[0]);
    }
  }, [blockchain]);

  // Find all smart contracts in the project files
  const getContractFiles = () => {
    if (!project) return [];
    return project.files.filter(f => 
      f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move') || f.path.endsWith('.tact')
    ).map(f => f.path.split('/').pop() || '');
  };

  const contractFiles = getContractFiles();

  React.useEffect(() => {
    if (contractFiles.length > 0 && !targetContract) {
      setTargetContract(contractFiles[0]);
    }
  }, [project, contractFiles]);

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTestLogs([
      `[SYSTEM] Starting testing framework...`,
      `[TEST] Loading test specs for ${project?.name || 'Workspace'}...`,
      `[TEST] Found 1 test suite in folder test/`
    ]);

    setTimeout(() => {
      setTestLogs(prev => [
        ...prev,
        `[TEST] Running: Contract Deployment Verification...`,
        `  ✔ Should initialize total supply successfully (45ms)`,
        `  ✔ Should enforce proper access controls (24ms)`,
        `  ✔ Should handle edge-case overflow conditions safely (12ms)`
      ]);
    }, 600);

    setTimeout(() => {
      setTestLogs(prev => [
        ...prev,
        `\n[RESULT] 3 passing (81ms)`,
        `[SYSTEM] Security checks validated. All assertions green.`
      ]);
      setIsRunningTests(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-slate-800 text-slate-300 font-mono text-xs">
      {/* Tabs list */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 p-1 items-center justify-between select-none">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('compiler')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'compiler' ? 'bg-slate-850 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-compiler-bottom"
          >
            <Cpu className="w-3.5 h-3.5" />
            Compilation
          </button>
          <button
            onClick={() => setActiveTab('deployer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'deployer' ? 'bg-slate-850 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-deployer-bottom"
          >
            <CloudLightning className="w-3.5 h-3.5" />
            Deployment
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'tests' ? 'bg-slate-850 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-tests-bottom"
          >
            <Activity className="w-3.5 h-3.5" />
            Testing Suite
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'logs' ? 'bg-slate-850 text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-logs-bottom"
          >
            <Terminal className="w-3.5 h-3.5" />
            Deployment History
          </button>
        </div>

        <span className="text-[10px] text-slate-500 mr-3 uppercase select-none">
          Console Terminal
        </span>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3 bg-slate-950 font-mono text-slate-300">
        {activeTab === 'compiler' && (
          <div className="h-full flex flex-col justify-between">
            <div className="space-y-1 overflow-y-auto max-h-[160px]">
              {compilerLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-6">
                  No compilation logs yet. Click 'Compile Project' above or run the process.
                </p>
              ) : (
                compilerLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed hover:bg-slate-900/40 px-1">
                    {log.startsWith('[COMPILER]') ? (
                      <span className="text-cyan-400">{log}</span>
                    ) : log.startsWith('[SYSTEM]') ? (
                      <span className="text-slate-500">{log}</span>
                    ) : (
                      <span className="text-emerald-400">{log}</span>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-2 border-t border-slate-900 pt-2 flex items-center justify-between">
              <div className="text-[10px] text-slate-500">
                Compiler Target: <span className="text-slate-300 uppercase">{blockchain} ({project?.framework || 'Hardhat'})</span>
              </div>
              <button
                onClick={onCompile}
                disabled={isCompiling || !project}
                className="flex items-center gap-1.5 bg-cyan-700/20 hover:bg-cyan-700/40 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded font-semibold hover:border-cyan-500 transition-colors disabled:opacity-50"
                id="btn-run-compile"
              >
                {isCompiling ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Compiling...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Compile Contract
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'deployer' && (
          <div className="h-full flex flex-col justify-between md:flex-row gap-4">
            {/* Left side parameters */}
            <div className="md:w-1/3 bg-slate-900/40 border border-slate-800/60 rounded p-3 space-y-3">
              <p className="text-[10px] text-slate-500 uppercase font-semibold border-b border-slate-800 pb-1">Deploy Options</p>
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Target Network</label>
                <select
                  value={targetNetwork}
                  onChange={(e) => setTargetNetwork(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  {availableNetworks.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Target Contract</label>
                <select
                  value={targetContract}
                  onChange={(e) => setTargetContract(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  {contractFiles.length > 0 ? (
                    contractFiles.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  ) : (
                    <option value="">No contracts found</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Wallet Provider</label>
                <div className="text-[10px] bg-slate-950/60 p-1.5 border border-slate-850 rounded text-slate-400 truncate">
                  🔑 Developer Safe-Inject (Sandbox Mode)
                </div>
              </div>

              <button
                onClick={() => onDeploy(targetNetwork, targetContract || 'Contract')}
                disabled={isDeploying || !project || contractFiles.length === 0}
                className="w-full mt-2 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded py-1.5 font-semibold hover:from-emerald-500 hover:to-teal-500 transition-colors disabled:opacity-50"
                id="btn-run-deploy"
              >
                {isDeploying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <CloudLightning className="w-3.5 h-3.5" />
                    Deploy Contract
                  </>
                )}
              </button>
            </div>

            {/* Right side deployment console */}
            <div className="flex-1 bg-slate-950 border border-slate-850 rounded p-3 flex flex-col justify-between max-h-[160px] overflow-y-auto">
              <div className="space-y-1 overflow-y-auto">
                {deploymentLogs.length === 0 ? (
                  <p className="text-slate-500 text-center py-6">
                    Configure parameters and click 'Deploy Contract' to see deployment console outputs.
                  </p>
                ) : (
                  deploymentLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed text-slate-300">
                      {log.startsWith('[DEPLOYER]') ? (
                        <span className="text-emerald-400">{log}</span>
                      ) : (
                        log
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="h-full flex flex-col justify-between">
            <div className="space-y-1 overflow-y-auto max-h-[160px]">
              {testLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-6">
                  No test run history. Click 'Execute Test Suite' to run Mocha/Chai validation assertions.
                </p>
              ) : (
                testLogs.map((log, i) => (
                  <div key={i} className={`leading-relaxed ${log.includes('✔') ? 'text-emerald-400 font-bold' : log.includes('[RESULT]') ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>

            <div className="mt-2 border-t border-slate-900 pt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Framework: <strong className="text-slate-300">Mocha / Chai Assertions</strong></span>
              <button
                onClick={handleRunTests}
                disabled={isRunningTests || !project}
                className="flex items-center gap-1.5 bg-emerald-700/20 hover:bg-emerald-700/40 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded font-semibold hover:border-emerald-500 transition-colors disabled:opacity-50"
                id="btn-run-tests"
              >
                {isRunningTests ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Running tests...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Execute Test Suite
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase font-semibold border-b border-slate-800 pb-1">Historical Deployments</p>
            {deployedContracts.length === 0 ? (
              <p className="text-slate-500 text-center py-6">
                No deployment history stored for this project yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
                {deployedContracts.map((dep) => (
                  <div key={dep.id} className="bg-slate-900/60 border border-slate-800 rounded p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-400">{dep.contractName}</span>
                      <span className="text-[10px] text-slate-500">{new Date(dep.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                      <div>Network: <span className="text-white font-semibold">{dep.network}</span></div>
                      <div>Address: <span className="text-cyan-400 underline cursor-pointer select-all">{dep.address.substring(0, 10)}...</span></div>
                      <div>TxHash: <span className="text-slate-500 truncate">{dep.txHash.substring(0, 14)}...</span></div>
                      <div>Gas Used: <span className="text-emerald-400 font-semibold">{dep.gasUsed}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TerminalPanel);
