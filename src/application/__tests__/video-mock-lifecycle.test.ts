import { describe, expect, it } from 'vitest';
import { MockVideoAdapter } from '@/infrastructure/mocks/mock-adapters';

describe('MockVideoAdapter lifecycle', () => {
  it('progresses cleanly through queued -> processing -> completed', async () => {
    const adapter = new MockVideoAdapter();

    const submission = await adapter.submitImageToVideo({
      prompt: 'Cinematic orbit push-in',
      firstFrameUrl: '/fixtures/perfume-anchor.jpeg',
      lastFrameUrl: '/fixtures/watch-anchor.jpeg',
      aspectRatio: '9:16',
      durationSeconds: 4,
      model: 'bytedance/seedance-2.0-fast',
    });

    expect(submission.jobId).toMatch(/^mock-vid-/);
    expect(submission.estimatedCostUsd).toBe(0);

    const statuses: string[] = [];
    let status = await adapter.getJobStatus(submission.jobId);
    statuses.push(status.status);

    while (status.status !== 'completed' && statuses.length < 5) {
      status = await adapter.getJobStatus(submission.jobId);
      statuses.push(status.status);
    }

    expect(statuses).toEqual(['queued', 'processing', 'completed']);
    expect(status.progress).toBe(100);
    expect(status.playbackUrl).toBe('/fixtures/sample-clip.mp4');
    expect(status.actualCostUsd).toBe(0);
  });

  it('returns the showcase clip that matches the submitted keyframe', async () => {
    const adapter = new MockVideoAdapter();

    const submission = await adapter.submitImageToVideo({
      prompt: 'Handheld parallax drift',
      firstFrameUrl: '/fixtures/oud-perfume/shot-2.jpeg',
      lastFrameUrl: '/fixtures/oud-perfume/shot-3.jpeg',
      aspectRatio: '9:16',
      durationSeconds: 4,
      model: 'google/veo-3.1-lite',
    });

    let status = await adapter.getJobStatus(submission.jobId);
    let polls = 1;
    while (status.status !== 'completed' && polls < 5) {
      status = await adapter.getJobStatus(submission.jobId);
      polls += 1;
    }

    expect(status.playbackUrl).toBe('/fixtures/oud-perfume/shot-2.mp4');
  });
});
