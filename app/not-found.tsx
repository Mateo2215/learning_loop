import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="max-w-md flex flex-col gap-4 text-center">
        <h1 className="text-3xl font-semibold">404</h1>
        <p className="text-sm text-muted">
          Nie znaleziono tej strony. Możliwe, że link jest nieaktualny.
        </p>
        <div className="flex gap-2 justify-center">
          <Button asChild>
            <Link href="/dashboard">← Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
