"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type {
  AdCopy,
  AspectRatio,
  BrandTone,
  CampaignState,
  ExecutionMode,
  ProductAnchor,
  ShotResult,
} from "@/domain/entities/campaign";
import type {
  ImageModelCapability,
  VideoDurationSeconds,
  VideoModelCapability,
} from "@/domain/entities/model-capabilities";
import type { VideoJobStatus } from "@/domain/ports/media-ports";
import {
  DEFAULT_MAX_BUDGET_USD,
  TONE_LABELS,
  clampBudget,
  formatCost,
  formatUsd,
  isStudioBusy,
  type StudioStep,
} from "@/lib/studio-utils";

export interface ShowcasePreset {
  id: string;
  name: string;
  description: string;
  imageModel: string;
  videoModel: string;
  durationSeconds: VideoDurationSeconds;
  campaign: CampaignState;
}

interface ModelDefaults {
  imageModel: string;
  videoModel: string;
  aspectRatio: AspectRatio;
  durationSeconds: VideoDurationSeconds;
  maxBudgetUsd: number;
}

interface ModelsResponse {
  imageModels: ImageModelCapability[];
  videoModels: VideoModelCapability[];
  defaults: ModelDefaults;
}

interface PresetsResponse {
  presets: ShowcasePreset[];
  productAnchors: ProductAnchor[];
}

interface CampaignResponse {
  campaign: CampaignState;
}

interface VideoStatusResponse {
  status: VideoJobStatus;
}

type VideoTerminalAssessment =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

interface VideoStatusUpdate {
  shotIndex: ShotResult["shotIndex"];
  status: VideoJobStatus;
}

type CatalogStatus = "idle" | "loading" | "ready" | "error";

interface StudioState {
  mode: ExecutionMode;
  aspectRatio: AspectRatio;
  tone: BrandTone;
  product: ProductAnchor;
  userGoal: string;
  selectedImageModel: string;
  selectedVideoModel: string;
  maxBudgetUsd: number;
  imageModels: ImageModelCapability[];
  videoModels: VideoModelCapability[];
  presets: ShowcasePreset[];
  productAnchors: ProductAnchor[];
  catalogStatus: CatalogStatus;
  catalogError: string | null;
  campaign: CampaignState | null;
  activeStep: StudioStep;
  errorMessage: string | null;
  showAdOverlay: boolean;
  activePlayerShot: 1 | 2 | 3;

  loadInitialCatalog: () => Promise<void>;
  loadPreset: (presetId: string) => void;
  runPlan: () => Promise<void>;
  runKeyframes: () => Promise<void>;
  runVideos: () => Promise<void>;
  runFullPipeline: () => Promise<void>;
  resetCampaign: () => void;
  stopVideoPolling: () => void;

  setMode: (mode: ExecutionMode) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  setTone: (tone: BrandTone) => void;
  setProduct: (product: ProductAnchor) => void;
  updateProduct: (patch: Partial<ProductAnchor>) => void;
  setUserGoal: (userGoal: string) => void;
  setSelectedImageModel: (modelId: string) => void;
  setSelectedVideoModel: (modelId: string) => void;
  setMaxBudgetUsd: (value: number) => void;
  setShowAdOverlay: (value: boolean) => void;
  setActivePlayerShot: (shot: 1 | 2 | 3) => void;
  updateAdCopy: (field: keyof AdCopy, value: string) => void;
}

const DEFAULT_PRODUCT: ProductAnchor = {
  name: "Oud Al-Sahara Elixir",
  category: "Luxury Perfume",
  imageUrl: "/fixtures/perfume-anchor.jpeg",
};

const DEFAULT_IMAGE_MODEL_ID = "google/gemini-2.5-flash-image";
const DEFAULT_VIDEO_MODEL_ID = "bytedance/seedance-2.0-fast";

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollWake: (() => void) | null = null;
let workflowEpoch = 0;

class WorkflowCancelledError extends Error {
  constructor() {
    super("The workflow was cancelled.");
    this.name = "WorkflowCancelledError";
  }
}

class StudioApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown>,
  ) {
    super(message);
    this.name = "StudioApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function clearPollTimer(): void {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  const wake = pollWake;
  pollWake = null;
  if (wake) wake();
}

function cancelWorkflow(): void {
  workflowEpoch += 1;
  clearPollTimer();
}

function startWorkflow(): number {
  clearPollTimer();
  workflowEpoch += 1;
  return workflowEpoch;
}

function assertActive(epoch: number): void {
  if (epoch !== workflowEpoch) {
    throw new WorkflowCancelledError();
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    pollWake = resolve;
    pollTimer = setTimeout(() => {
      pollTimer = null;
      pollWake = null;
      resolve();
    }, ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseErrorPayload(payload: unknown): {
  code: string;
  message: string;
  details: Record<string, unknown>;
} {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return {
      code: "HTTP_ERROR",
      message: "The studio API returned an unexpected response.",
      details: {},
    };
  }

  const rawError = payload.error;
  return {
    code: readString(rawError, "code") ?? "HTTP_ERROR",
    message:
      readString(rawError, "message") ??
      "The studio API returned an unexpected response.",
    details: isRecord(rawError.details) ? rawError.details : {},
  };
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsed = parseErrorPayload(payload);
    throw new StudioApiError(
      response.status,
      parsed.code,
      parsed.message,
      parsed.details,
    );
  }

  if (payload === null) {
    throw new StudioApiError(
      response.status,
      "EMPTY_RESPONSE",
      "The studio API returned an empty response.",
      {},
    );
  }

  return payload as T;
}

function describeBudgetError(error: StudioApiError): string {
  const projectedUsd = readNumber(error.details, "projectedUsd");
  const maxBudgetUsd = readNumber(error.details, "maxBudgetUsd");

  if (projectedUsd !== undefined && maxBudgetUsd !== undefined) {
    return `${error.message} Projected spend ${formatCost(
      projectedUsd,
    )} against a ${formatUsd(maxBudgetUsd)} cap.`;
  }

  return error.message;
}

function presetState(preset: ShowcasePreset): Partial<StudioState> {
  return {
    mode: preset.campaign.mode,
    aspectRatio: preset.campaign.aspectRatio,
    tone: preset.campaign.tone,
    product: { ...preset.campaign.product },
    selectedImageModel: preset.imageModel,
    selectedVideoModel: preset.videoModel,
    maxBudgetUsd: preset.campaign.ledger.maxBudgetUsd,
    userGoal: preset.description,
    campaign: preset.campaign,
    activeStep: "completed",
    errorMessage: null,
    showAdOverlay: true,
    activePlayerShot: 1,
  };
}

function isPendingVideo(
  result: ShotResult,
): result is ShotResult & { videoJobId: string } {
  return (
    result.videoJobId !== undefined &&
    (result.videoStatus === "queued" || result.videoStatus === "processing")
  );
}

export const useStudioStore = create<StudioState>()((set, get) => {
  function fail(error: unknown, fallbackTitle: string): void {
    if (error instanceof WorkflowCancelledError) return;

    const message =
      error instanceof Error && error.message.trim() !== ""
        ? error.message
        : fallbackTitle;

    set({ activeStep: "error", errorMessage: message });

    if (error instanceof StudioApiError) {
      if (error.status === 402) {
        toast.error("Budget guardrail reached", {
          description: describeBudgetError(error),
          duration: 7000,
        });
        return;
      }

      if (
        error.status === 400 &&
        error.code === "PROVIDER_CAPABILITY_UNSUPPORTED"
      ) {
        toast.error("Model capability mismatch", {
          description: message,
          duration: 7000,
        });
        return;
      }

      if (error.status === 409) {
        toast.error("Workflow state mismatch", {
          description: message,
          duration: 6000,
        });
        return;
      }
    }

    toast.error(fallbackTitle, {
      description: message,
      duration: 6000,
    });
  }

  async function planCampaignStep(epoch: number): Promise<CampaignState> {
    const state = get();

    if (
      state.product.name.trim() === "" ||
      state.product.category.trim() === "" ||
      state.product.imageUrl.trim() === ""
    ) {
      throw new Error(
        "Add a product name, category, and anchor image before planning.",
      );
    }

    set({
      campaign: null,
      activeStep: "planning",
      errorMessage: null,
      activePlayerShot: 1,
    });

    const payload = await requestJson<CampaignResponse>(
      "/api/campaigns/plan",
      {
        method: "POST",
        body: JSON.stringify({
          product: state.product,
          tone: state.tone,
          aspectRatio: state.aspectRatio,
          imageModel: state.selectedImageModel,
          videoModel: state.selectedVideoModel,
          maxBudgetUsd: state.maxBudgetUsd,
          userGoal:
            state.userGoal.trim() === "" ? undefined : state.userGoal.trim(),
          mode: state.mode,
        }),
      },
    );

    assertActive(epoch);
    set({ campaign: payload.campaign, activeStep: "idle" });
    return payload.campaign;
  }

  async function generateKeyframesStep(
    epoch: number,
  ): Promise<CampaignState> {
    const campaign = get().campaign;

    if (!campaign) {
      throw new Error(
        "Plan the campaign before generating keyframes. Run step 1 first.",
      );
    }

    set({ activeStep: "keyframes", errorMessage: null });

    const payload = await requestJson<CampaignResponse>(
      "/api/campaigns/keyframes",
      {
        method: "POST",
        body: JSON.stringify({
          campaign,
          imageModel: get().selectedImageModel,
          // Hard product rule: Vision QA may retry at most once per shot.
          maxRetries: 1,
        }),
      },
    );

    assertActive(epoch);
    set({ campaign: payload.campaign, activeStep: "idle" });
    return payload.campaign;
  }

  async function submitVideosStep(epoch: number): Promise<CampaignState> {
    const campaign = get().campaign;

    if (!campaign) {
      throw new Error(
        "Plan the campaign before rendering video. Run step 1 first.",
      );
    }

    if (
      campaign.results.length !== 3 ||
      campaign.results.some((result) => result.keyframeUrl.trim() === "")
    ) {
      throw new Error(
        "Generate all three keyframes before rendering video. Run step 2 first.",
      );
    }

    set({ activeStep: "submitting-videos", errorMessage: null });

    const payload = await requestJson<CampaignResponse>(
      "/api/campaigns/videos",
      {
        method: "POST",
        body: JSON.stringify({
          campaign,
          videoModel: get().selectedVideoModel,
        }),
      },
    );

    assertActive(epoch);
    set({
      campaign: payload.campaign,
      activeStep: "polling-videos",
      activePlayerShot: 1,
    });
    return payload.campaign;
  }

  function assessVideoTerminal(): VideoTerminalAssessment {
    const campaign = get().campaign;

    if (!campaign || campaign.results.length !== 3) {
      return "cancelled";
    }

    const allTerminal = campaign.results.every(
      (result) =>
        result.videoStatus === "completed" ||
        result.videoStatus === "failed",
    );

    if (!allTerminal) return "pending";

    const failedShots = campaign.results.filter(
      (result) => result.videoStatus === "failed",
    );

    if (failedShots.length > 0) {
      const message = `Shot ${failedShots
        .map((result) => result.shotIndex)
        .join(", ")} failed to render. Review the shot cards, then retry the video step.`;

      set({ activeStep: "error", errorMessage: message });
      toast.error("Video render finished with errors", {
        description: message,
        duration: 7000,
      });
      return "failed";
    }

    set({
      activeStep: "completed",
      errorMessage: null,
      activePlayerShot: 1,
    });
    toast.success("Campaign complete", {
      description: `All three shots are ready. ${formatCost(
        campaign.ledger.totalUsd,
      )} of ${formatUsd(campaign.ledger.maxBudgetUsd)} used.`,
      duration: 6000,
    });
    return "completed";
  }

  async function waitForRenderedVideos(
    epoch: number,
  ): Promise<VideoTerminalAssessment> {
    let pollFailures = 0;

    for (;;) {
      assertActive(epoch);

      const initialAssessment = assessVideoTerminal();
      if (initialAssessment !== "pending") return initialAssessment;

      const currentMode = get().campaign?.mode;
      if (!currentMode) return "cancelled";

      const intervalMs = currentMode === "live" ? 8000 : 1500;
      await pause(intervalMs);
      assertActive(epoch);

      const campaign = get().campaign;
      if (!campaign) return "cancelled";

      const pending = campaign.results.filter(isPendingVideo);

      if (pending.length === 0) {
        const assessment = assessVideoTerminal();
        if (assessment !== "pending") return assessment;

        throw new Error(
          "No active video jobs are available to poll. Resubmit the video step.",
        );
      }

      try {
        const updates = await Promise.all(
          pending.map(async (result): Promise<VideoStatusUpdate> => {
            const payload = await requestJson<VideoStatusResponse>(
              `/api/videos/${encodeURIComponent(
                result.videoJobId,
              )}/status?mode=${encodeURIComponent(currentMode)}`,
            );

            return {
              shotIndex: result.shotIndex,
              status: payload.status,
            };
          }),
        );

        assertActive(epoch);

        set((state) => {
          if (!state.campaign) return {};

          const updatesByShot = new Map(
            updates.map((update) => [update.shotIndex, update.status]),
          );

          const results = state.campaign.results.map((result) => {
            const status = updatesByShot.get(result.shotIndex);
            if (!status) return result;

            return {
              ...result,
              videoStatus: status.status,
              videoProgress: Math.min(
                Math.max(status.progress, 0),
                100,
              ),
              videoPlaybackUrl:
                status.playbackUrl ?? result.videoPlaybackUrl,
            };
          });

          return {
            campaign: {
              ...state.campaign,
              results,
            },
          };
        });

        pollFailures = 0;
      } catch (error) {
        if (error instanceof WorkflowCancelledError) return "cancelled";
        if (epoch !== workflowEpoch) return "cancelled";

        pollFailures += 1;

        if (pollFailures >= 3) {
          fail(error, "Video status polling failed");
          return "failed";
        }
      }
    }
  }

  return {
    mode: "mock",
    aspectRatio: "9:16",
    tone: "luxury-editorial",
    product: DEFAULT_PRODUCT,
    userGoal: "",
    selectedImageModel: DEFAULT_IMAGE_MODEL_ID,
    selectedVideoModel: DEFAULT_VIDEO_MODEL_ID,
    maxBudgetUsd: DEFAULT_MAX_BUDGET_USD,
    imageModels: [],
    videoModels: [],
    presets: [],
    productAnchors: [],
    catalogStatus: "idle",
    catalogError: null,
    campaign: null,
    activeStep: "idle",
    errorMessage: null,
    showAdOverlay: true,
    activePlayerShot: 1,

    loadInitialCatalog: async () => {
      const currentStatus = get().catalogStatus;
      if (currentStatus === "loading" || currentStatus === "ready") return;

      set({ catalogStatus: "loading", catalogError: null });

      try {
        const [models, presetPayload] = await Promise.all([
          requestJson<ModelsResponse>("/api/models"),
          requestJson<PresetsResponse>("/api/presets"),
        ]);

        const imageModelId = models.imageModels.some(
          (model) => model.id === models.defaults.imageModel,
        )
          ? models.defaults.imageModel
          : (models.imageModels[0]?.id ?? DEFAULT_IMAGE_MODEL_ID);

        const videoModelId = models.videoModels.some(
          (model) => model.id === models.defaults.videoModel,
        )
          ? models.defaults.videoModel
          : (models.videoModels[0]?.id ?? DEFAULT_VIDEO_MODEL_ID);

        const catalogPatch: Partial<StudioState> = {
          catalogStatus: "ready",
          catalogError: null,
          imageModels: models.imageModels,
          videoModels: models.videoModels,
          presets: presetPayload.presets,
          productAnchors: presetPayload.productAnchors,
          selectedImageModel: imageModelId,
          selectedVideoModel: videoModelId,
          aspectRatio: models.defaults.aspectRatio,
          maxBudgetUsd: clampBudget(models.defaults.maxBudgetUsd),
        };

        const defaultPreset = presetPayload.presets[0];

        if (defaultPreset) {
          // Zero-wait demo: the first showcase preset is pre-baked and loads
          // as a fully completed campaign as soon as the catalog is ready.
          set({ ...catalogPatch, ...presetState(defaultPreset) });
        } else {
          const defaultAnchor = presetPayload.productAnchors[0];
          set({
            ...catalogPatch,
            ...(defaultAnchor ? { product: defaultAnchor } : {}),
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The studio catalog could not be loaded.";

        set({ catalogStatus: "error", catalogError: message });
        toast.error("Catalog unavailable", {
          description: message,
          duration: 7000,
        });
      }
    },

    loadPreset: (presetId) => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Wait for the active stage to finish or reset the campaign before loading a preset.",
        });
        return;
      }

      const preset = get().presets.find((item) => item.id === presetId);

      if (!preset) {
        toast.error("Showcase preset unavailable", {
          description:
            "Refresh the studio catalog and try loading the preset again.",
        });
        return;
      }

      cancelWorkflow();
      set(presetState(preset));

      toast.success("Showcase preset loaded", {
        description: `${preset.name} is ready to preview with three completed clips.`,
        duration: 4000,
      });
    },

    runPlan: async () => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Wait for the active stage to finish or reset the campaign.",
        });
        return;
      }

      const epoch = startWorkflow();

      try {
        const campaign = await planCampaignStep(epoch);
        assertActive(epoch);
        toast.success("Campaign blueprint ready", {
          description: `${campaign.shots.length} shots planned · ${
            TONE_LABELS[campaign.tone]
          }.`,
          duration: 4000,
        });
      } catch (error) {
        if (epoch !== workflowEpoch) return;
        fail(error, "Campaign planning failed");
      }
    },

    runKeyframes: async () => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Wait for the active stage to finish or reset the campaign.",
        });
        return;
      }

      if (!get().campaign) {
        toast.info("Plan the campaign first", {
          description:
            "Run step 1 so the creative director can define the three shots.",
        });
        return;
      }

      const epoch = startWorkflow();

      try {
        const campaign = await generateKeyframesStep(epoch);
        assertActive(epoch);

        const healed = campaign.results.filter(
          (result) => result.wasRetried,
        ).length;

        toast.success("Keyframes ready", {
          description:
            healed > 0
              ? `3/3 frames cleared Vision QA · ${healed} self-healed on the first retry.`
              : "3/3 frames cleared Vision QA with no product drift detected.",
          duration: 5000,
        });
      } catch (error) {
        if (epoch !== workflowEpoch) return;
        fail(error, "Keyframe generation failed");
      }
    },

    runVideos: async () => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Wait for the active stage to finish or reset the campaign.",
        });
        return;
      }

      const campaign = get().campaign;

      if (!campaign) {
        toast.info("Plan the campaign first", {
          description:
            "Run steps 1 and 2 before submitting video render jobs.",
        });
        return;
      }

      if (
        campaign.results.length !== 3 ||
        campaign.results.some((result) => result.keyframeUrl === "")
      ) {
        toast.info("Keyframes are missing", {
          description:
            "Run step 2 and clear all three Vision QA checks before rendering video.",
        });
        return;
      }

      const epoch = startWorkflow();

      try {
        await submitVideosStep(epoch);
        assertActive(epoch);
        await waitForRenderedVideos(epoch);
      } catch (error) {
        if (epoch !== workflowEpoch) return;
        fail(error, "Video render failed");
      }
    },

    runFullPipeline: async () => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Wait for the active stage to finish or reset the campaign.",
        });
        return;
      }

      const epoch = startWorkflow();

      toast.info("Full pipeline started", {
        description:
          "Plan → keyframes → Vision QA → video submission → render polling.",
        duration: 3000,
      });

      try {
        await planCampaignStep(epoch);
        assertActive(epoch);
        await generateKeyframesStep(epoch);
        assertActive(epoch);
        await submitVideosStep(epoch);
        assertActive(epoch);
        await waitForRenderedVideos(epoch);
      } catch (error) {
        if (epoch !== workflowEpoch) return;
        fail(error, "Full pipeline failed");
      }
    },

    resetCampaign: () => {
      cancelWorkflow();
      set({
        campaign: null,
        activeStep: "idle",
        errorMessage: null,
        activePlayerShot: 1,
      });
      toast.success("Campaign reset", {
        description:
          "The active campaign was cleared. Configuration is preserved for the next run.",
        duration: 3500,
      });
    },

    stopVideoPolling: () => {
      cancelWorkflow();
    },

    setMode: (mode) => {
      if (isStudioBusy(get().activeStep)) {
        toast.info("Pipeline in progress", {
          description:
            "Execution mode is locked while a campaign is running.",
        });
        return;
      }

      if (mode === get().mode) return;

      // Mode is run provenance, not a label for the loaded campaign. The
      // toggle configures the next run; an existing campaign keeps the mode it
      // was actually produced in.
      set({ mode });

      if (mode === "live") {
        toast.warning("Live OpenRouter mode enabled for the next run", {
          description:
            "Real generations can spend credits. The campaign budget guardrail still applies before every media call.",
          duration: 7000,
        });
      }
    },

    setAspectRatio: (aspectRatio) => {
      set({ aspectRatio });
    },

    setTone: (tone) => {
      set({ tone });
    },

    setProduct: (product) => {
      set({ product });
    },

    updateProduct: (patch) => {
      set((state) => ({ product: { ...state.product, ...patch } }));
    },

    setUserGoal: (userGoal) => {
      set({ userGoal: userGoal.slice(0, 500) });
    },

    setSelectedImageModel: (modelId) => {
      const state = get();
      const model = state.imageModels.find((item) => item.id === modelId);

      if (!model) {
        set({ selectedImageModel: modelId });
        return;
      }

      if (model.supportedAspectRatios.includes(state.aspectRatio)) {
        set({ selectedImageModel: modelId });
        return;
      }

      const videoModel = state.videoModels.find(
        (item) => item.id === state.selectedVideoModel,
      );
      const commonRatio = model.supportedAspectRatios.find(
        (ratio) =>
          !videoModel || videoModel.supportedAspectRatios.includes(ratio),
      );

      if (commonRatio) {
        set({
          selectedImageModel: modelId,
          aspectRatio: commonRatio,
        });
        toast.info("Aspect ratio adjusted", {
          description: `${model.label} does not support ${state.aspectRatio}. Switched to ${commonRatio}.`,
          duration: 4000,
        });
        return;
      }

      set({ selectedImageModel: modelId });
    },

    setSelectedVideoModel: (modelId) => {
      const state = get();
      const model = state.videoModels.find((item) => item.id === modelId);

      if (!model) {
        set({ selectedVideoModel: modelId });
        return;
      }

      if (model.supportedAspectRatios.includes(state.aspectRatio)) {
        set({ selectedVideoModel: modelId });
        return;
      }

      const imageModel = state.imageModels.find(
        (item) => item.id === state.selectedImageModel,
      );
      const commonRatio = model.supportedAspectRatios.find(
        (ratio) =>
          !imageModel || imageModel.supportedAspectRatios.includes(ratio),
      );

      if (commonRatio) {
        set({
          selectedVideoModel: modelId,
          aspectRatio: commonRatio,
        });
        toast.info("Aspect ratio adjusted", {
          description: `${model.label} does not support ${state.aspectRatio}. Switched to ${commonRatio}.`,
          duration: 4000,
        });
        return;
      }

      set({ selectedVideoModel: modelId });
    },

    setMaxBudgetUsd: (value) => {
      set({ maxBudgetUsd: clampBudget(value) });
    },

    setShowAdOverlay: (value) => {
      set({ showAdOverlay: value });
    },

    setActivePlayerShot: (shot) => {
      set({ activePlayerShot: shot });
    },

    updateAdCopy: (field, value) => {
      set((state) => {
        if (!state.campaign) return {};

        return {
          campaign: {
            ...state.campaign,
            adCopy: {
              ...state.campaign.adCopy,
              [field]: value,
            },
          },
        };
      });
    },
  };
});
