import { cn } from "@/lib/utils/cn";

/** Section heading: a plain lead line followed by a warm red-to-olive gradient accent. */
export function GradientHeading({
  lead,
  accent,
  as: Tag = "h2",
  className,
  breakLine = false,
}: {
  lead: string;
  accent?: string;
  as?: "h1" | "h2";
  className?: string;
  breakLine?: boolean;
}) {
  return (
    <Tag className={cn("font-display text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-[#111] sm:text-5xl lg:text-[3.5rem]", className)}>
      {lead}
      {accent ? (
        <>
          {breakLine ? <br /> : " "}
          <span className="bg-gradient-to-r from-[#b5121b] via-[#9b4f45] to-[#5f9b3c] bg-clip-text text-transparent">{accent}</span>
        </>
      ) : null}
    </Tag>
  );
}
