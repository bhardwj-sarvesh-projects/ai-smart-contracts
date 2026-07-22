import { ProjectRequirements, SecurityPlan } from '../types';

export class SecurityPlanner {
  static plan(req: ProjectRequirements): SecurityPlan {
    const prompt = req.businessGoal.toLowerCase();

    const accessControl = req.securityRequirements.some(s => s.includes('AccessControl') || s.includes('Role')) || prompt.includes('role') || prompt.includes('admin') || prompt.includes('owner');
    const reentrancyProtection = prompt.includes('transfer') || prompt.includes('withdraw') || prompt.includes('deposit') || prompt.includes('call') || prompt.includes('swap') || prompt.includes('vault');
    const pausable = req.securityRequirements.some(s => s.includes('Pause')) || prompt.includes('pause') || prompt.includes('emergency');
    const emergencyRecovery = prompt.includes('recover') || prompt.includes('rescue') || prompt.includes('emergency');
    const timelock = prompt.includes('timelock') || prompt.includes('governance');
    const ecdsa = prompt.includes('signature') || prompt.includes('ecdsa') || prompt.includes('permit');
    const permit = prompt.includes('permit') || prompt.includes('eip-2612');

    return {
      accessControl,
      reentrancyProtection,
      pausable,
      emergencyRecovery,
      timelock,
      ecdsa,
      permit,
      replayProtection: ecdsa || permit,
      oracleValidation: prompt.includes('oracle') || prompt.includes('price') || prompt.includes('chainlink'),
      rateLimiting: prompt.includes('rate') || prompt.includes('limit') || prompt.includes('cooldown'),
      inputValidation: true,
      safeTransferPatterns: prompt.includes('token') || prompt.includes('erc20'),
      recommendedLibraries: [
        reentrancyProtection ? 'ReentrancyGuard' : null,
        accessControl ? 'AccessControl / Ownable' : null,
        pausable ? 'Pausable' : null,
        permit ? 'ERC20Permit' : null,
        'SafeERC20'
      ].filter(Boolean) as string[]
    };
  }
}
