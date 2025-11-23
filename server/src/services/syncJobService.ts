/**
 * Sync Job Service
 * Manages background sync jobs with progress tracking
 */

export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncJob {
  jobId: string;
  type: 'points-balances' | 'points-events' | 'users' | 'charges' | 'subscriptions';
  status: SyncJobStatus;
  progress: number; // 0-100
  total: number;
  processed: number;
  stepMessage: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: {
    success: boolean;
    message: string;
    count?: number;
  };
}

// In-memory job store (can be replaced with DB later)
const jobStore = new Map<string, SyncJob>();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new sync job
 */
export function createSyncJob(
  type: SyncJob['type'],
  workspaceId: string,
  total: number = 0
): SyncJob {
  const jobId = generateJobId();
  const job: SyncJob = {
    jobId,
    type,
    status: 'pending',
    progress: 0,
    total,
    processed: 0,
    stepMessage: 'Initializing sync...',
    workspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  jobStore.set(jobId, job);
  return job;
}

/**
 * Get a sync job by ID
 */
export function getSyncJob(jobId: string): SyncJob | null {
  return jobStore.get(jobId) || null;
}

/**
 * Update job progress
 */
export function updateJobProgress(
  jobId: string,
  updates: Partial<Pick<SyncJob, 'status' | 'progress' | 'total' | 'processed' | 'stepMessage' | 'error' | 'result'>>
): SyncJob | null {
  const job = jobStore.get(jobId);
  if (!job) {
    return null;
  }
  
  Object.assign(job, updates, { updatedAt: new Date() });
  
  // Auto-calculate progress if total is set
  if (job.total > 0 && updates.processed !== undefined) {
    job.progress = Math.min(Math.round((job.processed / job.total) * 100), 100);
  }
  
  // Set completedAt when status changes to completed or failed
  if ((updates.status === 'completed' || updates.status === 'failed') && !job.completedAt) {
    job.completedAt = new Date();
  }
  
  jobStore.set(jobId, job);
  return job;
}

/**
 * Mark job as completed
 */
export function completeJob(jobId: string, result: SyncJob['result']): SyncJob | null {
  return updateJobProgress(jobId, {
    status: 'completed',
    progress: 100,
    result,
    stepMessage: result?.message || 'Sync completed successfully',
  });
}

/**
 * Mark job as failed
 */
export function failJob(jobId: string, error: string): SyncJob | null {
  return updateJobProgress(jobId, {
    status: 'failed',
    error,
    stepMessage: `Sync failed: ${error}`,
  });
}

/**
 * Cancel a job
 */
export function cancelJob(jobId: string): SyncJob | null {
  return updateJobProgress(jobId, {
    status: 'cancelled',
    stepMessage: 'Sync cancelled by user',
  });
}

/**
 * Check for stuck jobs (running for more than 30 minutes) and mark them as failed
 */
export function checkStuckJobs(): number {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  let fixed = 0;
  
  for (const [jobId, job] of jobStore.entries()) {
    if (job.status === 'running' && job.updatedAt.getTime() < thirtyMinutesAgo) {
      console.warn(`[syncJobService] Marking stuck job ${jobId} as failed (last update: ${job.updatedAt.toISOString()})`);
      updateJobProgress(jobId, {
        status: 'failed',
        error: 'Job appears to be stuck (no progress for 30+ minutes)',
        stepMessage: 'Sync failed: Job timeout - no progress detected for 30+ minutes',
      });
      fixed++;
    }
  }
  
  return fixed;
}

// Check for stuck jobs every 5 minutes
setInterval(checkStuckJobs, 5 * 60 * 1000);

/**
 * Clean up old completed jobs (older than 1 hour)
 */
export function cleanupOldJobs(): number {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [jobId, job] of jobStore.entries()) {
    if (
      (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
      job.completedAt &&
      job.completedAt.getTime() < oneHourAgo
    ) {
      jobStore.delete(jobId);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Clean up old jobs every 10 minutes
setInterval(cleanupOldJobs, 10 * 60 * 1000);

