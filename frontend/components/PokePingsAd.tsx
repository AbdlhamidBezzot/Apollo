"use client";

import Image from "next/image";

export function PokePingsAd({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://whop.com/pokepings/pokepings-premium?a=waxyusheraa"
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`group block w-full overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#1a0a3c] via-[#1e0f4a] to-[#0f0a2e] shadow-[0_0_30px_rgba(120,60,220,0.2)] transition-all duration-300 hover:border-purple-400/60 hover:shadow-[0_0_50px_rgba(120,60,220,0.4)] hover:scale-[1.01] ${className}`}
    >
      <div className="relative flex flex-col sm:flex-row items-center gap-4 p-5 sm:p-6">
        {/* Glow orb */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30 rounded-2xl"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, rgba(140,80,255,0.5), transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(80,40,200,0.3), transparent 60%)",
          }}
        />

        {/* Banner Image */}
        <div className="relative w-full sm:w-40 h-28 sm:h-24 flex-shrink-0 overflow-hidden rounded-xl shadow-md">
          <Image
            src="/pokepings-banner.png"
            alt="PokePings"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 160px"
          />
        </div>

        {/* Content */}
        <div className="flex-1 z-10 text-center sm:text-left">

          <h3 className="text-lg font-extrabold text-white tracking-tight leading-tight">
            PokePings – Free Access
          </h3>

          {/* Stars */}
          <div className="flex items-center justify-center sm:justify-start gap-1 mt-1">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
            <span className="ml-1 text-[11px] font-bold text-yellow-300">4.9</span>
            <span className="text-[11px] text-white/40">(1382)</span>
          </div>

          <p className="mt-1.5 text-xs text-white/60 leading-relaxed max-w-sm">
            Get real-time Pokémon GO alerts, IV filters, and shiny notifications. Join thousands of trainers for free.
          </p>
        </div>

        {/* CTA Button */}
        <div className="z-10 flex-shrink-0">
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#5bc8d4] hover:bg-[#4ab7c3] transition px-6 py-3 text-sm font-extrabold text-gray-900 shadow-lg group-hover:shadow-[0_0_20px_rgba(91,200,212,0.4)]">
            Join for free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

export default PokePingsAd;
