import React, { useState } from 'react';
import { Sparkles, Check, Edit2, Play, ArrowRight, Shield, Database, Lock, Settings } from 'lucide-react';

interface PlanData {
  businessRequirements: string;
  architecture: string;
  storageDesign: string;
  permissionModel: string;
  events: string;
  customErrors: string;
  validationRules: string;
  securityConsiderations: string;
  folderStructure: string;
  testStrategy: string;
  deploymentStrategy: string;
}

interface ImplementationPlanViewProps {
  plan: PlanData;
  onApprove: (finalPlan: PlanData) => void;
  onCancel: () => void;
}

export default function ImplementationPlanView({
  plan,
  onApprove,
  onCancel
}: ImplementationPlanViewProps) {
  const [editedPlan, setEditedPlan] = useState<PlanData>(() => {
    const normalized = { ...plan };
    (Object.keys(normalized) as Array<keyof PlanData>).forEach((key) => {
      if (typeof normalized[key] === 'object' && normalized[key] !== null) {
        normalized[key] = JSON.stringify(normalized[key], null, 2) as any;
      }
    });
    return normalized;
  });
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  const handleFieldChange = (key: keyof PlanData, value: string) => {
    setEditedPlan(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleEdit = (key: string) => {
    setIsEditing(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const planSections: { key: keyof PlanData; title: string; desc: string; icon: any; color: string }[] = [
    {
      key: 'businessRequirements',
      title: 'Business Requirements',
      desc: 'Target business goals, user objectives, utility and tokenomics boundaries.',
      icon: Sparkles,
      color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
    },
    {
      key: 'architecture',
      title: 'System Architecture',
      desc: 'Module topology, decoupling strategies, third-party libraries and dependencies.',
      icon: ArrowRight,
      color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5'
    },
    {
      key: 'storageDesign',
      title: 'State & Storage Design',
      desc: 'Smart contract storage layout, keys, mappings, structural configurations, packing.',
      icon: Database,
      color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5'
    },
    {
      key: 'permissionModel',
      title: 'Permission & Access Control Model',
      desc: 'Administrative levels, roles, timelocks, and gated functions security modifiers.',
      icon: Lock,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    },
    {
      key: 'events',
      title: 'Events Logging Architecture',
      desc: 'Standard compliance indexing, auditable triggers, telemetry and off-chain sync hooks.',
      icon: Sparkles,
      color: 'text-teal-400 border-teal-500/20 bg-teal-500/5'
    },
    {
      key: 'customErrors',
      title: 'Optimized Custom Errors',
      desc: 'Gas-optimized custom error declarations, reverting gas limits and troubleshooting logs.',
      icon: Settings,
      color: 'text-purple-400 border-purple-500/20 bg-purple-500/5'
    },
    {
      key: 'validationRules',
      title: 'Validation & Boundary Checks',
      desc: 'Pre-execution state constraints, assert requirements, address checking guidelines.',
      icon: Shield,
      color: 'text-orange-400 border-orange-500/20 bg-orange-500/5'
    },
    {
      key: 'securityConsiderations',
      title: 'Security Auditing Mitigations',
      desc: 'Reentrancy guard strategies, overflow limits, frontrunning shielding and flashloans audits.',
      icon: Shield,
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/5'
    },
    {
      key: 'folderStructure',
      title: 'Planned Folder Structure',
      desc: 'Exact physical files and test directories laid out in the target framework format.',
      icon: Database,
      color: 'text-sky-400 border-sky-500/20 bg-sky-500/5'
    },
    {
      key: 'testStrategy',
      title: 'Test Assertions Strategy',
      desc: 'Planned unit testing scenarios, event validations, boundary checks, and coverage targets.',
      icon: Check,
      color: 'text-pink-400 border-pink-500/20 bg-pink-500/5'
    },
    {
      key: 'deploymentStrategy',
      title: 'Automated Deployment & Migration',
      desc: 'Target deployment networks, initializer parameters, automated verify scripts.',
      icon: Play,
      color: 'text-amber-500 border-amber-500/20 bg-amber-500/5'
    }
  ];

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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Pre-Generation Architect Plan</h3>
              <p className="text-[10px] text-slate-400">Review and refine the 11-step enterprise contract design plan before generating files.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 border border-slate-800 hover:bg-slate-800 rounded text-xs font-semibold text-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApprove(editedPlan)}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
              id="btn-approve-generation"
            >
              <Check className="w-3.5 h-3.5" />
              Approve & Generate Workspace
            </button>
          </div>
        </div>

        {/* Sections Scroll Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/20">
          {planSections.map(section => {
            const Icon = section.icon;
            const key = section.key;
            const editActive = isEditing[key];
            return (
              <div
                key={key}
                className="p-4 border border-slate-800/80 bg-slate-900/40 rounded-lg flex flex-col justify-between gap-3 group hover:border-slate-700 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={`p-1 border rounded ${section.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-white">{section.title}</span>
                    </div>
                    <button
                      onClick={() => toggleEdit(key)}
                      className="p-1 text-slate-500 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors"
                      title="Edit this section plan"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">{section.desc}</p>
                </div>

                {/* Edit Textarea vs Preview block */}
                <div className="flex-1 min-h-[80px]">
                  {editActive ? (
                    <textarea
                      value={getNormalizedContent(editedPlan[key])}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      rows={4}
                      className="w-full h-full bg-slate-950 border border-slate-800 rounded p-2 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="p-2.5 bg-slate-950/60 rounded border border-slate-850/50 text-[10px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                      {getNormalizedContent(editedPlan[key])}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-center text-[10px] text-slate-500 font-mono">
          <span>* Modifying the architect plan directs the Smart Contract Generation engine to implement specific constraints, security modules, and APIs.</span>
        </div>

      </div>
    </div>
  );
}
