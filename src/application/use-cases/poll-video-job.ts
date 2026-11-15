import { InvalidWorkflowStateError } from '@/domain/errors/domain-errors';
import type { VideoGenPort, VideoJobStatus } from '@/domain/ports/media-ports';

export interface PollVideoJobDependencies {
  video: VideoGenPort;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 100);
}

/**
 * Normalizes provider-specific job status responses into the UI contract.
 */
export class PollVideoJobUseCase {
  constructor(private readonly dependencies: PollVideoJobDependencies) {}

  async execute(jobId: string): Promise<VideoJobStatus> {
    const normalizedJobId = jobId.trim();

    if (normalizedJobId === '') {
      throw new InvalidWorkflowStateError('A video job ID is required.');
    }

    const status = await this.dependencies.video.getJobStatus(normalizedJobId);

    return {
      ...status,
      jobId: status.jobId || normalizedJobId,
      progress: clampProgress(status.progress),
    };
  }
}
