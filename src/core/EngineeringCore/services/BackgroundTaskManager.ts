import { ProjectFile } from '../../../types';

export type TaskPriority = 'Highest' | 'Medium' | 'Lowest';
export type TaskState = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Retrying' | 'Progress';

export interface BackgroundTask {
  id: string;
  name: string;
  category: 'Workspace' | 'Compiler' | 'Security' | 'Architecture' | 'Testing' | 'Documentation' | 'Certification' | 'Regression' | 'Export';
  priority: TaskPriority;
  state: TaskState;
  progress: number; // 0 - 100
  detail: string;
  startTime?: number;
  endTime?: number;
  durationMs?: number;
  error?: string;
  cached?: boolean;
  fn?: () => Promise<any>;
}

export interface PerformanceTimings {
  workspaceCreationMs: number;
  editorLoadMs: number;
  compilerMs: number;
  documentationMs: number;
  securityMs: number;
  testingMs: number;
  certificationMs: number;
  exportPrepMs: number;
  totalBlockingMs: number;
  totalBackgroundMs: number;
}

export type TaskManagerListener = (tasks: BackgroundTask[], timings: PerformanceTimings) => void;

interface CacheEntry {
  hash: string;
  data: any;
  timestamp: number;
}

export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, BackgroundTask> = new Map();
  private listeners: TaskManagerListener[] = [];
  private isProcessingQueue = false;
  private cache: Map<string, CacheEntry> = new Map();

  private timings: PerformanceTimings = {
    workspaceCreationMs: 0,
    editorLoadMs: 0,
    compilerMs: 0,
    documentationMs: 0,
    securityMs: 0,
    testingMs: 0,
    certificationMs: 0,
    exportPrepMs: 0,
    totalBlockingMs: 0,
    totalBackgroundMs: 0,
  };

  private constructor() {}

  public static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Fast hash function for file collections to support caching unchanged reports
   */
  public computeFilesHash(files: ProjectFile[]): string {
    if (!files || files.length === 0) return 'empty';
    let str = '';
    for (let i = 0; i < files.length; i++) {
      str += `${files[i].path}:${files[i].content?.length || 0};`;
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `hash-${hash}`;
  }

  /**
   * Subscribe to task manager updates
   */
  public subscribe(listener: TaskManagerListener): () => void {
    this.listeners.push(listener);
    // Initial emission
    listener(this.getTasksList(), { ...this.timings });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const taskList = this.getTasksList();
    const timingsCopy = { ...this.timings };
    this.listeners.forEach(l => {
      try {
        l(taskList, timingsCopy);
      } catch (err) {
        console.error('[BackgroundTaskManager] Listener error:', err);
      }
    });
  }

  public recordTiming<K extends keyof PerformanceTimings>(key: K, durationMs: number): void {
    this.timings[key] = Math.round(durationMs * 100) / 100;
    this.notifyListeners();
  }

  public getTimings(): PerformanceTimings {
    return { ...this.timings };
  }

  /**
   * Enqueue or update a background task
   */
  public enqueue(taskInput: Omit<BackgroundTask, 'state' | 'progress'> & { fn: () => Promise<any> }): void {
    const existing = this.tasks.get(taskInput.id);
    
    const newTask: BackgroundTask = {
      ...taskInput,
      state: 'Queued',
      progress: 0,
      detail: taskInput.detail || 'Queued for background execution',
    };

    this.tasks.set(taskInput.id, newTask);
    this.notifyListeners();

    // Trigger processing
    this.processQueue();
  }

  /**
   * Record a blocking task that ran synchronously during initial load
   */
  public recordBlockingTask(
    id: string,
    name: string,
    category: BackgroundTask['category'],
    durationMs: number,
    detail: string = 'Completed before IDE hydration'
  ): void {
    const completedTask: BackgroundTask = {
      id,
      name,
      category,
      priority: 'Highest',
      state: 'Completed',
      progress: 100,
      detail,
      durationMs,
      startTime: Date.now() - durationMs,
      endTime: Date.now(),
    };
    this.tasks.set(id, completedTask);
    this.notifyListeners();
  }

  public updateProgress(taskId: string, progress: number, detail?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.progress = Math.min(100, Math.max(0, progress));
    if (detail) task.detail = detail;
    if (task.state !== 'Running') task.state = 'Running';
    this.notifyListeners();
  }

  /**
   * Process queued tasks according to priority order
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (true) {
        // Get all queued tasks
        const queuedTasks = Array.from(this.tasks.values()).filter(t => t.state === 'Queued');
        if (queuedTasks.length === 0) break;

        // Sort by priority category: Security -> Compiler -> Architecture -> Testing -> Documentation, and then task priority
        queuedTasks.sort((a, b) => {
          const categoryOrder: Record<BackgroundTask['category'], number> = {
            Security: 1,
            Compiler: 2,
            Architecture: 3,
            Testing: 4,
            Documentation: 5,
            Workspace: 6,
            Certification: 7,
            Regression: 8,
            Export: 9
          };
          const orderA = categoryOrder[a.category] || 99;
          const orderB = categoryOrder[b.category] || 99;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          const priorityOrder: Record<TaskPriority, number> = { Highest: 1, Medium: 2, Lowest: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        const taskToRun = queuedTasks[0];
        await this.runTask(taskToRun);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async runTask(task: BackgroundTask): Promise<void> {
    if (!task.fn) {
      task.state = 'Completed';
      task.progress = 100;
      this.notifyListeners();
      return;
    }

    task.state = 'Running';
    task.progress = 10;
    task.startTime = Date.now();
    task.detail = `Executing ${task.name}...`;
    this.notifyListeners();

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const result = await task.fn();
        task.endTime = Date.now();
        task.durationMs = task.endTime - (task.startTime || task.endTime);
        task.state = 'Completed';
        task.progress = 100;
        task.detail = `Finished in ${task.durationMs}ms`;
        
        // Record timings based on category
        if (task.category === 'Documentation') this.timings.documentationMs = task.durationMs;
        if (task.category === 'Security') this.timings.securityMs = task.durationMs;
        if (task.category === 'Testing') this.timings.testingMs = task.durationMs;
        if (task.category === 'Certification') this.timings.certificationMs = task.durationMs;
        if (task.category === 'Export') this.timings.exportPrepMs = task.durationMs;

        this.notifyListeners();
        return result;
      } catch (err: any) {
        console.warn(`[BackgroundTaskManager] Task ${task.name} attempt ${attempts} failed:`, err);
        if (attempts < maxAttempts) {
          task.state = 'Retrying';
          task.detail = `Retrying attempt ${attempts + 1}...`;
          this.notifyListeners();
          await new Promise(r => setTimeout(r, 200));
        } else {
          task.endTime = Date.now();
          task.durationMs = task.endTime - (task.startTime || task.endTime);
          task.state = 'Failed';
          task.error = err.message || String(err);
          task.detail = `Failed: ${task.error}`;
          this.notifyListeners();
        }
      }
    }
  }

  /**
   * Check if all export preparation background tasks are finished
   */
  public isExportReady(): boolean {
    const exportTasks = Array.from(this.tasks.values()).filter(t => t.category === 'Export' || t.id.includes('export') || t.id.includes('manifest'));
    if (exportTasks.length === 0) return true;
    return exportTasks.every(t => t.state === 'Completed' || t.state === 'Failed');
  }

  /**
   * Promise that resolves when all background tasks are completed or failed
   */
  public async waitForExportReady(): Promise<boolean> {
    if (this.isExportReady()) return true;
    return new Promise((resolve) => {
      const check = () => {
        if (this.isExportReady()) {
          resolve(true);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  public getTasksList(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  public getCache(key: string, currentHash: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.hash === currentHash) {
      return entry.data;
    }
    return null;
  }

  public setCache(key: string, currentHash: string, data: any): void {
    this.cache.set(key, { hash: currentHash, data, timestamp: Date.now() });
  }

  public clearAll(): void {
    this.tasks.clear();
    this.notifyListeners();
  }
}
