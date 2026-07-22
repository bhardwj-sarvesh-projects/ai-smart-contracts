import { AuditResult, Project } from '../../types';

export class AuditService {
  static async auditProject(project: Project, authedFetch: (url: string, options?: any) => Promise<any>): Promise<AuditResult> {
    const res = await authedFetch(`/api/projects/${project.id}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Perform security audit scan on project files for ${project.name}`,
        files: project.files,
        blockchain: project.blockchain,
      }),
    });

    if (!res.ok) {
      throw new Error('Audit scan API request failed');
    }

    const data = await res.json();
    return data.audit || data;
  }
}
