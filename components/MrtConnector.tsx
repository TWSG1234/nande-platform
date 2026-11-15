import clsx from "clsx";

interface MrtConnectorProps {
  stops: string[];
  activeIndex?: number;
  className?: string;
}

/**
 * A horizontal "transit line" made of dots and connecting rail, echoing the
 * Taipei MRT map — this is the platform's signature motif, used to show
 * progress or category-hopping across a section (e.g. life-guide categories,
 * the four Chinese-learning tracks).
 */
export default function MrtConnector({ stops, activeIndex = 0, className }: MrtConnectorProps) {
  return (
    <div className={clsx("flex items-center w-full overflow-x-auto pb-2", className)} role="list">
      {stops.map((stop, i) => (
        <div key={stop} className="flex items-center shrink-0" role="listitem">
          <div className="flex flex-col items-center gap-2 min-w-[92px]">
            <span
              className={clsx(
                "h-3.5 w-3.5 rounded-full border-2 transition-colors",
                i <= activeIndex
                  ? "bg-lantern-500 border-lantern-500"
                  : "bg-canvas-light dark:bg-canvas-dark border-ink-400/40"
              )}
            />
            <span
              className={clsx(
                "text-xs font-medium text-center",
                i === activeIndex ? "text-lantern-600 dark:text-lantern-300" : "text-ink-400"
              )}
            >
              {stop}
            </span>
          </div>
          {i < stops.length - 1 && (
            <div
              className={clsx(
                "h-[2px] w-10 -mt-5",
                i < activeIndex ? "bg-lantern-500" : "bg-ink-400/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
