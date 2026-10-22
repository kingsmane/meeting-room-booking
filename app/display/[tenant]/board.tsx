"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type BoardMeeting = {
  id: number;
  startMs: number;
  endMs: number;
  room: string;
  floor: string;
  title: string;
  agenda: string;
  pic: string;
  organizer: string;
  postponed: boolean;
};

type Status = "IN_PROGRESS" | "STARTING_SOON" | "ON_TIME" | "POSTPONED";

// Parameter layar berasal dari pengaturan tenant (lihat lib/settings.ts).
export type BoardConfig = {
  soonMinutes: number; // "Segera dimulai" = mulai dalam N menit
  pageSize: number;
  rotateSeconds: number;
  refreshSeconds: number;
};

const TZ = "Asia/Jakarta";
const COLS =
  "grid-cols-[minmax(0,15fr)_minmax(0,19fr)_minmax(0,30fr)_minmax(0,16fr)_minmax(0,20fr)]";

const STATUS_STYLE: Record<Status, string> = {
  IN_PROGRESS: "bg-green-600 text-white",
  STARTING_SOON: "bg-yellow-400 text-slate-900",
  ON_TIME: "bg-slate-600 text-white",
  POSTPONED: "bg-red-600 text-white",
};

const STATUS_LABEL: Record<Status, [string, string]> = {
  IN_PROGRESS: ["SEDANG BERLANGSUNG", "IN PROGRESS"],
  STARTING_SOON: ["SEGERA DIMULAI", "STARTING SOON"],
  ON_TIME: ["SESUAI JADWAL", "ON TIME"],
  POSTPONED: ["DITUNDA", "POSTPONED"],
};

function statusOf(m: BoardMeeting, now: number, soonMinutes: number): Status {
  if (m.postponed) return "POSTPONED";
  if (now >= m.startMs) return "IN_PROGRESS";
  if (m.startMs - now <= soonMinutes * 60_000) return "STARTING_SOON";
  return "ON_TIME";
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function Board({
  meetings,
  announcements,
  serverNow,
  config,
}: {
  meetings: BoardMeeting[];
  announcements: string[];
  serverNow: number;
  config: BoardConfig;
}) {
  const { soonMinutes, pageSize, rotateSeconds, refreshSeconds } = config;
  const router = useRouter();
  // Mulai dari waktu server supaya HTML server dan klien identik, lalu berjalan tiap detik.
  const [now, setNow] = useState(serverNow);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), refreshSeconds * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router, refreshSeconds]);

  // Rapat yang sudah selesai tidak ditampilkan; yang ditunda tetap tampil sampai jamnya lewat.
  const visible = meetings.filter((m) => m.endMs > now);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));

  useEffect(() => {
    if (pages <= 1) return;
    const t = setInterval(() => setPage((p) => p + 1), rotateSeconds * 1000);
    return () => clearInterval(t);
  }, [pages, rotateSeconds]);

  const current = page % pages;
  const rows = visible.slice(current * pageSize, (current + 1) * pageSize);

  const dateText = new Date(now).toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const clock = hhmm(now);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050f24] text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between gap-4 bg-[#0d2a7a] px-[2vw] py-[1.2vw]">
        <div className="flex items-center gap-[1.5vw]">
          <div className="flex size-[5.5vw] items-center justify-center rounded-xl bg-yellow-400 text-[3vw]">
            👥
          </div>
          <div>
            <h1 className="text-[4.2vw] font-black leading-none tracking-tight">JADWAL RAPAT</h1>
            <p className="mt-[0.4vw] text-[2vw] font-bold tracking-wide text-yellow-400">
              MEETING SCHEDULE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-[2vw]">
          <div className="text-right text-[1.5vw] leading-snug">
            <p>{dateText}</p>
            <p className="opacity-80">{clock} WIB</p>
          </div>
          <p className="border-l border-white/30 pl-[2vw] text-[5.5vw] font-bold leading-none tabular-nums">
            {clock}
          </p>
        </div>
      </header>

      {/* HEAD KOLOM */}
      <div className={`grid ${COLS} bg-[#08142c] px-[1vw] py-[0.8vw] text-[1.2vw] font-bold`}>
        {[
          ["WAKTU", "TIME"],
          ["RUANG RAPAT", "MEETING ROOM"],
          ["TOPIK RAPAT", "MEETING TOPIC"],
          ["PIC / PENYELENGGARA", "ORGANIZER"],
          ["STATUS", "STATUS"],
        ].map(([id, en]) => (
          <div key={id} className="px-[0.6vw] leading-tight">
            <p>{id}</p>
            <p className="text-[0.95vw] text-yellow-400">{en}</p>
          </div>
        ))}
      </div>

      {/* BARIS */}
      <main className="flex min-h-0 flex-1 flex-col">
        {rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-[2.5vw] font-bold text-white/60">
            Tidak ada rapat terjadwal.
          </div>
        )}
        {rows.map((m, i) => {
          const status = statusOf(m, now, soonMinutes);
          const [idLabel, enLabel] = STATUS_LABEL[status];
          return (
            <div
              key={m.id}
              className={`grid min-h-0 flex-1 ${COLS} items-stretch border-t border-white/10 px-[1vw] ${
                i % 2 ? "bg-[#0b1c3d]" : "bg-[#07142f]"
              }`}
            >
              <div className="flex items-center px-[0.6vw] text-[2.1vw] font-bold tabular-nums">
                {hhmm(m.startMs)} – {hhmm(m.endMs)}
              </div>
              <div className="flex min-w-0 flex-col justify-center bg-blue-700 px-[1vw]">
                <p className="truncate text-[1.65vw] font-bold leading-tight">{m.room}</p>
                <p className="truncate text-[1.2vw] text-white/80">{m.floor}</p>
              </div>
              <div className="flex min-w-0 flex-col justify-center px-[1vw]">
                <p className="truncate text-[1.7vw] font-bold leading-tight">{m.title}</p>
                <p className="truncate text-[1.3vw] text-white/70">{m.agenda}</p>
              </div>
              <div className="flex min-w-0 flex-col justify-center px-[1vw]">
                <p className="truncate text-[1.5vw] font-bold leading-tight">{m.pic}</p>
                <p className="truncate text-[1.3vw] text-white/70">{m.organizer}</p>
              </div>
              <div className="flex items-center px-[0.6vw]">
                <div
                  className={`w-full rounded-md px-[0.8vw] py-[0.4vw] leading-tight ${STATUS_STYLE[status]}`}
                >
                  <p className="whitespace-nowrap text-[1.15vw] font-extrabold">{idLabel}</p>
                  <p className="whitespace-nowrap text-[0.95vw] opacity-90">{enLabel}</p>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* PENGUMUMAN */}
      <footer className="flex items-center gap-[1.5vw] bg-sky-200 px-[2vw] py-[0.8vw] text-[1.15vw] text-slate-900">
        <span className="shrink-0 text-[1.5vw] font-black">📢 Pengumuman :</span>
        <p className="line-clamp-2 min-w-0 flex-1 leading-snug">{announcements.join("   |   ")}</p>
        {pages > 1 && (
          <span className="shrink-0 font-bold tabular-nums">
            Halaman {current + 1}/{pages}
          </span>
        )}
      </footer>
    </div>
  );
}
