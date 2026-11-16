import type {
  AdCopy,
  AspectRatio,
  BrandTone,
  ProductAnchor,
  ShotPlan,
} from '../entities/campaign';
import type { VideoDurationSeconds } from '../entities/model-capabilities';

export interface DirectorOutput {
  productDna: string;
  adCopy: AdCopy;
  shots: ShotPlan[];
  costUsd: number;
  model: string;
}

export interface BriefDraftOutput {
  brief: string;
  costUsd: number;
  model: string;
}

export interface CreativeDirectorPort {
  planCampaign(input: {
    product: ProductAnchor;
    tone: BrandTone;
    aspectRatio: AspectRatio;
    shotCount: number;
    userGoal?: string;
    model: string;
  }): Promise<DirectorOutput>;

  /**
   * Drafts the optional campaign brief shown in the Creative Direction panel.
   * Text-only on purpose: the product anchor remains the source of truth for
   * visual DNA, so this call never invents product details.
   */
  draftBrief(input: {
    product: ProductAnchor;
    tone: BrandTone;
    aspectRatio: AspectRatio;
    shotCount: number;
    model: string;
  }): Promise<BriefDraftOutput>;
}

export interface ImageGenOutput {
  b64Json?: string;
  publicUrl?: string;
  /** MIME type returned by the provider (for example `image/png`). */
  mediaType?: string;
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
    model: string;
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
    durationSeconds: VideoDurationSeconds;
    model: string;
  }): Promise<VideoJobSubmission>;

  getJobStatus(jobId: string): Promise<VideoJobStatus>;
}

export interface AssetStoragePort {
  /** Persists a base64-encoded image and returns a browser-readable URL. */
  savePublicImageFromBase64(b64Json: string, filename: string): Promise<string>;

  /**
   * Normalizes any supported image reference into the best URL the provider
   * can read. Public HTTPS URLs pass through untouched; local `public/` files
   * and data URIs are persisted first when the adapter has a public store.
   */
  ensurePublicHttpsUrl(source: string, filename: string): Promise<string>;
}
