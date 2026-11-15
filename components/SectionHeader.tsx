interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export default function SectionHeader({ eyebrow, title, subtitle, align = "left" }: SectionHeaderProps) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : ""}>
      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-annotation uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-annotation" />
        {eyebrow}
      </span>
      <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">
        {title}
      </h2>
      {subtitle && <p className="mt-2 text-ink-400 text-sm sm:text-base">{subtitle}</p>}
    </div>
  );
}
