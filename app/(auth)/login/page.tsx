"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50 dark:bg-black">
      {/* useSearchParams must be inside Suspense for static prerendering. */}
      <Suspense fallback={null}>
        <CallbackErrorToast />
      </Suspense>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Learning Loop</CardTitle>
          <CardDescription>
            Wpisz swój e-mail — wyślemy Ci link do logowania.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <div className="text-sm">
              <p className="font-medium">Sprawdź skrzynkę.</p>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Wysłaliśmy link na <span className="font-mono">{email}</span>. Kliknij go w ciągu 60 minut.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                required
                placeholder="ty@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending"}
                autoComplete="email"
                autoFocus
              />
              <Button type="submit" disabled={status === "sending" || !email}>
                {status === "sending" ? "Wysyłam…" : "Wyślij link"}
              </Button>
              {errorMessage && (
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
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
