import { z } from 'zod';
import type { VideoDurationSeconds } from '@/domain/entities/model-capabilities';
import {
  DEFAULT_SHOT_COUNT,
  MAX_SHOT_COUNT,
  MIN_SHOT_COUNT,
} from '@/domain/entities/shot-sequence';
import {
  HARD_MAX_CAMPAIGN_BUDGET_USD,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VISION_QA_RETRIES,
  MIN_VIDEO_DURATION_SECONDS,
} from '../services/media-constants';

export const executionModeSchema = z.enum(['mock', 'hybrid', 'live']);

export const aspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);

export const brandToneSchema = z.enum([
  'luxury-editorial',
  'tiktok-ugc',
  'minimalist-studio',
]);

export const shotIndexSchema = z
  .number()
  .int()
  .min(MIN_SHOT_COUNT)
  .max(MAX_SHOT_COUNT);

export const videoDurationSchema = z.custom<VideoDurationSeconds>(
  (value) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_VIDEO_DURATION_SECONDS &&
    value <= MAX_VIDEO_DURATION_SECONDS,
);

export const productAnchorSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1),
});

export const adCopySchema = z.object({
  hook: z.string(),
  headline: z.string(),
  cta: z.string(),
});

export const shotPlanSchema = z.object({
  index: shotIndexSchema,
  role: z.enum(['hero-packshot', 'lifestyle-context', 'macro-finale']),
  title: z.string().min(1),
  imagePrompt: z.string().min(1),
  videoMotionPrompt: z.string().min(1),
});

export const shotResultSchema = z.object({
  shotIndex: shotIndexSchema,
  keyframeUrl: z.string(),
  fidelityScore: z.number().min(0).max(10),
  qaFeedback: z.string(),
  wasRetried: z.boolean(),
  imagePromptUsed: z.string().optional(),
  videoJobId: z.string().optional(),
  videoStatus: z.enum([
    'idle',
    'queued',
    'processing',
    'completed',
    'failed',
  ]),
  videoProgress: z.number().min(0).max(100),
  videoPlaybackUrl: z.string().optional(),
});

export const costEntrySchema = z.object({
  step: z.enum(['director', 'image', 'vision-qa', 'video']),
  model: z.string().min(1),
  costUsd: z.number().nonnegative(),
  note: z.string().optional(),
});

export const costLedgerSchema = z.object({
  totalUsd: z.number().nonnegative(),
  maxBudgetUsd: z
    .number()
    .positive()
    .max(HARD_MAX_CAMPAIGN_BUDGET_USD),
  entries: z.array(costEntrySchema),
});

export const campaignStateSchema = z
  .object({
    id: z.string().min(1),
    mode: executionModeSchema,
    aspectRatio: aspectRatioSchema,
    tone: brandToneSchema,
    product: productAnchorSchema,
    productDna: z.string(),
    adCopy: adCopySchema,
    shots: z
      .array(shotPlanSchema)
      .min(MIN_SHOT_COUNT)
      .max(MAX_SHOT_COUNT),
    results: z
      .array(shotResultSchema)
      .min(MIN_SHOT_COUNT)
      .max(MAX_SHOT_COUNT),
    ledger: costLedgerSchema,
  })
  .superRefine((campaign, context) => {
    if (campaign.shots.length !== campaign.results.length) {
      context.addIssue({
        code: 'custom',
        path: ['results'],
        message:
          'Campaign results must contain exactly one entry per planned shot.',
      });
    }

    campaign.shots.forEach((shot, position) => {
      if (shot.index !== position + 1) {
        context.addIssue({
          code: 'custom',
          path: ['shots', position, 'index'],
          message: `Shot indexes must be sequential starting at ${MIN_SHOT_COUNT}.`,
        });
      }
    });

    campaign.results.forEach((result, position) => {
      if (result.shotIndex !== position + 1) {
        context.addIssue({
          code: 'custom',
          path: ['results', position, 'shotIndex'],
          message: `Result shot indexes must be sequential starting at ${MIN_SHOT_COUNT}.`,
        });
      }
    });
  });

export const planCampaignRequestSchema = z.object({
  product: productAnchorSchema,
  tone: brandToneSchema,
  aspectRatio: aspectRatioSchema,
  textModel: z.string().trim().min(1).optional(),
  imageModel: z.string().trim().min(1),
  videoModel: z.string().trim().min(1),
  durationSeconds: videoDurationSchema.optional(),
  shotCount: z
    .number()
    .int()
    .min(MIN_SHOT_COUNT)
    .max(MAX_SHOT_COUNT)
    .default(DEFAULT_SHOT_COUNT),
  maxBudgetUsd: z
    .number()
    .positive()
    .max(HARD_MAX_CAMPAIGN_BUDGET_USD)
    .default(1.5),
  userGoal: z.string().trim().max(500).optional(),
  mode: executionModeSchema.optional(),
});

export const draftCreativeBriefRequestSchema = z.object({
  product: productAnchorSchema,
  tone: brandToneSchema,
  aspectRatio: aspectRatioSchema,
  shotCount: z
    .number()
    .int()
    .min(MIN_SHOT_COUNT)
    .max(MAX_SHOT_COUNT)
    .default(DEFAULT_SHOT_COUNT),
  maxBudgetUsd: z
    .number()
    .positive()
    .max(HARD_MAX_CAMPAIGN_BUDGET_USD)
    .default(1.5),
  mode: executionModeSchema.optional(),
});

export const generateKeyframesRequestSchema = z.object({
  campaign: campaignStateSchema,
  imageModel: z.string().trim().min(1),
  visionModel: z.string().trim().min(1).optional(),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(MAX_VISION_QA_RETRIES)
    .optional(),
  /**
   * Optional subset of shots to generate in this request. The studio sends one
   * request per shot so each serverless invocation stays well below the
   * platform's maximum function duration. Omit to generate every shot.
   */
  shotIndexes: z
    .array(shotIndexSchema)
    .min(1)
    .max(MAX_SHOT_COUNT)
    .refine((indexes) => new Set(indexes).size === indexes.length, {
      message: 'Shot indexes must be unique within a keyframe request.',
    })
    .optional(),
});

export const submitVideosRequestSchema = z.object({
  campaign: campaignStateSchema,
  videoModel: z.string().trim().min(1),
  durationSeconds: videoDurationSchema.optional(),
});

export const videoStatusQuerySchema = z.object({
  mode: executionModeSchema.optional(),
});

export type PlanCampaignRequestDto = z.infer<typeof planCampaignRequestSchema>;
export type DraftCreativeBriefRequestDto = z.infer<
  typeof draftCreativeBriefRequestSchema
>;
export type GenerateKeyframesRequestDto = z.infer<
  typeof generateKeyframesRequestSchema
>;
export type SubmitVideosRequestDto = z.infer<typeof submitVideosRequestSchema>;
