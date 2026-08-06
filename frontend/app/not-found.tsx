import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs uppercase tracking-wide text-brand-soft">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tightest text-text-vivid">Page not found</h1>
      <p className="mt-3 text-sm text-text-muted">
        We couldn&apos;t find what you were looking for. It may have been moved or deleted.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
      >
        Back to home
      </Link>
    </div>
  );
}
