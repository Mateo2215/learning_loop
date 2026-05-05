"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      toast.error("Nie udało się wysłać linku", { description: error.message });
      return;
    }
    setStatus("sent");
    toast.success("Link wysłany", { description: `Sprawdź ${email}.` });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-canvas">
      {/* useSearchParams must be inside Suspense for static prerendering. */}
      <Suspense fallback={null}>
        <CallbackErrorToast />
      </Suspense>

      <main className="w-full max-w-md">
        <div className="mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-medium leading-[1.05] tracking-tight">
            Learning <span className="text-accent">Loop</span>
          </h1>
          <p className="mt-3 text-sm text-muted max-w-prose">
            Active recall + spaced repetition + AI walidacja. Dla osób, które uczą się codziennie i chcą wiedzieć, co naprawdę zostało w głowie.
          </p>
        </div>

        {status === "sent" ? (
          <div className="border-y border-line py-6">
            <p className="font-serif text-lg font-medium">Sprawdź skrzynkę.</p>
            <p className="mt-2 text-sm text-muted">
              Wysłaliśmy link na <span className="font-mono text-fg">{email}</span>.
              Kliknij go w ciągu 60 minut.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-xs uppercase tracking-widest text-muted" htmlFor="email">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              required
              placeholder="ty@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "sending"}
              autoComplete="email"
              autoFocus
              className="h-12 text-base"
            />
            <Button
              type="submit"
              disabled={status === "sending" || !email}
              className="h-12 text-base mt-1"
            >
              {status === "sending" ? "Wysyłam…" : "Wyślij link logowania"}
            </Button>
            <p className="text-xs text-muted mt-1">
              Bez hasła. Magic Link — kliknij i jesteś w środku.
            </p>
            {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
          </form>
        )}
      </main>
    </div>
  );
}

function CallbackErrorToast() {
  const params = useSearchParams();
  useEffect(() => {
    const err = params.get("error");
    if (err) {
      toast.error("Logowanie nie powiodło się", { description: err });
    }
  }, [params]);
  return null;
}
