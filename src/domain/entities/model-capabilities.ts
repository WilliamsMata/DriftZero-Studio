import type { AspectRatio } from './campaign';

export type VideoDurationSeconds = 4 | 5;

export interface ImageModelCapability {
  id: string;
  label: string;
  provider: string;
  supportedAspectRatios: AspectRatio[];
  supportsInputReferences: boolean;
  maxInputReferences: number;
  estimatedCostPerImageUsd: number;
}

export interface VideoModelCapability {
  id: string;
  label: string;
  provider: string;
  supportedAspectRatios: AspectRatio[];
  supportsInputReferences: boolean;
  maxInputReferences: number;
  supportedDurations: VideoDurationSeconds[];
  supportsLastFrame: boolean;
  estimatedCostPerSecondUsd: number;
}
