"use client";

import { useState } from "react";
import {
  ChevronRight,
  Clapperboard,
  Copy,
  Dna,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/store/use-studio-store";
import type { AdCopy } from "@/domain/entities/campaign";
import { TONE_LABELS, formatCost } from "@/lib/studio-utils";

function AdCopyField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  touch,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  disabled: boolean;
  touch: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "resize-none bg-white/[0.02] text-base sm:text-xs",
          touch ? "min-h-20" : "min-h-9",
        )}
      />
    </div>
  );
}

function copyTextWithFallback(text: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function ProductDnaPanel({
  campaignProductName,
  productDna,
  onOpenFullDna,
  compact,
}: {
  campaignProductName: string | null;
  productDna: string;
  onOpenFullDna?: () => void;
  compact: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/15 bg-gradient-to-r from-amber-300/[0.08] via-amber-300/[0.025] to-transparent p-3">
      <div className="absolute -top-10 -right-8 size-28 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.16em] text-amber-200 uppercase">
            <Dna className="size-3.5" />
            Product DNA
          </span>
          <Badge
            variant="outline"
            className="h-6 border-amber-300/25 bg-amber-300/10 px-2 text-[11px] font-normal text-amber-100/85"
          >
            <ShieldCheck className="size-3" />
            Anchor locked
          </Badge>
          {campaignProductName ? (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {campaignProductName}
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            "mt-1.5 text-[12px] leading-relaxed text-amber-50/90",
            compact && "line-clamp-2",
          )}
        >
          {productDna}
        </p>
        {compact &&
        campaignProductName !== null &&
        productDna.trim() !== "" &&
        onOpenFullDna ? (
          <button
            type="button"
            onClick={onOpenFullDna}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-[11px] font-medium text-amber-200 underline decoration-amber-300/25 underline-offset-4"
          >
            Read full DNA
            <ChevronRight className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface DirectorBriefCardProps {
  variant?: "desktop" | "mobile";
  className?: string;
}

export function DirectorBriefCard({
  variant = "desktop",
  className,
}: DirectorBriefCardProps) {
  const campaign = useStudioStore((state) => state.campaign);
  const tone = useStudioStore((state) => state.tone);
  const updateAdCopy = useStudioStore((state) => state.updateAdCopy);

  const [dnaDrawerOpen, setDnaDrawerOpen] = useState(false);
  const [copyDrawerOpen, setCopyDrawerOpen] = useState(false);

  const isMobile = variant === "mobile";
  const displayTone = campaign?.tone ?? tone;
  const productDna =
    campaign?.productDna ??
    "Run the creative director to extract exact product geometry, label typography, materials, and lighting cues for zero-drift generation.";

  async function copyProductDna(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(productDna);
      toast.success("Product DNA copied");
    } catch {
      if (copyTextWithFallback(productDna)) {
        toast.success("Product DNA copied");
        return;
      }

      toast.error("Could not copy Product DNA");
    }
  }

  function renderAdCopyField(
    field: keyof AdCopy,
    id: string,
    label: string,
    placeholder: string,
    maxLength: number,
    touch: boolean,
  ) {
    return (
      <AdCopyField
        id={id}
        label={label}
        value={campaign?.adCopy[field] ?? ""}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={!campaign}
        touch={touch}
        onChange={(value) => updateAdCopy(field, value)}
      />
    );
  }

  if (isMobile) {
    return (
      <Card
        className={cn(
          "gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm",
          className,
        )}
      >
        <CardHeader className="border-b border-white/5 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex size-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <Clapperboard className="size-3.5" />
                </span>
                Director Brief
              </CardTitle>
              <CardDescription className="mt-1 text-[12px]">
                Product DNA and edit-ready copy for the storyboard.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="h-6 shrink-0 border-amber-300/20 bg-amber-300/[0.06] px-2 text-[11px] text-amber-100/80"
            >
              {TONE_LABELS[displayTone]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 py-3">
          <ProductDnaPanel
            campaignProductName={campaign?.product.name ?? null}
            productDna={productDna}
            onOpenFullDna={() => setDnaDrawerOpen(true)}
            compact
          />

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["hook", "Hook"],
                ["headline", "Headline"],
                ["cta", "CTA"],
              ] as const
            ).map(([field, label]) => (
              <div
                key={field}
                className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2"
              >
                <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {label}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-foreground/85">
                  {campaign?.adCopy[field] ?? "—"}
                </p>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setCopyDrawerOpen(true)}
            disabled={!campaign}
            className="min-h-11 w-full gap-2 border-amber-300/20 bg-amber-300/[0.06] text-[12px] text-amber-100 hover:bg-amber-300/10"
          >
            <PencilLine className="size-3.5" />
            Edit Ad Copy
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Copy syncs live to the safe-zone preview.
            </span>
            {campaign ? (
              <span className="font-mono">
                {formatCost(campaign.ledger.totalUsd)} spend
              </span>
            ) : null}
          </div>
        </CardContent>

        <Drawer
          open={copyDrawerOpen}
          onOpenChange={setCopyDrawerOpen}
          showSwipeHandle
        >
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle>Edit ad copy</DrawerTitle>
              <DrawerDescription>
                Changes sync immediately to the safe-zone preview and the ad
                player. The drawer keeps the storyboard clear while the mobile
                keyboard is open.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 studio-scrollbar">
              {renderAdCopyField(
                "hook",
                "mobile-ad-hook",
                "Hook",
                "Scroll-stopping first line",
                140,
                true,
              )}
              {renderAdCopyField(
                "headline",
                "mobile-ad-headline",
                "Headline",
                "Product promise",
                160,
                true,
              )}
              {renderAdCopyField(
                "cta",
                "mobile-ad-cta",
                "CTA",
                "Shop the drop",
                40,
                true,
              )}
            </div>
            <DrawerFooter className="border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                onClick={() => setCopyDrawerOpen(false)}
                className="min-h-11 bg-amber-300 text-zinc-950 hover:bg-amber-200"
              >
                Done
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer
          open={dnaDrawerOpen}
          onOpenChange={setDnaDrawerOpen}
          showSwipeHandle
        >
          <DrawerContent className="max-h-[88dvh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center justify-center gap-2 md:justify-start">
                <Dna className="size-4 text-amber-200" />
                Product DNA
              </DrawerTitle>
              <DrawerDescription>
                The locked visual identity string sent to every keyframe and
                Vision QA check.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 studio-scrollbar">
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="h-6 border-amber-300/25 bg-amber-300/10 px-2 text-[11px] font-normal text-amber-100/85"
                  >
                    <ShieldCheck className="size-3" />
                    Anchor locked
                  </Badge>
                  {campaign ? (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {campaign.product.name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-amber-50/90">
                  {productDna}
                </p>
              </div>
            </div>
            <DrawerFooter className="border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyProductDna()}
                className="min-h-11 gap-2 border-amber-300/20 bg-amber-300/[0.06] text-amber-100 hover:bg-amber-300/10"
              >
                <Copy className="size-3.5" />
                Copy DNA
              </Button>
              <Button
                type="button"
                onClick={() => setDnaDrawerOpen(false)}
                className="min-h-11 bg-amber-300 text-zinc-950 hover:bg-amber-200"
              >
                Done
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-white/5 bg-card/70 py-0 ring-1 ring-white/10 backdrop-blur-sm",
        className,
      )}
    >
      <CardHeader className="border-b border-white/5 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="flex size-6 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                <Clapperboard className="size-3.5" />
              </span>
              Creative Director Brief
            </CardTitle>
            <CardDescription className="mt-1 text-[12px]">
              Product DNA, edit-ready ad copy, and the storyboard plan. Every
              frame is scored against the anchor.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="h-6 border-amber-300/20 bg-amber-300/[0.06] px-2 text-[11px] text-amber-100/80"
            >
              {TONE_LABELS[displayTone]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <ProductDnaPanel
          campaignProductName={campaign?.product.name ?? null}
          productDna={productDna}
          compact={false}
        />

        <div className="grid gap-2.5 sm:grid-cols-3">
          {renderAdCopyField(
            "hook",
            "ad-hook",
            "Hook",
            "Scroll-stopping first line",
            140,
            false,
          )}
          {renderAdCopyField(
            "headline",
            "ad-headline",
            "Headline",
            "Product promise",
            160,
            false,
          )}
          {renderAdCopyField(
            "cta",
            "ad-cta",
            "CTA",
            "Shop the drop",
            40,
            false,
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Ad copy syncs live to the safe-zone preview.
          </span>
          {campaign ? (
            <span className="font-mono">
              {formatCost(campaign.ledger.totalUsd)} campaign spend
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
