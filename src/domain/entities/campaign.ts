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
  index: 1 | 2 | 3;
  role: 'hero-packshot' | 'lifestyle-context' | 'macro-finale';
  title: string;
  imagePrompt: string;
  videoMotionPrompt: string;
}

export interface ShotResult {
  shotIndex: 1 | 2 | 3;
  keyframeUrl: string;
  fidelityScore: number;
  qaFeedback: string;
  wasRetried: boolean;
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
