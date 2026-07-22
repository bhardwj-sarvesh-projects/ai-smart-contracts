import { DeploymentHistory, Project } from '../../types';

export class DeploymentService {
  static async deployContract(
    project: Project,
    network: string,
    authedFetch: (url: string, options?: any) => Promise<any>
  ): Promise<DeploymentHistory> {
    const res = await authedFetch(`/api/projects/${project.id}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        network,
        files: project.files,
        blockchain: project.blockchain,
      }),
    });

    if (!res.ok) {
      throw new Error('Deployment execution failed');
    }

    const json = await res.json();
    return json.deployment;
  }
}
