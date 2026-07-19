export interface AIProvider {
  generate(prompt: string): Promise<string>;

  generatePlan(prompt: string): Promise<string>;

  audit(prompt: string): Promise<string>;

  edit(prompt: string): Promise<string>;

  health(): Promise<{
    provider: string;
    connected: boolean;
    model: string;
  }>;
}