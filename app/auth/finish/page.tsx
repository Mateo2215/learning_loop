"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthFinishPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Suspense fallback={<p className="text-sm text-muted">Kończę logowanie…</p>}>
        <FinishInner />
      </Suspense>
    </div>
  );
}

function FinishInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Kończę logowanie…");

  useEffect(() => {
    const next = params.get("next") ?? "/dashboard";
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hashError = hashParams.get("error_description") ?? hashParams.get("error");

    if (hashError) {
      router.replace(`/login?error=${encodeURIComponent(hashError)}`);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace("/login?error=missing_tokens");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
        setMessage("Zalogowano. Przekierowuję…");
        router.replace(next);
      });
  }, [params, router]);

  return <p className="text-sm text-muted">{message}</p>;
}
