"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useAuth } from "@/components/AuthContext";
import { posterUrl, releaseYear, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

/* ---------- Icons ---------- */
const ICONS: Record<string, ReactElement> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  movies: (
    <>
      <path d="M3 6h18v13H3V6Zm0 4h18M7 13v3M11 13v3" />
    </>
  ),
  series: (
    <>
      <rect x="3" y="6" width="13" height="13" rx="1" />
      <path d="M8 6V3h8v3M16 6h3v13h-3" />
    </>
  ),
  anime: (
    <>
      <path d="M4 5h16M4 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5M4 10h16" />
    </>
  ),
  browse: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  watchlist: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="1" />
      <path d="M9 4V2h6v2M9 11l2 2 4-4" />
    </>
  ),
  cinebot: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h6M9 14h4M12 4V2" />
    </>
  ),
  party: (
    <>
      <path d="M4 17h16M4 17l-1 4M20 17l1 4M8 17v-3a4 4 0 0 1 8 0v3" />
    </>
  ),
  searchIcon: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3.2 3.2 0 0 1 0 6.2M17 14.5a5 5 0 0 1 3.5 5.5" />
    </>
  ),
  editorial: (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18M3 12h18" />
    </>
  ),
  addons: (
    <>
      <path d="M12 2v4M12 18v4M4 12H2M22 12h-2M19.07 4.93l-2.83 2.83M7.76 16.24l-2.83 2.83M19.07 19.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------- Dock data ---------- */
const DOCK_TOP = [
  { href: "/", label: "Home", icon: "home", base: "/", media: null as string | null },
  { href: "/sports", label: "Live Sports", icon: "sports", base: "/sports", media: null },
  { href: "/movies", label: "Movies", icon: "movies", base: "/movies", media: null },
  { href: "/tv", label: "TV Shows", icon: "series", base: "/tv", media: null },
  { href: "/browse", label: "Browse", icon: "browse", base: "/browse", media: "all" },
  { href: "/anime", label: "Anime Hub", icon: "anime", base: "/anime", media: null },
  { href: "/editorial", label: "Editorial", icon: "editorial", base: "/editorial", media: null },
  { href: "/my-list", label: "Watchlist", icon: "watchlist", base: "/my-list", media: null },
];




/* ---------- Logo ---------- */
function ApolloLogo({ compact }: { compact: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Apollo home">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[#FACC15]/25 blur-md" aria-hidden="true" />
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="relative">
          <circle cx="16" cy="16" r="14" stroke="#FACC15" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="6" fill="#FACC15" />
          <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="text-lg font-black tracking-tight text-text-vivid">
          Apollo<span className="text-[#FACC15]">.</span>
        </span>
      )}
    </Link>
  );
}

/* ---------- Command search (Cmd+K) ---------- */
function useSummonSearch(onSummon: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSummon();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSummon]);
}

function CommandSearch({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"multi" | "movie" | "tv">("multi");
  const [res, setRes] = useState<Title[]>([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSummonSearch(useCallback(() => setOpen(true), [setOpen]));

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setRes([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await get<ContentListResponse>(
          `/api/v1/content/search?q=${encodeURIComponent(query)}&media_type=${cat}`,
        );
        if (!cancelled) setRes((data.results || []).slice(0, 6));
      } catch {
        if (!cancelled) setRes([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, cat]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div ref={boxRef} className="relative flex-1">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="flex h-10 items-center gap-2.5 rounded-full px-4 bg-[#09090B]/80 border border-white/10 focus-within:bg-[#09090B] focus-within:border-[#FACC15]/60 transition"
      >
        <Icon name="searchIcon" className="h-4 w-4 text-text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search titles, actors..."
          aria-label="Search"
          className="w-full bg-transparent text-sm font-medium text-text-vivid outline-none placeholder:text-text-muted"
        />
        <kbd className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-text-muted sm:block">
          ⌘K
        </kbd>
      </form>

      {open && q.trim().length >= 2 && (
        <div className="animate-rise absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-[#09090B]/95 border border-white/15 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-1 border-b border-white/10 p-2">
            {(
              [
                { value: "multi", label: "All" },
                { value: "movie", label: "Movies" },
                { value: "tv", label: "Series" },
              ] as const
            ).map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                aria-pressed={cat === c.value}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${cat === c.value ? "bg-[#FACC15] text-[#0B0B0C]" : "text-text-muted hover:text-text-vivid"
                  }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {busy ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#FACC15] border-t-transparent" />
              Searching...
            </div>
          ) : res.length === 0 ? (
            <p className="px-4 py-4 text-sm text-text-muted">No results for "{q}".</p>
          ) : (
            res.map((item) => {
              const mt = item.media_type === "tv" ? "tv" : "movie";
              const href = mt === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
              return (
                <button
                  key={`${mt}-${item.id}`}
                  onClick={() => go(href)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                >
                  <Image
                    src={posterUrl(item.poster_path, "w92")}
                    alt=""
                    width={40}
                    height={60}
                    className="h-[60px] w-10 shrink-0 rounded-lg object-cover border border-white/10"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-vivid">{titleName(item)}</p>
                    <p className="flex items-center gap-2 text-xs text-text-muted">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${mt === "tv" ? "bg-[#FACC15]/15 text-[#FACC15] border border-[#FACC15]/30" : "bg-white/10 text-text-muted"
                          }`}
                      >
                        {mt}
                      </span>
                      {releaseYear(item)}
                      {item.vote_average ? <span className="text-[#FACC15]">★ {item.vote_average.toFixed(1)}</span> : null}
                    </p>
                  </div>
                </button>
              );
            })
          )}
          <button
            onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
            className="block w-full border-t border-white/10 px-4 py-2.5 text-left text-sm font-medium text-[#FACC15] transition hover:bg-white/5"
          >
            See all results for "{q}" →
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Mobile menu ---------- */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="glass animate-rise absolute left-4 right-4 top-4 overflow-hidden rounded-3xl border border-white/15 bg-[#09090B]/95 p-2 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <ApolloLogo compact={false} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-muted hover:text-white"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1 p-2">
          {DOCK_TOP.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.href)}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold text-text-vivid transition hover:bg-white/5"
            >
              <span className="w-5 text-text-muted">
                <Icon name={l.icon} className="h-5 w-5" />
              </span>
              {l.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-white/10 p-3">

          <Link
            href="/movie-night"
            onClick={onClose}
            className="cinema-btn-gold flex w-full items-center justify-center gap-2 text-sm font-bold"
          >
            Movie Night Room
          </Link>
          {user ? (
            <button
              onClick={() => go("/profile")}
              className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-left text-sm text-text-muted transition hover:bg-white/10 hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FACC15] font-bold text-[#0B0B0C]">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              {user.name || user.email}
            </button>
          ) : loading ? null : (
            <button
              onClick={() => go("/login")}
              className="cinema-btn-pill w-full text-center text-sm font-semibold"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Navbar ---------- */
export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const media = searchParams.get("media_type");
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const openCinebot = () => window.dispatchEvent(new CustomEvent("apollo:cinebot"));

  const doSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push("/");
  };

  const isActive = (link: (typeof DOCK_TOP)[number]) => {
    if (link.base === "/") return pathname === "/";
    if (link.base === "/movies") return pathname === "/movies";
    if (link.base === "/tv") return pathname === "/tv";
    if (link.base === "/anime") return pathname.startsWith("/anime");
    if (link.base === "/my-list") return pathname.startsWith("/my-list");
    if (link.base === "/browse") {
      if (pathname !== "/browse") return false;
      if (link.media === "all") return !media || (media !== "movie" && media !== "tv");
      return media === link.media;
    }
    return pathname.startsWith(link.base);
  };


  const initials = (user?.name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <>
      {/* Left floating glass dock (desktop) */}
      <aside
        className="fixed bottom-4 left-4 top-4 z-40 hidden lg:block"
        aria-label="Primary navigation"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div
          className={`flex h-full flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#09090B]/80 backdrop-blur-xl shadow-glass transition-all duration-500 ease-out ${
            hover ? "w-60" : "w-[72px]"
          }`}
        >
          <div className={`flex h-16 shrink-0 items-center ${hover ? "px-4" : "justify-center px-0"}`}>
            <ApolloLogo compact={!hover} />
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-hidden p-2">
            {DOCK_TOP.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`card-lift relative flex h-11 shrink-0 items-center gap-3 rounded-full transition ${
                  hover ? "px-4" : "justify-center px-0"
                } ${
                  isActive(link)
                    ? "bg-white/10 text-text-vivid border border-white/20"
                    : "text-text-muted hover:bg-white/[0.05] hover:text-text-vivid"
                }`}
              >
                {isActive(link) && (
                  <span className="absolute left-0 h-5 w-1 rounded-r-full bg-[#FACC15]" aria-hidden="true" />
                )}
                <span className="flex w-6 shrink-0 items-center justify-center">
                  <Icon name={link.icon} className={`h-5 w-5 ${isActive(link) ? "text-[#FACC15]" : ""}`} />
                </span>
                {hover && (
                  <span className="whitespace-pre text-sm font-semibold">{link.label}</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="shrink-0 border-t border-white/[0.08] p-2">

            <Link
              href="/movie-night"
              className={`card-lift flex h-11 w-full items-center gap-3 rounded-full text-left transition ${
                hover ? "px-4" : "justify-center px-0"
              } text-text-muted hover:bg-white/[0.05] hover:text-text-vivid`}
            >
              <span className="flex w-6 shrink-0 items-center justify-center text-[#FACC15]">
                <Icon name="people" className="h-5 w-5" />
              </span>
              {hover && <span className="text-sm font-semibold">Movie Night Room</span>}
            </Link>
          </div>
        </div>
      </aside>

      {/* Top glass command strip */}
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-4 lg:pl-[calc(72px+1rem)]">
        <div className="flex w-full max-w-7xl items-center gap-3 rounded-full border border-white/[0.08] bg-[#09090B]/75 px-3 py-2 backdrop-blur-xl">


          <CommandSearch open={searchOpen} setOpen={setSearchOpen} />

          <div className="flex shrink-0 items-center gap-2">
            {!mounted || loading ? (
              <div className="h-10 w-24 animate-pulse rounded-full border border-white/10 bg-white/5" aria-hidden="true" />
            ) : user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 pl-1 pr-3 transition"
                >
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#FACC15] font-bold text-[#0B0B0C]">
                    {user.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="hidden max-w-[7rem] truncate text-sm font-medium text-text-vivid sm:block">
                    {user.name || user.email}
                  </span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="animate-rise absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl bg-[#09090B]/95 border border-white/15 shadow-2xl backdrop-blur-2xl"
                  >
                    {[
                      { href: "/my-list", label: "My List" },
                      { href: "/history", label: "Viewing History" },
                      { href: "/settings/addons", label: "⊕ Add-ons" },
                      { href: "/profile", label: "Account Settings" },
                    ].map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setMenuOpen(false)}
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-text-muted transition hover:bg-white/10 hover:text-text-vivid"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="border-t border-white/10">
                      <button
                        onClick={doSignOut}
                        role="menuitem"
                        className="block w-full px-4 py-2.5 text-left text-sm text-[#FACC15] transition hover:bg-white/10"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="cinema-btn-gold h-10 px-5 text-sm font-semibold"
              >
                Sign in
              </Link>
            )}


            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 hover:text-text-vivid lg:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {mobileOpen ? (
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                ) : (
                  <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && <MobileMenu onClose={() => setMobileOpen(false)} />}
    </>
  );
}