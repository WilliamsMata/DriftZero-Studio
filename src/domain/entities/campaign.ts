import type { ShotRole } from './shot-sequence';

export type ExecutionMode = 'mock' | 'hybrid' | 'live';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type BrandTone = 'luxury-editorial' | 'tiktok-ugc' | 'minimalist-studio';

export interface ProductAnchor {
  name: string;
  category: string;
  imageUrl: string;
}

export interface AdCopy {
  hook: string;
  headline: string;
  cta: string;
}

export interface ShotPlan {
  index: number;
  role: ShotRole;
  title: string;
  /**
   * Scene, camera, lighting, and mood from the creative director. The final
   * image prompt is composed with productDna and fidelity rules at generation
   * time; see `buildKeyframePrompt`.
   */
  imagePrompt: string;
  /** Camera motion only. Identity rules are appended at video submission. */
  videoMotionPrompt: string;
}

export interface ShotResult {
  shotIndex: number;
  keyframeUrl: string;
  fidelityScore: number;
  qaFeedback: string;
  wasRetried: boolean;
  /** Exact prompt sent to the image model, including the identity lock. */
  imagePromptUsed?: string;
  videoJobId?: string;
  videoStatus: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
  videoProgress: number;
  videoPlaybackUrl?: string; // /api/videos/[jobId]/content or /fixtures/...
}

export interface CostEntry {
  step: 'director' | 'image' | 'vision-qa' | 'video';
  model: string;
  costUsd: number;
  note?: string;
}

export interface CostLedger {
  totalUsd: number;
  maxBudgetUsd: number;
  entries: CostEntry[];
}

export interface CampaignState {
  id: string;
  mode: ExecutionMode;
  aspectRatio: AspectRatio;
  tone: BrandTone;
  product: ProductAnchor;
  productDna: string;
  adCopy: AdCopy;
  shots: ShotPlan[];
  results: ShotResult[];
  ledger: CostLedger;
}
