"use client";

import { useState, useRef, useEffect } from "react";

export function TimeTracker({ contractId }: { contractId: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<{ start: string; duration: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<string | null>(null);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const toggleTimer = () => {
    if (isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const duration = elapsed;
      const session = { start: startRef.current || new Date().toISOString(), duration };
      setSessions((prev) => [...prev, session]);
      fetch("/api/time-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, startTime: session.start, duration }),
      }).catch(() => {});
      setElapsed(0);
      startRef.current = null;
    } else {
      startRef.current = new Date().toISOString();
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    setIsRunning(!isRunning);
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalTracked = sessions.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="rounded-xl border border-[#E2E0D9] p-6">
      <h3 className="font-semibold mb-4">⏱️ Time Tracker</h3>
      <div className="text-center">
        <p className="text-4xl font-bold font-mono text-[#2D5BE3]">{formatTime(elapsed)}</p>
        <p className="mt-1 text-xs text-[#5A5750]">Session en cours</p>
        <button
          onClick={toggleTimer}
          className={`mt-4 rounded-lg px-8 py-3 text-sm font-medium transition-colors ${
            isRunning
              ? "bg-[#C0392B] text-white hover:bg-[#C0392B]/90"
              : "bg-[#2D5BE3] text-white hover:bg-[#1F4DD4]"
          }`}
        >
          {isRunning ? "⏹ Arrêter" : "▶ Démarrer"}
        </button>
      </div>
      {sessions.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Sessions ({sessions.length})</p>
          <p className="text-lg font-semibold">Total: {formatTime(totalTracked)}</p>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {sessions.map((s, i) => (
              <div key={i} className="flex justify-between text-xs text-[#5A5750]">
                <span>{new Date(s.start).toLocaleDateString("fr-FR")}</span>
                <span>{formatTime(s.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
