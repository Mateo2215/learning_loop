"use client";

import { useEffect, useState } from "react";
import { CloudOff, Cloud, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { flushQueue, pendingCount } from "@/lib/offline/queue";

/**
 * Tiny status badge showing online/offline + count of locally queued reviews.
 * Also handles automatic flush when connectivity returns.
 *
 * Mounted once in `app/(app)/layout.tsx` so the auto-flush wiring is global.
 */
export function OnlineIndicator() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [flushing, setFlushing] = useState(false);

  // Initial state + listen for changes
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Refresh queued count periodically while a session might be writing
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const n = await pendingCount();
      if (!cancelled) setQueued(n);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-flush when coming back online with anything queued
  useEffect(() => {
    if (!online) return;
    if (queued === 0) return;
    if (flushing) return;
    void doFlush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queued]);

  async function doFlush() {
    setFlushing(true);
    try {
      const result = await flushQueue();
      if (result.succeeded > 0) {
        toast.success(`Zsynchronizowano ${result.succeeded} odpowiedzi`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} odpowiedzi czeka — spróbuję ponownie`);
      }
      const n = await pendingCount();
      setQueued(n);
    } finally {
      setFlushing(false);
    }
  }

  if (online && queued === 0) return null;

  return (
    <button
      onClick={() => void doFlush()}
      title={online ? "Zsynchronizuj kolejkę" : "Brak połączenia"}
      className="fixed bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur px-2.5 py-1 text-xs shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {flushing ? (
        <RotateCw className="h-3.5 w-3.5 animate-spin" />
      ) : online ? (
        <Cloud className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      )}
      <span>{online ? "online" : "offline"}</span>
      {queued > 0 && (
        <span className="px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-mono">
          {queued}
        </span>
      )}
    </button>
  );
}
