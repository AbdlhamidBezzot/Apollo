"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Ad300x250 } from "@/components/Ad300x250";
import { DetailTabs } from "@/components/DetailTabs";
import { MovieNightButton } from "@/components/MovieNightButton";



import { TitleActions } from "@/components/TitleActions";
import { backdropUrl, posterUrl, releaseYear, titleName } from "@/lib/api";
import { getEditorialTake } from "@/lib/editorial-generator";
import type { Title, TitleDetail } from "@/lib/types";

export function DetailViewClient({
  item,
  similar,
  mediaType,
}: {
  item: TitleDetail;
  similar: Title[];
  mediaType: "movie" | "tv";
}) {
  const [playing, setPlaying] = useState(false);

  const year = releaseYear(item);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const genres = (item.genres || []).map((g) => g.name).join(" • ");
  const runtime = item.runtime ? `${item.runtime} min` : "";
  const trailer = item.videos?.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");
  const cast = (item.credits?.cast || []).slice(0, 12);

  return (
    <div className="min-h-screen bg-[#09090B] pb-16">
      {/* CinemaOS Hero Backdrop Header */}
      <section className="relative h-[560px] w-full overflow-hidden bg-[#09090B]">
        <Image
          src={backdropUrl(item.backdrop_path)}
          alt={titleName(item)}
          fill
          priority
          className="object-cover object-top brightness-90"
          sizes="100vw"
        />
        {/* Cinemaos dark vignette gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/50 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/60 to-transparent" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 30% 90%, rgba(250,204,21,0.15), transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#09090B] to-transparent" />
      </section>

      {/* Main Title Metadata Content */}
      <div className="relative mx-auto -mt-64 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-8 md:flex-row">
          {/* High-res Poster Card */}
          <div className="relative hidden w-64 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#09090B]/80 shadow-brand-glow-lg md:block">
            <Image
              src={posterUrl(item.poster_path)}
              alt={titleName(item)}
              width={256}
              height={384}
              priority
              className="aspect-[2/3] w-full object-cover"
            />
            {rating && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-3 py-1 font-mono text-xs font-bold text-[var(--brand-accent)] backdrop-blur-md shadow-lg">
                <span className="text-[var(--brand-accent)]">★</span> {rating}
              </div>
            )}
          </div>

          {/* Title Info Header */}
          <div className="flex-1 pt-6 md:pt-10">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/15 px-3.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
                {mediaType === "tv" ? "TV Series" : "Movie"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono text-xs font-bold text-white/90 backdrop-blur-md">
                4K ULTRA HD
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono text-xs font-bold text-white/80 backdrop-blur-md">
                HDR10+
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono text-xs font-bold text-white/80 backdrop-blur-md">
                DOLBY ATMOS
              </span>
            </div>

            <h1 className="text-3xl font-black leading-none tracking-tight text-[#FAFAFA] drop-shadow-md sm:text-5xl lg:text-6xl">
              {titleName(item)}
              {year ? <span className="ml-3 text-2xl font-normal text-[#A1A1AA] sm:text-4xl">({year})</span> : null}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#A1A1AA]">
              {rating ? (
                <span className="flex items-center gap-1 font-bold text-[var(--brand-accent)]">
                  <svg className="h-3.5 w-3.5 fill-[var(--brand-accent)] text-[var(--brand-accent)]" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> {rating} <span className="text-xs font-normal text-[#A1A1AA]">/ 10</span>
                </span>
              ) : null}
              {runtime ? (
                <span className="flex items-center gap-1 font-mono text-xs text-white/80">
                  <svg className="h-3.5 w-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {runtime}
                </span>
              ) : null}
              {mediaType === "tv" && item.number_of_seasons ? (
                <span className="flex items-center gap-1 font-mono text-xs text-white/80">
                  <svg className="h-3.5 w-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  {item.number_of_seasons} season{item.number_of_seasons > 1 ? "s" : ""}
                </span>
              ) : null}
              {item.status ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[11px] uppercase text-white/70">
                  {item.status}
                </span>
              ) : null}
            </div>

            {genres && <p className="mt-3 text-sm font-semibold tracking-wide text-[var(--brand-accent)]">{genres}</p>}

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#FAFAFA]/90 drop-shadow-sm sm:text-base">
              {item.overview || "No synopsis available for this title."}
            </p>

            {item.tagline ? (
              <p className="mt-3 border-l-2 border-[var(--brand-accent)]/60 pl-3 text-sm italic text-[#A1A1AA]">
                &ldquo;{item.tagline}&rdquo;
              </p>
            ) : null}

            {/* Apollo Editorial Take */}
            {(() => {
              const take = getEditorialTake(item);
              return (
                <div className="mt-6 rounded-3xl border border-white/10 bg-[#09090B]/60 p-5 sm:p-6 shadow-glass backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent)]/20 text-xs font-bold text-[var(--brand-accent)]">
                      A
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
                      Apollo Film Analysis & Editorial Take
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#FAFAFA]/90">
                    {take.text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#A1A1AA]">
                      Target Audience: <strong className="text-white font-semibold">{take.audience}</strong>
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#A1A1AA]">
                      Pacing & Tone: <strong className="text-[var(--brand-accent)] font-semibold">{take.pacing}</strong>
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[#A1A1AA]">
                      Apollo Context: <strong className="text-white font-semibold">{take.tone}</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href={`/watch/${mediaType}/${item.id}`}
                onClick={() => setPlaying(true)}
                className="cinema-btn-accent min-h-[48px] gap-2.5 px-8 text-base font-bold shadow-brand-glow"
              >
                {playing ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B0B0C] border-t-transparent" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                    <path d="M7 5l12 7-12 7V5z" />
                  </svg>
                )}
                Play Now
              </Link>

              <TitleActions tmdbId={item.id} mediaType={mediaType} hidePlay />
              <MovieNightButton />
            </div>
          </div>
        </div>

        <Ad300x250 />

        {/* Detail Tabs Section */}
        <DetailTabs
          mediaType={mediaType}
          tmdbId={item.id}
          number_of_seasons={item.number_of_seasons}
          trailerKey={trailer?.key || null}
          cast={cast}
          similar={similar}
        />

      </div>
    </div>
  );

}
