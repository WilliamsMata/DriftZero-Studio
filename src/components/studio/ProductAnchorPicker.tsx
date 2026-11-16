"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Check, Loader2, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioStore } from "@/store/use-studio-store";
import { SectionHeading } from "@/components/studio/studio-primitives";
import { isStudioBusy } from "@/lib/studio-utils";

type UploadedAnchorStorage = "data-uri" | "public-url" | "local-path";

interface UploadAnchorResponse {
  imageUrl: string;
  storage: UploadedAnchorStorage;
  bytes: number;
  fileName: string;
}

function isUploadAnchorResponse(value: unknown): value is UploadAnchorResponse {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  const storage = candidate.storage;

  return (
    typeof candidate.imageUrl === "string" &&
    candidate.imageUrl.trim() !== "" &&
    typeof candidate.bytes === "number" &&
    typeof candidate.fileName === "string" &&
    (storage === "data-uri" ||
      storage === "public-url" ||
      storage === "local-path")
  );
}

function readUploadErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const error = (payload as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return null;

  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

export interface ProductAnchorPickerProps {
  variant?: "compact" | "touch";
  showHeading?: boolean;
  className?: string;
}

export function ProductAnchorPicker({
  variant = "compact",
  showHeading = true,
  className,
}: ProductAnchorPickerProps) {
  const mode = useStudioStore((state) => state.mode);
  const product = useStudioStore((state) => state.product);
  const productAnchors = useStudioStore((state) => state.productAnchors);
  const setProduct = useStudioStore((state) => state.setProduct);
  const updateProduct = useStudioStore((state) => state.updateProduct);
  const activeStep = useStudioStore((state) => state.activeStep);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAnchor, setIsUploadingAnchor] = useState(false);

  const busy = isStudioBusy(activeStep);
  const isTouch = variant === "touch";
  const isCustomAnchor =
    !productAnchors.some((anchor) => anchor.imageUrl === product.imageUrl) &&
    (product.imageUrl.startsWith("data:") ||
      product.imageUrl.startsWith("/generated/") ||
      /^https:\/\//i.test(product.imageUrl));

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file type", {
        description: "Upload a PNG, JPEG, or WebP product image.",
        duration: 5000,
      });
      return;
    }

    setIsUploadingAnchor(true);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch(
        `/api/assets/upload?mode=${encodeURIComponent(mode)}`,
        {
          method: "POST",
          body: formData,
          cache: "no-store",
        },
      );

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          readUploadErrorMessage(payload) ?? "The anchor upload failed.",
        );
      }

      if (!isUploadAnchorResponse(payload)) {
        throw new Error("The upload endpoint returned an unexpected response.");
      }

      updateProduct({ imageUrl: payload.imageUrl });

      // A custom anchor is a new product: drop the previous catalog brief so it
      // does not describe the wrong item. Users can draft a fresh one with AI.
      const studio = useStudioStore.getState();
      const briefWasCatalogDefault = studio.productAnchors.some(
        (anchor) => anchor.defaultBrief === studio.userGoal,
      );
      if (briefWasCatalogDefault) studio.setUserGoal("");

      if (payload.storage === "local-path") {
        toast.warning("Anchor saved locally", {
          description:
            "Live video jobs need public HTTPS frames. Set BLOB_READ_WRITE_TOKEN to host uploads on Vercel Blob.",
          duration: 7000,
        });
      }
    } catch (error) {
      toast.error("Anchor upload failed", {
        description:
          error instanceof Error
            ? error.message
            : "The product image could not be uploaded.",
        duration: 7000,
      });
    } finally {
      setIsUploadingAnchor(false);
    }
  }

  function chooseProductAnchor(anchor: (typeof productAnchors)[number]) {
    setProduct({ ...anchor });
  }

  const tileClassName = isTouch ? "size-20" : "size-14";
  const uploadIconClassName = isTouch ? "size-4" : "size-3.5";

  return (
    <section className={cn("space-y-3", className)}>
      {showHeading ? (
        <SectionHeading
          icon={<Package className="size-3.5" />}
          title="Product Anchor"
          hint="The fidelity reference passed into every keyframe."
        />
      ) : null}

      <div
        className={cn(
          isTouch
            ? "flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 contain-paint"
            : "flex flex-wrap items-center gap-2",
        )}
      >
        {productAnchors.map((anchor) => {
          const selected = product.imageUrl === anchor.imageUrl;

          return (
            <button
              key={`${anchor.name}-${anchor.imageUrl}`}
              type="button"
              disabled={busy}
              onClick={() => chooseProductAnchor(anchor)}
              aria-label={`Use ${anchor.name} as the product anchor`}
              aria-pressed={selected}
              title={isTouch ? undefined : anchor.name}
              className={cn(
                "group relative shrink-0 snap-start overflow-hidden rounded-lg border bg-zinc-950 transition-all disabled:cursor-not-allowed disabled:opacity-60",
                tileClassName,
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
              {isTouch ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white/90">
                  {anchor.name}
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          type="button"
          disabled={busy || isUploadingAnchor}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "group relative flex shrink-0 snap-start flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed bg-white/[0.02] text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            tileClassName,
            isCustomAnchor
              ? "border-amber-300/50"
              : "border-white/15 hover:border-amber-300/40 hover:text-amber-200",
          )}
          aria-label="Upload a custom product anchor"
          title={isTouch ? undefined : "Upload a custom product anchor"}
        >
          {isUploadingAnchor ? (
            <>
              <Loader2 className="size-4 animate-spin text-amber-300" />
              <span className="text-[11px] font-medium">Saving</span>
            </>
          ) : isCustomAnchor ? (
            <>
              {/* Uploaded data URI / public blob preview. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt="Uploaded product anchor preview"
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute inset-0 bg-black/45" />
              <Upload className="relative size-4" />
              <span className="relative text-[11px] font-medium">
                Replace
              </span>
            </>
          ) : (
            <>
              <Upload className={uploadIconClassName} />
              <span className="text-[11px] font-medium">Upload</span>
            </>
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload a custom product anchor image"
          className="hidden"
          onChange={(event) => {
            void handleFileChange(event);
          }}
        />
      </div>

      <div className="grid gap-2.5">
        <div className="space-y-1.5">
          <Label
            htmlFor={isTouch ? "mobile-product-name" : "product-name"}
            className="text-[12px] text-muted-foreground"
          >
            Product Name
          </Label>
          <Input
            id={isTouch ? "mobile-product-name" : "product-name"}
            value={product.name}
            disabled={busy}
            maxLength={80}
            placeholder="e.g. Oud Al-Sahara Elixir"
            onChange={(event) => updateProduct({ name: event.target.value })}
            className={cn(
              "bg-white/[0.02] text-base sm:text-xs",
              isTouch ? "h-11" : "h-9",
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={isTouch ? "mobile-product-category" : "product-category"}
            className="text-[12px] text-muted-foreground"
          >
            Category
          </Label>
          <Input
            id={isTouch ? "mobile-product-category" : "product-category"}
            value={product.category}
            disabled={busy}
            maxLength={60}
            placeholder="e.g. Luxury Perfume"
            onChange={(event) =>
              updateProduct({ category: event.target.value })
            }
            className={cn(
              "bg-white/[0.02] text-base sm:text-xs",
              isTouch ? "h-11" : "h-9",
            )}
          />
        </div>
      </div>
    </section>
  );
}
