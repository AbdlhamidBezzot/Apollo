export function SkeletonRow() {
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="skeleton mb-3 h-6 w-48 rounded" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[2/3] w-32 shrink-0 rounded-lg sm:w-40" />
        ))}
      </div>
    </section>
  );
}

export function SkeletonHero() {
  return (
    <div className="skeleton mb-8 h-[420px] w-full" />
  );
}
