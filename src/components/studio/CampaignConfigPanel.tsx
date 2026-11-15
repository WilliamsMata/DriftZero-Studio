"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Clapperboard,
  ClipboardList,
  Coins,
  Film,
  Gauge,
  ImageIcon,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
  WandSparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/store/use-studio-store";
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_SHOT_DURATION_SECONDS,
  MAX_BUDGET_USD,
  MIN_BUDGET_USD,
  MODE_LABELS,
  STEP_META,
  TONE_LABELS,
  TONE_OPTIONS,
  estimateMediaCostUsd,
  formatCost,
  formatUsd,
  isBrandTone,
  isStudioBusy,
} from "@/lib/studio-utils";

const CAPABILITY_BADGE_CLASS =
  "h-auto min-h-5 gap-1 rounded-md border-white/[0.08] bg-white/[0.03] px-1.5 py-1 text-[11px] font-normal text-muted-foreground";

const MODE_BADGE_CLASS = {
  mock: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  hybrid: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  live: "border-rose-400/25 bg-rose-400/10 text-rose-200",
} as const;

function SectionHeading({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-foreground/90 uppercase">
          {title}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CapabilityNotice({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "rose";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-[12px] leading-relaxed",
        tone === "rose"
          ? "border-rose-400/25 bg-rose-500/10 text-rose-100/85"
          : "border-amber-400/20 bg-amber-400/[0.07] text-amber-100/80",
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function CampaignConfigPanel() {
  const mode = useStudioStore((state) => state.mode);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const setAspectRatio = useStudioStore((state) => state.setAspectRatio);
  const tone = useStudioStore((state) => state.tone);
  const setTone = useStudioStore((state) => state.setTone);
  const product = useStudioStore((state) => state.product);
  const setProduct = useStudioStore((state) => state.setProduct);
  const updateProduct = useStudioStore((state) => state.updateProduct);
  const userGoal = useStudioStore((state) => state.userGoal);
  const setUserGoal = useStudioStore((state) => state.setUserGoal);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const selectedVideoModel = useStudioStore(
    (state) => state.selectedVideoModel,
  );
  const setSelectedImageModel = useStudioStore(
    (state) => state.setSelectedImageModel,
  );
  const setSelectedVideoModel = useStudioStore(
    (state) => state.setSelectedVideoModel,
  );
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const setMaxBudgetUsd = useStudioStore((state) => state.setMaxBudgetUsd);
  const imageModels = useStudioStore((state) => state.imageModels);
  const videoModels = useStudioStore((state) => state.videoModels);
  const productAnchors = useStudioStore((state) => state.productAnchors);
  const catalogStatus = useStudioStore((state) => state.catalogStatus);
  const catalogError = useStudioStore((state) => state.catalogError);
  const loadInitialCatalog = useStudioStore(
    (state) => state.loadInitialCatalog,
  );
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const imageModel = imageModels.find(
    (model) => model.id === selectedImageModel,
  );
  const videoModel = videoModels.find(
    (model) => model.id === selectedVideoModel,
  );

  const imageModelItems = useMemo(
    () =>
      Object.fromEntries(
        imageModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [imageModels],
  );

  const videoModelItems = useMemo(
    () =>
      Object.fromEntries(
        videoModels.map((model) => [model.id, model.label]),
      ) as Record<string, string>,
    [videoModels],
  );

  const toneHint =
    TONE_OPTIONS.find((option) => option.value === tone)?.hint ?? "";

  const busy = isStudioBusy(activeStep);

  const imageAspectSupported =
    !imageModel || imageModel.supportedAspectRatios.includes(aspectRatio);
  const videoAspectSupported =
    !videoModel || videoModel.supportedAspectRatios.includes(aspectRatio);
  const aspectSupported = imageAspectSupported && videoAspectSupported;
  const unsupportedRatios = ASPECT_RATIO_OPTIONS.filter(
    (option) =>
      (imageModel &&
        !imageModel.supportedAspectRatios.includes(option.value)) ||
      (videoModel && !videoModel.supportedAspectRatios.includes(option.value)),
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    updateProduct({ imageUrl: previewUrl });

    if (mode === "mock") {
      toast.info("Local anchor preview ready", {
        description: `${file.name} will be used as the product anchor for the next mock run.`,
        duration: 4000,
      });
    } else {
      toast.warning("Local anchor is preview-only", {
        description:
          "Live OpenRouter video jobs require a public HTTPS product anchor. Use a preset anchor for live runs or replace this preview before generating.",
        duration: 7000,
      });
    }

    event.target.value = "";
  }

  function chooseProductAnchor(anchor: (typeof productAnchors)[number]) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setProduct({ ...anchor });
  }

  return (
    <Card className="gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm">
      <CardHeader className="border-b border-white/5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <SlidersIcon />
              Campaign Config
            </CardTitle>
            <CardDescription className="mt-1 text-[12px]">
              Anchor, direction, models, guardrails.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-4 py-4">
        <section className="space-y-3">
          <SectionHeading
            icon={<Package className="size-3.5" />}
            title="Product Anchor"
            hint="The fidelity reference passed into every keyframe."
          />

          <div className="flex flex-wrap items-center gap-2">
            {productAnchors.map((anchor) => {
              const selected = product.imageUrl === anchor.imageUrl;

              return (
                <button
                  key={`${anchor.name}-${anchor.imageUrl}`}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseProductAnchor(anchor)}
                  title={`Use ${anchor.name} as the product anchor`}
                  aria-label={`Use ${anchor.name} as the product anchor`}
                  aria-pressed={selected}
                  className={cn(
                    "group relative size-14 overflow-hidden rounded-lg border bg-zinc-950 transition-all disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-amber-300/70 ring-2 ring-amber-300/25"
                      : "border-white/10 hover:border-white/30",
                  )}
                >
                  {/* Dynamic fixture previews intentionally use native img. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={anchor.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {selected ? (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-amber-300 text-zinc-950">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}

            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group relative flex size-14 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed bg-white/[0.02] text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                product.imageUrl.startsWith("blob:")
                  ? "border-amber-300/50"
                  : "border-white/15 hover:border-amber-300/40 hover:text-amber-200",
              )}
              title="Upload a custom product anchor"
            >
              {product.imageUrl.startsWith("blob:") ? (
                <>
                  {/* Local object URL preview. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.imageUrl}
                    alt="Uploaded product anchor preview"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <span className="absolute inset-0 bg-black/45" />
                  <Upload className="relative size-3.5" />
                  <span className="relative text-[11px] font-medium">
                    Replace
                  </span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span className="text-[11px] font-medium">Upload</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload a custom product anchor image"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid gap-2.5">
            <div className="space-y-1.5">
              <Label
                htmlFor="product-name"
                className="text-[12px] text-muted-foreground"
              >
                Product Name
              </Label>
              <Input
                id="product-name"
                value={product.name}
                disabled={busy}
                maxLength={80}
                placeholder="e.g. Oud Al-Sahara Elixir"
                onChange={(event) =>
                  updateProduct({ name: event.target.value })
                }
                className="h-9 bg-white/[0.02] text-base sm:text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="product-category"
                className="text-[12px] text-muted-foreground"
              >
                Category
              </Label>
              <Input
                id="product-category"
                value={product.category}
                disabled={busy}
                maxLength={60}
                placeholder="e.g. Luxury Perfume"
                onChange={(event) =>
                  updateProduct({ category: event.target.value })
                }
                className="h-9 bg-white/[0.02] text-base sm:text-xs"
              />
            </div>
          </div>
        </section>

        <Separator className="bg-white/5" />

        <section className="space-y-3">
          <SectionHeading
            icon={<Sparkles className="size-3.5" />}
            title="Creative Direction"
            hint="Shapes the director brief and the social ad framing."
          />

          <div className="space-y-1.5">
            <Label
              htmlFor="brand-tone"
              className="text-[12px] text-muted-foreground"
            >
              Brand Tone
            </Label>
            <Select
              value={tone}
              items={TONE_LABELS}
              disabled={busy}
              onValueChange={(value) => {
                if (typeof value === "string" && isBrandTone(value)) {
                  setTone(value);
                }
              }}
            >
              <SelectTrigger
                id="brand-tone"
                className="h-9 w-full bg-white/[0.02] text-base sm:text-xs"
              >
                <SelectValue placeholder="Select brand tone" />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {toneHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              id="aspect-ratio-label"
              className="text-[12px] text-muted-foreground"
            >
              Aspect Ratio
            </Label>
            <div
              role="group"
              aria-labelledby="aspect-ratio-label"
              className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-zinc-950/50 p-1"
            >
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const supported =
                  (!imageModel ||
                    imageModel.supportedAspectRatios.includes(
                      option.value,
                    )) &&
                  (!videoModel ||
                    videoModel.supportedAspectRatios.includes(option.value));
                const selected = aspectRatio === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={busy || !supported}
                    aria-pressed={selected}
                    aria-label={`${option.label} ${option.orientation}${
                      supported
                        ? ""
                        : " — not supported by the selected image or video model"
                    }`}
                    title={
                      supported
                        ? option.orientation
                        : "Not supported by the selected image or video model."
                    }
                    onClick={() => setAspectRatio(option.value)}
                    className={cn(
                      "flex h-10 flex-col items-center justify-center rounded-md border text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                      selected
                        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                        : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <span className="font-mono">{option.label}</span>
                    <span className="text-[11px] font-normal opacity-80">
                      {option.orientation}
                    </span>
                  </button>
                );
              })}
            </div>
            {unsupportedRatios.length > 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Unavailable with the selected models:{" "}
                {unsupportedRatios.map((option) => option.label).join(", ")}.
              </p>
            ) : null}
            {!aspectSupported ? (
              <CapabilityNotice tone="rose">
                The selected models do not both support {aspectRatio}. Pick a
                compatible ratio or switch a model before running.
              </CapabilityNotice>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="creative-brief"
                className="text-[12px] text-muted-foreground"
              >
                Creative Brief{" "}
                <span className="font-normal opacity-60">(optional)</span>
              </Label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {userGoal.length}/500
              </span>
            </div>
            <Textarea
              id="creative-brief"
              value={userGoal}
              disabled={busy}
              maxLength={500}
              rows={3}
              placeholder="Launch window, must-hit product beats, offer, audience..."
              onChange={(event) => setUserGoal(event.target.value)}
              className="min-h-16 resize-none bg-white/[0.02] text-base sm:text-xs"
            />
          </div>
        </section>

        <Separator className="bg-white/5" />

        <section className="space-y-3">
          <SectionHeading
            icon={<Layers className="size-3.5" />}
            title="Capability-Aware Models"
            hint="Live capability badges come from the server catalog."
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="image-model"
                className="text-[12px] text-muted-foreground"
              >
                Image Model
              </Label>
              {imageModel ? (
                <span className="text-[11px] text-muted-foreground">
                  {imageModel.provider}
                </span>
              ) : null}
            </div>
            <Select
              value={selectedImageModel}
              items={imageModelItems}
              disabled={busy || imageModels.length === 0}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setSelectedImageModel(value);
                }
              }}
            >
              <SelectTrigger
                id="image-model"
                className="h-9 w-full bg-white/[0.02] text-base sm:text-xs"
              >
                <SelectValue placeholder="Load the model catalog" />
              </SelectTrigger>
              <SelectContent>
                {imageModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {imageModel ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
                  <ImageIcon className="size-2.5" />
                  Ref Images:{" "}
                  {imageModel.supportsInputReferences
                    ? `Max ${imageModel.maxInputReferences}`
                    : "Unsupported"}
                </Badge>
                <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
                  <Layers className="size-2.5" />
                  {imageModel.supportedAspectRatios.join(" · ")}
                </Badge>
                <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
                  <Coins className="size-2.5" />
                  {formatCost(imageModel.estimatedCostPerImageUsd)} / frame
                </Badge>
              </div>
            ) : null}
            {imageModel &&
            (!imageModel.supportsInputReferences ||
              imageModel.maxInputReferences < 1) ? (
              <CapabilityNotice>
                {imageModel.label} does not accept product reference images. The
                zero-drift anchor check cannot run with this model.
              </CapabilityNotice>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="video-model"
                className="text-[12px] text-muted-foreground"
              >
                Video Model
              </Label>
              {videoModel ? (
                <span className="text-[11px] text-muted-foreground">
                  {videoModel.provider}
                </span>
              ) : null}
            </div>
            <Select
              value={selectedVideoModel}
              items={videoModelItems}
              disabled={busy || videoModels.length === 0}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setSelectedVideoModel(value);
                }
              }}
            >
              <SelectTrigger
                id="video-model"
                className="h-9 w-full bg-white/[0.02] text-base sm:text-xs"
              >
                <SelectValue placeholder="Load the model catalog" />
              </SelectTrigger>
              <SelectContent>
                {videoModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {videoModel ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    CAPABILITY_BADGE_CLASS,
                    videoModel.supportsLastFrame
                      ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80"
                      : "border-amber-400/20 bg-amber-400/[0.06] text-amber-200/80",
                  )}
                >
                  <Clapperboard className="size-2.5" />
                  {videoModel.supportsLastFrame
                    ? "Last-Frame Transitions: Supported"
                    : "Single-Frame Only"}
                </Badge>
                <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
                  <Film className="size-2.5" />
                  Ref Images:{" "}
                  {videoModel.supportsInputReferences
                    ? `Max ${videoModel.maxInputReferences}`
                    : "None"}
                </Badge>
                <Badge variant="outline" className={CAPABILITY_BADGE_CLASS}>
                  <Coins className="size-2.5" />
                  {formatCost(
                    videoModel.estimatedCostPerSecondUsd * 4,
                  )}{" "}
                  / 4s shot
                </Badge>
              </div>
            ) : null}
          </div>

          {catalogStatus === "loading" ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-amber-300" />
              Syncing the capability catalog…
            </div>
          ) : null}

          {catalogStatus === "error" ? (
            <div className="space-y-2 rounded-lg border border-rose-400/25 bg-rose-500/10 p-2.5 text-[12px] text-rose-100/85">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <p>{catalogError ?? "The capability catalog is unavailable."}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void loadInitialCatalog()}
                className="border-rose-300/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
              >
                <RefreshCw className="size-3" />
                Retry catalog
              </Button>
            </div>
          ) : null}
        </section>

        <Separator className="bg-white/5" />

        <section className="space-y-3">
          <SectionHeading
            icon={<Gauge className="size-3.5" />}
            title="Budget Guardrail"
            hint="Every media call is pre-reserved against this cap."
          />

          <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">
                Campaign cap
              </span>
              <span className="font-mono text-xs font-medium text-amber-200">
                {formatUsd(maxBudgetUsd, 2)}
              </span>
            </div>
            <Slider
              aria-label="Maximum campaign budget in US dollars"
              min={MIN_BUDGET_USD}
              max={MAX_BUDGET_USD}
              step={0.25}
              value={[maxBudgetUsd]}
              disabled={busy}
              onValueChange={(value) => {
                const next =
                  typeof value === "number" ? value : value[0];
                if (typeof next === "number") {
                  setMaxBudgetUsd(next);
                }
              }}
              className="mt-3"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatUsd(MIN_BUDGET_USD, 2)}</span>
              <span>Hard stop per campaign</span>
              <span>{formatUsd(MAX_BUDGET_USD, 2)}</span>
            </div>
          </div>

          {campaign &&
          campaign.ledger.maxBudgetUsd !== maxBudgetUsd ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The active campaign stays locked at{" "}
              <span className="font-mono text-foreground/80">
                {formatUsd(campaign.ledger.maxBudgetUsd, 2)}
              </span>
              . The new cap applies to the next plan.
            </p>
          ) : null}
        </section>

      </CardContent>
    </Card>
  );
}

function SlidersIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
      <ClipboardList className="size-3.5" />
    </span>
  );
}

type RunAction = "full" | "plan" | "keyframes" | "videos";

export function ExecutionPanel() {
  const mode = useStudioStore((state) => state.mode);
  const aspectRatio = useStudioStore((state) => state.aspectRatio);
  const product = useStudioStore((state) => state.product);
  const selectedImageModel = useStudioStore(
    (state) => state.selectedImageModel,
  );
  const selectedVideoModel = useStudioStore(
    (state) => state.selectedVideoModel,
  );
  const imageModels = useStudioStore((state) => state.imageModels);
  const videoModels = useStudioStore((state) => state.videoModels);
  const maxBudgetUsd = useStudioStore((state) => state.maxBudgetUsd);
  const campaign = useStudioStore((state) => state.campaign);
  const activeStep = useStudioStore((state) => state.activeStep);
  const errorMessage = useStudioStore((state) => state.errorMessage);
  const runPlan = useStudioStore((state) => state.runPlan);
  const runKeyframes = useStudioStore((state) => state.runKeyframes);
  const runVideos = useStudioStore((state) => state.runVideos);
  const runFullPipeline = useStudioStore((state) => state.runFullPipeline);
  const resetCampaign = useStudioStore((state) => state.resetCampaign);

  const [pendingRun, setPendingRun] = useState<RunAction | null>(null);

  const busy = isStudioBusy(activeStep);
  const stepMeta = STEP_META[activeStep];

  const imageModel = imageModels.find(
    (model) => model.id === selectedImageModel,
  );
  const videoModel = videoModels.find(
    (model) => model.id === selectedVideoModel,
  );

  const aspectSupported =
    (!imageModel || imageModel.supportedAspectRatios.includes(aspectRatio)) &&
    (!videoModel || videoModel.supportedAspectRatios.includes(aspectRatio));

  const productReady =
    product.name.trim() !== "" &&
    product.category.trim() !== "" &&
    product.imageUrl.trim() !== "";

  const modelsReady = imageModel !== undefined && videoModel !== undefined;
  const canPlan = productReady && modelsReady && aspectSupported && !busy;

  const keyframesReady =
    campaign !== null &&
    campaign.results.length === 3 &&
    campaign.results.every((result) => result.keyframeUrl.trim() !== "");

  const canKeyframes = campaign !== null && !busy;
  const canVideos = keyframesReady && !busy;

  const mediaEstimateUsd = estimateMediaCostUsd(
    imageModel?.estimatedCostPerImageUsd ?? 0,
    videoModel?.estimatedCostPerSecondUsd ?? 0,
    DEFAULT_SHOT_DURATION_SECONDS,
  );
  const estimatedMediaUsd = mode === "mock" ? 0 : mediaEstimateUsd;
  const dialogEstimateUsd =
    (pendingRun === "full" ? mode : (campaign?.mode ?? mode)) === "mock"
      ? 0
      : mediaEstimateUsd;

  const campaignCapUsd = campaign?.ledger.maxBudgetUsd ?? maxBudgetUsd;
  const campaignSpendUsd = campaign?.ledger.totalUsd ?? 0;

  const ctaLabel = (() => {
    switch (activeStep) {
      case "planning":
        return "Directing campaign…";
      case "keyframes":
        return "Generating keyframes…";
      case "submitting-videos":
        return "Submitting video jobs…";
      case "polling-videos":
        return "Rendering videos…";
      default:
        return campaign ? "Re-run pipeline" : "Run full pipeline";
    }
  })();

  function executeRun(action: RunAction) {
    switch (action) {
      case "plan":
        void runPlan();
        return;
      case "keyframes":
        void runKeyframes();
        return;
      case "videos":
        void runVideos();
        return;
      default:
        void runFullPipeline();
    }
  }

  function requestRun(action: RunAction) {
    const effectiveMode =
      action === "full" ? mode : (campaign?.mode ?? mode);

    if (effectiveMode === "live") {
      setPendingRun(action);
      return;
    }

    executeRun(action);
  }

  function confirmLiveRun() {
    const action = pendingRun;
    setPendingRun(null);
    if (action) executeRun(action);
  }

  const liveRunLabel =
    pendingRun === "plan"
      ? "Plan the campaign live"
      : pendingRun === "keyframes"
        ? "Generate keyframes live"
        : pendingRun === "videos"
          ? "Render videos live"
          : "Run the full pipeline live";

  return (
    <Card className="shrink-0 gap-0 overflow-hidden border-white/5 bg-card/85 py-0 ring-1 ring-white/10 backdrop-blur-sm">
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-foreground/90 uppercase">
            <Zap className="size-3.5 text-amber-300" />
            Execution
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={resetCampaign}
              disabled={!campaign && !busy && errorMessage === null}
              aria-label="Reset campaign"
              title="Reset the active campaign; configuration is preserved."
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
            </Button>
            <Badge
              variant="outline"
              className={cn(
                "h-6 shrink-0 px-2 text-[11px] font-medium",
                MODE_BADGE_CLASS[mode],
              )}
            >
              Next run · {MODE_LABELS[mode]}
            </Badge>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
            activeStep === "error"
              ? "border-rose-400/20 bg-rose-500/[0.07]"
              : busy
                ? "border-amber-400/20 bg-amber-400/[0.06]"
                : "border-white/[0.07] bg-white/[0.02]",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-300" />
          ) : activeStep === "error" ? (
            <TriangleAlert className="size-3.5 shrink-0 text-rose-300" />
          ) : (
            <Sparkles className="size-3.5 shrink-0 text-amber-300" />
          )}
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
            {stepMeta.label}
          </span>
          <span
            className="shrink-0 font-mono text-[11px] text-muted-foreground"
            title="Estimated media cost for 3 keyframes and 3 × 4s renders. Director and Vision QA are charged separately; QA may retry once per shot."
          >
            {mode === "mock" ? "Mock" : "Est."} {formatUsd(estimatedMediaUsd)}{" "}
            / {formatUsd(campaignCapUsd)}
          </span>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => requestRun("full")}
          disabled={!canPlan}
          title={
            canPlan
              ? "Plan, generate keyframes, run Vision QA, submit videos, and poll to completion"
              : "Add product details and a compatible model pair before running"
          }
          className="h-10 w-full gap-2 bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 text-[12px] font-semibold text-zinc-950 shadow-[0_12px_32px_-12px_rgba(251,191,36,0.65)] hover:from-amber-100 hover:via-amber-200 hover:to-orange-200"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <WandSparkles className="size-4" />
          )}
          {ctaLabel}
        </Button>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPlan}
            onClick={() => requestRun("plan")}
            title="Plan the three-shot campaign blueprint"
            className="h-9 gap-1 px-1.5 text-[11px]"
          >
            {activeStep === "planning" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ClipboardList className="size-3" />
            )}
            1. Plan
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canKeyframes}
            onClick={() => requestRun("keyframes")}
            title="Generate keyframes and run Vision QA"
            className="h-9 gap-1 px-1.5 text-[11px]"
          >
            {activeStep === "keyframes" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ImageIcon className="size-3" />
            )}
            2. Keyframes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canVideos}
            onClick={() => requestRun("videos")}
            title="Submit image-to-video jobs and poll until complete"
            className="h-9 gap-1 px-1.5 text-[11px]"
          >
            {activeStep === "submitting-videos" ||
            activeStep === "polling-videos" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Film className="size-3" />
            )}
            3. Videos
          </Button>
        </div>

        {campaign && campaign.mode !== mode ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Steps reuse the loaded {MODE_LABELS[campaign.mode]} campaign.
            Re-run starts a new campaign in {MODE_LABELS[mode]} mode.
          </p>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-2.5 text-[12px] leading-relaxed text-rose-100">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <p className="font-medium text-rose-100">Last run stopped</p>
                <p className="mt-1 text-rose-100/80">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>

      <Dialog
        open={pendingRun !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRun(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{liveRunLabel}?</DialogTitle>
            <DialogDescription>
              Live mode sends real OpenRouter requests. Nothing is charged
              before the budget guardrail approves each step.
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-[12px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Execution mode</dt>
              <dd className="font-medium text-rose-200">Live OpenRouter</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Estimated media</dt>
              <dd className="font-mono text-foreground">
                {formatUsd(dialogEstimateUsd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Campaign cap</dt>
              <dd className="font-mono text-foreground">
                {formatUsd(campaignCapUsd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Spent so far</dt>
              <dd className="font-mono text-foreground">
                {formatCost(campaignSpendUsd)}
              </dd>
            </div>
          </dl>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRun(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmLiveRun}
              className="bg-rose-500 text-white hover:bg-rose-400"
            >
              {liveRunLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
