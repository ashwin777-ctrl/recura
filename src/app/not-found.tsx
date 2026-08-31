import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl font-semibold text-brand">404</div>
      <p className="mt-3 text-sm text-muted">That case or page doesn’t exist.</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand/90"
      >
        Back to overview
      </Link>
    </div>
  );
}
