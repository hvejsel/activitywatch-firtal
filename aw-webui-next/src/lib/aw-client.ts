/**
 * ActivityWatch API Client
 * Connects to the local ActivityWatch server at http://localhost:5600
 */

const AW_SERVER_URL = process.env.NEXT_PUBLIC_AW_SERVER_URL || "http://localhost:5600";
const API_BASE = `${AW_SERVER_URL}/api/0`;

export interface AWEvent {
  id?: number;
  timestamp: string;
  duration: number;
  data: Record<string, unknown>;
}

export interface AWBucket {
  id: string;
  name?: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  last_updated?: string;
}

export interface ServerInfo {
  hostname: string;
  version: string;
  testing: boolean;
  device_id: string;
}

class AWClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`AW API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Server info
  async getServerInfo(): Promise<ServerInfo> {
    return this.fetch<ServerInfo>("/info");
  }

  // Buckets
  async getBuckets(): Promise<Record<string, AWBucket>> {
    return this.fetch<Record<string, AWBucket>>("/buckets/");
  }

  async getBucket(bucketId: string): Promise<AWBucket> {
    return this.fetch<AWBucket>(`/buckets/${bucketId}`);
  }

  // Events
  async getEvents(
    bucketId: string,
    options?: {
      limit?: number;
      start?: string;
      end?: string;
    }
  ): Promise<AWEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.start) params.set("start", options.start);
    if (options?.end) params.set("end", options.end);

    const query = params.toString();
    return this.fetch<AWEvent[]>(
      `/buckets/${bucketId}/events${query ? `?${query}` : ""}`
    );
  }

  async getEventCount(bucketId: string): Promise<number> {
    return this.fetch<number>(`/buckets/${bucketId}/events/count`);
  }

  // Query
  async query(
    timeperiods: string[],
    query: string[]
  ): Promise<unknown[][]> {
    return this.fetch<unknown[][]>("/query/", {
      method: "POST",
      body: JSON.stringify({
        timeperiods,
        query,
      }),
    });
  }

  // Export
  async exportBucket(bucketId: string): Promise<unknown> {
    return this.fetch(`/buckets/${bucketId}/export`);
  }

  async exportAll(): Promise<unknown> {
    return this.fetch("/export");
  }

  // Health check
  async isConnected(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const awClient = new AWClient();

// Utility functions
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function getTimeRange(period: "today" | "week" | "month"): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { start: start.toISOString(), end };
}

// Process Mining types
export interface ProcessSummary {
  id: string;
  name: string;
  processType: string;
  instanceCount: number;
  avgDuration: number;
  variantCount: number;
  firstSeen: string;
  lastSeen: string;
  linkedObjectTypes: string[];
}

export interface ProcessDetail {
  id: string;
  name: string;
  processType: string;
  description?: string;
  steps: ProcessStep[];
  variants: ProcessVariant[];
  instances: ProcessInstance[];
  linkedObjects: LinkedObject[];
  stats: ProcessStats;
}

export interface ProcessStep {
  id: string;
  name: string;
  action: string;
  avgDuration: number;
  frequency: number;
  order: number;
}

export interface ProcessVariant {
  id: string;
  steps: string[];
  frequency: number;
  avgDuration: number;
}

export interface ProcessInstance {
  id: string;
  processId: string;
  startTime: string;
  endTime: string;
  duration: number;
  steps: string[];
  status: "completed" | "in_progress" | "abandoned";
  linkedObjects: string[];
}

export interface LinkedObject {
  id: string;
  objectType: string;
  identifier: string;
  frequency: number;
}

export interface ProcessStats {
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  completionRate: number;
}

// Process Mining API Client Extension
class ProcessMiningClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`AW API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProcesses(): Promise<ProcessSummary[]> {
    return this.fetch<ProcessSummary[]>("/taskmining/processes");
  }

  async getProcess(processId: string): Promise<ProcessDetail> {
    return this.fetch<ProcessDetail>(`/taskmining/processes/${processId}`);
  }

  async getProcessInstances(processId: string): Promise<ProcessInstance[]> {
    return this.fetch<ProcessInstance[]>(`/taskmining/processes/${processId}/instances`);
  }

  async triggerAnalysis(): Promise<{ status: string; message: string }> {
    return this.fetch("/taskmining/analyze", { method: "POST" });
  }

  async getTaskMiningStatus(): Promise<{
    lastAnalysis: string | null;
    processCount: number;
    instanceCount: number;
    status: string;
  }> {
    return this.fetch("/taskmining/status");
  }
}

export const processMiningClient = new ProcessMiningClient();
