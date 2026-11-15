import type {
  AdCopy,
  AspectRatio,
  BrandTone,
  ProductAnchor,
  ShotPlan,
} from '../entities/campaign';

export interface DirectorOutput {
  productDna: string;
  adCopy: AdCopy;
  shots: [ShotPlan, ShotPlan, ShotPlan];
  costUsd: number;
  model: string;
}

export interface CreativeDirectorPort {
  planCampaign(input: {
    product: ProductAnchor;
    tone: BrandTone;
    aspectRatio: AspectRatio;
    userGoal?: string;
  }): Promise<DirectorOutput>;
}

export interface ImageGenOutput {
  b64Json?: string;
  publicUrl?: string;
  costUsd: number;
  model: string;
}

export interface ImageGenPort {
  generateKeyframe(input: {
    prompt: string;
    referenceImageUrls: string[];
    aspectRatio: AspectRatio;
    model: string;
  }): Promise<ImageGenOutput>;
}

export interface VisionQaOutput {
  fidelityScore: number;
  defects: string[];
  refinedPrompt: string;
  costUsd: number;
  model: string;
}

export interface VisionQaPort {
  evaluateProductFidelity(input: {
    originalProductUrl: string;
    generatedKeyframeUrl: string;
    originalPrompt: string;
    productDna: string;
  }): Promise<VisionQaOutput>;
}

export interface VideoJobSubmission {
  jobId: string;
  model: string;
  estimatedCostUsd: number;
}

export interface VideoJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  playbackUrl?: string;
  actualCostUsd?: number;
  errorMessage?: string;
}

export interface VideoGenPort {
  submitImageToVideo(input: {
    prompt: string;
    firstFrameUrl: string;
    lastFrameUrl?: string;
    aspectRatio: AspectRatio;
    durationSeconds: 4 | 5;
    model: string;
  }): Promise<VideoJobSubmission>;

  getJobStatus(jobId: string): Promise<VideoJobStatus>;
}

export interface AssetStoragePort {
  savePublicImageFromBase64(b64Json: string, filename: string): Promise<string>;
}
