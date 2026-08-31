import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl font-semibold text-brand">404</div>
      <p className="mt-3 text-sm text-muted">That case or page doesn’t exist.</p>
      <Link href="/" className="mt-5">
        <Button variant="primary">Back to overview</Button>
      </Link>
    </div>
  );
}
