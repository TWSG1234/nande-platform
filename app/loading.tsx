export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 animate-pulse" aria-busy="true" aria-label="載入中">
      <div className="h-8 w-48 rounded-lg bg-ink-100 dark:bg-white/10" />
      <div className="mt-3 h-4 w-72 rounded bg-ink-100 dark:bg-white/10" />
      <div className="mt-10 grid sm:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl2 bg-ink-100 dark:bg-white/10" />
        ))}
      </div>
      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl2 bg-ink-100 dark:bg-white/10" />
          ))}
        </div>
        <div className="h-80 rounded-xl2 bg-ink-100 dark:bg-white/10" />
      </div>
    </div>
  );
}
