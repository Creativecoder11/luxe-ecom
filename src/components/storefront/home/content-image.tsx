import Image from "next/image";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils/cn";

/** Neutral backdrops shown until the owner uploads a banner image (no stock photos are invented). */
const TONES = [
  "bg-[radial-gradient(120%_90%_at_75%_25%,#6b5a4c_0%,#3a302a_55%,#211c19_100%)]",
  "bg-[radial-gradient(120%_90%_at_70%_30%,#5c6670_0%,#323a42_55%,#1b2026_100%)]",
  "bg-[radial-gradient(120%_90%_at_70%_30%,#76705f_0%,#45413a_55%,#26241f_100%)]",
  "bg-[radial-gradient(120%_90%_at_70%_30%,#6f5a5d_0%,#3f3134_55%,#221b1c_100%)]",
  "bg-[radial-gradient(120%_90%_at_70%_30%,#5d6b5c_0%,#353f35_55%,#1d231d_100%)]",
] as const;

export function toneFor(index: number): string {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length]!;
}

/**
 * Background image for banners and tiles. Uploaded images cover the box; without one, a
 * decorative tone fills it (aria-hidden, so screen readers only hear the banner text).
 */
export function ContentImage({
  imageKey,
  alt,
  index = 0,
  className,
  priority = false,
  sizes = "(min-width: 768px) 50vw, 100vw",
}: {
  imageKey: string | null | undefined;
  alt?: string;
  index?: number;
  className?: string;
  priority?: boolean;
  /** Rendered width hint so the image CDN serves a right-sized file (see next/image `sizes`). */
  sizes?: string;
}) {
  if (!imageKey) return <div aria-hidden="true" className={cn("absolute inset-0", toneFor(index), className)} />;
  return (
    <Image
      src={mediaUrl(imageKey)}
      alt={alt ?? ""}
      fill
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={cn("object-cover", className)}
    />
  );
}
