"use client";

export function MobileHeroSkeleton() {
  return (
    <div className="relative h-[55vh] min-h-[360px] max-h-[500px] w-full animate-pulse bg-[#121215] flex flex-col justify-end p-4 space-y-3">
      <div className="h-4 w-24 rounded-full bg-white/10" />
      <div className="h-7 w-3/4 rounded-lg bg-white/15" />
      <div className="h-10 w-full rounded-full bg-white/20" />
    </div>
  );
}

export function MobileDetailSkeleton() {
  return (
    <div className="relative min-h-screen w-full bg-[#09090B] p-4 space-y-4 animate-pulse pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="h-[45vh] w-full rounded-3xl bg-white/10" />
      <div className="h-8 w-2/3 rounded-lg bg-white/15" />
      <div className="h-4 w-1/2 rounded bg-white/10" />
      <div className="h-12 w-full rounded-full bg-white/20" />
      <div className="h-24 w-full rounded-2xl bg-white/10" />
    </div>
  );
}

export function MobileCarouselSkeleton({ title }: { title?: string }) {
  return (
    <div className="space-y-2 py-2">
      {title && (
        <div className="flex items-center gap-2 px-4">
          <span className="h-3.5 w-1 rounded-full bg-white/20" />
          <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
        </div>
      )}
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col w-[124px] shrink-0 space-y-2">
            <div className="aspect-[2/3] w-full rounded-2xl bg-white/10 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col space-y-2">
          <div className="aspect-[2/3] w-full rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-3 w-full rounded bg-white/10 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
