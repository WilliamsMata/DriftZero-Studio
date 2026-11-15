import { z } from 'zod';
import {
  HARD_MAX_CAMPAIGN_BUDGET_USD,
  MAX_VISION_QA_RETRIES,
} from '../services/media-constants';

export const executionModeSchema = z.enum(['mock', 'hybrid', 'live']);

export const aspectRatioSchema = z.enum(['9:16', '16:9', '1:1']);

export const brandToneSchema = z.enum([
  'luxury-editorial',
  'tiktok-ugc',
  'minimalist-studio',
]);

export const shotIndexSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const videoDurationSchema = z.union([z.literal(4), z.literal(5)]);

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

export const campaignStateSchema = z.object({
  id: z.string().min(1),
  mode: executionModeSchema,
  aspectRatio: aspectRatioSchema,
  tone: brandToneSchema,
  product: productAnchorSchema,
  productDna: z.string(),
  adCopy: adCopySchema,
  shots: z.array(shotPlanSchema).length(3),
  results: z.array(shotResultSchema).length(3),
  ledger: costLedgerSchema,
});

export const planCampaignRequestSchema = z.object({
  product: productAnchorSchema,
  tone: brandToneSchema,
  aspectRatio: aspectRatioSchema,
  imageModel: z.string().trim().min(1),
  videoModel: z.string().trim().min(1),
  maxBudgetUsd: z
    .number()
    .positive()
    .max(HARD_MAX_CAMPAIGN_BUDGET_USD)
    .default(1.5),
  userGoal: z.string().trim().max(500).optional(),
  mode: executionModeSchema.optional(),
});

export const generateKeyframesRequestSchema = z.object({
  campaign: campaignStateSchema,
  imageModel: z.string().trim().min(1),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(MAX_VISION_QA_RETRIES)
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
export type GenerateKeyframesRequestDto = z.infer<
  typeof generateKeyframesRequestSchema
>;
export type SubmitVideosRequestDto = z.infer<typeof submitVideosRequestSchema>;
