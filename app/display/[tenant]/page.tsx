import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDisplayData } from "@/lib/data";
import { resolveDisplayTenant } from "@/lib/settings";
import { parseTs, todayJakarta } from "@/lib/booking";
import { Board, type BoardMeeting } from "./board";

const DEFAULT_ANNOUNCEMENTS = ["Harap hadir tepat waktu dan menyiapkan materi rapat."];

export default function DisplayPage({ params, searchParams }: PageProps<"/display/[tenant]">) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#050f24] text-3xl font-bold text-white">
          Memuat jadwal rapat…
        </div>
      }
    >
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({
  params,
  searchParams,
}: {
  params: PageProps<"/display/[tenant]">["params"];
  searchParams: PageProps<"/display/[tenant]">["searchParams"];
}) {
  const { tenant: tenantCode } = await params;
  const query = await searchParams;
  await connection(); // jadwal dan jam berbeda tiap request

  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // Layar tidak punya login: akses dijaga token per tenant. Token salah = 404 (tidak membocorkan keberadaan tenant).
  const access = await resolveDisplayTenant(decodeURIComponent(tenantCode), first(query.key));
  if (!access) notFound();

  const location = first(query.location);
  const { bookings, settings, now } = await getDisplayData(
    access.tenantId,
    todayJakarta(),
    location && /^[A-Za-z0-9_-]{1,50}$/.test(location) ? location : undefined,
  );

  const meetings: BoardMeeting[] = bookings.map((b) => ({
    id: b.id,
    startMs: parseTs(b.startAt).getTime(),
    endMs: parseTs(b.endAt).getTime(),
    room: b.roomName,
    floor: b.floor ?? "",
    title: b.title,
    agenda: b.agenda ?? "",
    pic: b.department ?? b.organizer,
    organizer: b.organizer,
    postponed: b.status === "POSTPONED",
  }));

  return (
    <Board
      meetings={meetings}
      announcements={settings.announcements.length ? settings.announcements : DEFAULT_ANNOUNCEMENTS}
      serverNow={now}
      config={settings.display}
    />
  );
}
