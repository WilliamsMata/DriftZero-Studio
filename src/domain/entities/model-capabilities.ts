import type { AspectRatio } from './campaign';

export type VideoDurationSeconds =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

/** Cost-safe output tiers that OpenRouter video models expose. */
export type VideoResolution =
  | '360p'
  | '480p'
  | '720p'
  | '768p'
  | '1080p'
  | '1K'
  | '2K'
  | '4K';

export type VideoFrameImageType = 'first_frame' | 'last_frame';

/**
 * Audio behavior advertised by OpenRouter:
 * - `always`: the model always renders an audio track and `generate_audio`
 *   cannot be disabled (for example HeyGen Video 1).
 * - `optional`: `generate_audio` is supported and can be toggled.
 * - `none`: the model never renders audio.
 * - `unknown`: the provider does not advertise its audio behavior.
 */
export type VideoAudioMode = 'always' | 'optional' | 'none' | 'unknown';

/**
 * OpenRouter reasoning-effort hint. Low is the Studio default for existing
 * models; Muse Ember is configured as `high` because it degrades badly at low.
 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export interface ChatModelCapability {
  id: string;
  label: string;
  provider: string;
  /** USD per one million input tokens. */
  inputCostPerMillionUsd: number;
  /** USD per one million output tokens. */
  outputCostPerMillionUsd: number;
  supportsVision: boolean;
  /** Optional per-model reasoning effort; omitted models fall back to `low`. */
  reasoningEffort?: ReasoningEffort;
}

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
  supportedResolutions: VideoResolution[];
  supportedFrameImages: VideoFrameImageType[];
  supportsLastFrame: boolean;
  /** Audio behavior; `optional` means the request flag is supported. */
  audioMode: VideoAudioMode;
  /** Estimated USD per second including the audio track when supported. */
  estimatedCostPerSecondUsd: number;
}
