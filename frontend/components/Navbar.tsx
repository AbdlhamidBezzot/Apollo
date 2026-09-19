"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useAuth } from "@/components/AuthContext";
import { THEME_PRESETS, useTheme } from "@/components/ThemeContext";
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
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
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
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
};

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
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

/* ---------- Nav link data ---------- */
const NAV_LINKS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/movies", label: "Movies", icon: "movies" },
  { href: "/tv", label: "TV Shows", icon: "series" },
  { href: "/anime", label: "Anime", icon: "anime" },
  { href: "/browse", label: "Browse", icon: "browse" },
];

/* ---- Browse dropdown items ---- */
const BROWSE_ITEMS = [
  { href: "/sports", label: "Live Sports", icon: "sports" },
  { href: "/editorial", label: "Editorial", icon: "editorial" },
  { href: "/my-list", label: "Watchlist", icon: "watchlist" },
  { href: "/movie-night", label: "Movie Night Room", icon: "people" },
];

/* ---------- Logo ---------- */
function ApolloLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Apollo home">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[var(--brand-accent)]/20 blur-md" aria-hidden="true" />
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="relative">
          <circle cx="16" cy="16" r="14" stroke="var(--brand-accent)" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="6" fill="var(--brand-accent)" />
          <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="var(--brand-accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-base font-black tracking-tight text-white">
        Apollo<span style={{ color: "var(--brand-accent)" }}>.</span>
      </span>
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
  }, [open, setOpen]);

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
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Search"
        id="navbar-search-btn"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white hover:border-[var(--brand-accent)]/50"
      >
        <Icon name="searchIcon" className="h-4 w-4" />
      </button>

      {open && (
        <div className="animate-rise absolute right-0 top-full mt-3 z-50 w-[360px] overflow-hidden rounded-2xl bg-[#09090B]/98 border border-white/15 backdrop-blur-2xl shadow-2xl">
          {/* Search input inside dropdown */}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
            className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3"
          >
            <Icon name="searchIcon" className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles, actors..."
              aria-label="Search"
              className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-text-muted"
            />
            <kbd className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-text-muted sm:block">
              ⌘K
            </kbd>
          </form>

          {/* Category filter */}
          <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
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
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${cat === c.value ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)]" : "text-text-muted hover:text-white"
                  }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {q.trim().length >= 2 ? (
            busy ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--brand-accent)] border-t-transparent" />
                Searching...
              </div>
            ) : res.length === 0 ? (
              <p className="px-4 py-4 text-sm text-text-muted">No results for &quot;{q}&quot;.</p>
            ) : (
              <>
                {res.map((item) => {
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
                        <p className="truncate text-sm font-semibold text-white">{titleName(item)}</p>
                        <p className="flex items-center gap-2 text-xs text-text-muted">
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${mt === "tv" ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30" : "bg-white/10 text-text-muted"
                              }`}
                          >
                            {mt}
                          </span>
                          {releaseYear(item)}
                          {item.vote_average ? <span style={{ color: "var(--brand-accent)" }}>★ {item.vote_average.toFixed(1)}</span> : null}
                        </p>
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
                  className="block w-full border-t border-white/10 px-4 py-2.5 text-left text-sm font-medium transition hover:bg-white/5"
                  style={{ color: "var(--brand-accent)" }}
                >
                  See all results for &quot;{q}&quot; →
                </button>
              </>
            )
          ) : (
            <p className="px-4 py-4 text-sm text-text-muted">Type to search movies, series, actors…</p>
          )}
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
          <ApolloLogo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-muted hover:text-white"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1 p-2">
          {[...NAV_LINKS, ...BROWSE_ITEMS].map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.href)}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              <span className="w-5 text-text-muted">
                <Icon name={l.icon} className="h-5 w-5" />
              </span>
              {l.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-white/10 p-3">
          {user ? (
            <button
              onClick={() => go("/profile")}
              className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-left text-sm text-text-muted transition hover:bg-white/10 hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full font-bold" style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-accent-text)" }}>
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              {user.name || user.email}
            </button>
          ) : loading ? null : (
            <button
              onClick={() => go("/login")}
              className="cinema-btn-accent w-full text-center text-sm font-semibold"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Theme Picker Dropdown ---------- */
function ThemePickerDropdown() {
  const { theme, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change Theme Accent Color"
        aria-label="Change Theme Accent Color"
        id="navbar-theme-btn"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10 hover:border-white/30"
      >
        <span
          className="h-4 w-4 rounded-full border border-white/40 shadow-sm"
          style={{ backgroundColor: theme.primary }}
        />
      </button>

      {open && (
        <div className="animate-rise absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-white/15 bg-[#09090B]/95 p-3 backdrop-blur-2xl shadow-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted px-1">
            Accent Theme Color
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setThemeId(p.id);
                  setOpen(false);
                }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                  theme.id === p.id
                    ? "border-white/40 bg-white/15 scale-105"
                    : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full border border-white/30 shadow-md"
                  style={{ backgroundColor: p.primary }}
                />
                <span className="text-[10px] font-semibold text-white/80 truncate w-full text-center">
                  {p.name.split(" ")[1] || p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Browse Dropdown ---------- */
function BrowseDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isActive = BROWSE_ITEMS.some((item) => pathname.startsWith(item.href));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
          isActive
            ? "text-white"
            : "text-white/60 hover:text-white"
        }`}
        style={isActive ? { color: "var(--brand-accent)" } : {}}
      >
        More
        <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-rise absolute left-0 top-full mt-2 z-50 w-52 rounded-2xl border border-white/15 bg-[#09090B]/98 p-1.5 backdrop-blur-2xl shadow-2xl">
          {BROWSE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
            >
              <span className="text-text-muted">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Main Navbar ---------- */
export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const doSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const initials = (user?.name || user?.email || "A").charAt(0).toUpperCase();

  return (
    <>
      {/* Top horizontal navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-[#09090B]/95 border-b border-white/[0.08] backdrop-blur-xl shadow-lg"
            : "bg-gradient-to-b from-[#09090B]/80 to-transparent backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8">

          {/* Left: Logo */}
          <ApolloLogo />

          {/* Center: Nav links (desktop) */}
          <nav className="hidden lg:flex items-center gap-1 mx-auto" aria-label="Main navigation">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? "text-white"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                  style={active ? { color: "var(--brand-accent)" } : {}}
                >
                  {active && (
                    <span
                      className="absolute inset-0 rounded-full opacity-15"
                      style={{ backgroundColor: "var(--brand-accent)" }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon name={link.icon} className="h-4 w-4 relative" />
                  <span className="relative">{link.label}</span>
                </Link>
              );
            })}
            <BrowseDropdown />
          </nav>

          {/* Right: Actions */}
          <div className="ml-auto flex items-center gap-2">

            {/* Search */}
            <CommandSearch open={searchOpen} setOpen={setSearchOpen} />

            {/* Theme Picker */}
            <ThemePickerDropdown />

            {/* User menu (desktop) */}
            {!mounted || loading ? (
              <div className="h-9 w-20 animate-pulse rounded-full border border-white/10 bg-white/5" aria-hidden="true" />
            ) : user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  id="navbar-user-btn"
                  className="flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 pl-1 pr-3 transition"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full font-bold"
                    style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-accent-text)" }}
                  >
                    {user.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="hidden max-w-[7rem] truncate text-sm font-medium text-white sm:block">
                    {user.name || user.email}
                  </span>
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="animate-rise absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl bg-[#09090B]/98 border border-white/15 shadow-2xl backdrop-blur-2xl"
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
                        className="block px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="border-t border-white/10">
                      <button
                        onClick={doSignOut}
                        role="menuitem"
                        className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-white/10"
                        style={{ color: "var(--brand-accent)" }}
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
                className="cinema-btn-accent h-9 px-5 text-sm font-semibold"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:text-white lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
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