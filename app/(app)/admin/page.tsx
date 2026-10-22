import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { can, requireUser } from "@/lib/auth";
import { getBookingStats, listBookings, listPendingBookings } from "@/lib/data";
import {
  addDays,
  allowedTransitions,
  formatDateLong,
  formatTime,
  isDateString,
  parseTs,
  todayJakarta,
  TZ,
  type BookingStatus,
} from "@/lib/booking";
import { fetchPage, parsePaging, parseSearch } from "@/lib/pagination";
import { StatusBadge, StatusButtons } from "@/components/booking-ui";
import { Pagination } from "@/components/pagination";
import { Card, EmptyRow, PageHeader, SearchBar, StatCard, th } from "@/components/ui";

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat jadwal…</p>}>
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

const navBtn =
  "inline-flex h-9 items-center rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50";

async function Schedule({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const user = await requireUser();
  const seesSchedule = can(user, "booking.manage") || can(user, "booking.approve") || user.bookingScope !== "OWN";
  if (!seesSchedule) redirect("/forbidden");

  const params = await searchParams;
  await connection(); // jam sekarang berbeda tiap request
  const today = todayJakarta();
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const date = isDateString(rawDate) ? rawDate : today;
  const pendingView = params.view === "pending";
  const q = parseSearch(params);
  const { page, size } = parsePaging(params);

  const [result, stats] = await Promise.all([
    fetchPage(
      (limit, offset) =>
        pendingView ? listPendingBookings(user, q, { limit, offset }) : listBookings(user, date, q, { limit, offset }),
      page,
      size,
    ),
    getBookingStats(user, date),
  ]);

  const returnTo = (() => {
    const p = new URLSearchParams();
    if (pendingView) p.set("view", "pending");
    else p.set("date", date);
    if (q) p.set("q", q);
    if (result.page > 1) p.set("page", String(result.page));
    if (size !== 10) p.set("size", String(size));
    return `/admin?${p.toString()}`;
  })();

  const keep: Record<string, string | undefined> = {
    view: pendingView ? "pending" : undefined,
    date: pendingView ? undefined : date,
    q: q || undefined,
    size: size === 10 ? undefined : String(size),
  };
  const by = stats.byStatus;

  return (
    <>
      <PageHeader
        title={pendingView ? "Menunggu Persetujuan" : "Jadwal Booking"}
        description={
          pendingView ? (
            "Semua pengajuan yang belum diputuskan."
          ) : (
            <>
              {formatDateLong(date)}
              {date === today && (
                <span className="ml-2 rounded bg-yellow-300 px-1.5 py-0.5 text-xs font-bold text-slate-900">HARI INI</span>
              )}
              {user.bookingScope !== "ALL" && (
                <span className="ml-2 text-xs">
                  (cakupan: {user.bookingScope === "DEPARTMENT" ? "departemen Anda" : "milik Anda"})
                </span>
              )}
            </>
          )
        }
        actions={
          can(user, "booking.manage") && (
            <Link
              href={`/book?as=other&date=${date}`}
              className="inline-flex h-9 items-center rounded-lg bg-[#0d2a7a] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#0a2160]"
            >
              + Booking Baru
            </Link>
          )
        }
      />

      {!pendingView && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Total rapat" value={stats.total} icon="calendar" tone="blue" />
          <StatCard label="Disetujui" value={by.APPROVED ?? 0} icon="check" tone="green" />
          <StatCard label="Menunggu persetujuan" value={by.PENDING ?? 0} icon="clock" tone="amber" />
          <StatCard label="Ditunda / dibatalkan" value={(by.POSTPONED ?? 0) + (by.CANCELLED ?? 0)} icon="alert" tone="rose" />
        </div>
      )}

      <Card
        flush
        title={pendingView ? "Pengajuan" : "Daftar booking"}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={pendingView ? "/admin" : "/admin?view=pending"} className={navBtn}>
              {pendingView ? "Jadwal harian" : "Menunggu persetujuan"}
            </Link>
            {!pendingView && (
              <>
                <Link href={`/admin?date=${addDays(date, -1)}`} className={navBtn} aria-label="Hari sebelumnya">
                  ←
                </Link>
                <Link href="/admin" className={navBtn}>
                  Hari ini
                </Link>
                <Link href={`/admin?date=${addDays(date, 1)}`} className={navBtn} aria-label="Hari berikutnya">
                  →
                </Link>
                <form className="flex gap-2">
                  {q && <input type="hidden" name="q" value={q} />}
                  <input
                    type="date"
                    name="date"
                    defaultValue={date}
                    className="h-9 rounded-lg bg-white px-3 text-sm shadow-sm ring-1 ring-slate-200"
                  />
                  <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    Lihat
                  </button>
                </form>
              </>
            )}
            <SearchBar
              q={q}
              placeholder="Cari judul, ruangan, penyelenggara"
              keep={{ view: keep.view, date: keep.date, size: keep.size }}
              resetHref={pendingView ? "/admin?view=pending" : `/admin?date=${date}`}
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Waktu</th>
                <th className={th}>Ruangan</th>
                <th className={th}>Rapat</th>
                <th className={th}>Penyelenggara</th>
                <th className={th}>Status</th>
                <th className={th}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.length === 0 && (
                <EmptyRow colSpan={6}>
                  {q
                    ? `Tidak ada booking yang cocok dengan “${q}”.`
                    : pendingView
                      ? "Tidak ada pengajuan yang menunggu."
                      : "Belum ada booking pada tanggal ini."}
                </EmptyRow>
              )}
              {result.rows.map((b) => {
                const status = b.status as BookingStatus;
                const transitions = allowedTransitions(user, { status, organizerMemberId: b.organizerMemberId });
                return (
                  <tr key={b.id} className="align-top hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 font-bold">
                      {(pendingView || q) && (
                        <span className="block text-xs font-normal text-slate-500">
                          {parseTs(b.startAt).toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "short" })}
                        </span>
                      )}
                      {formatTime(b.startAt)} – {formatTime(b.endAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0d2a7a]">{b.roomName}</p>
                      <p className="text-xs text-slate-500">{b.floor}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bookings/${b.id}`} className="font-semibold hover:underline">
                        {b.title}
                      </Link>
                      {b.agenda && <p className="text-xs text-slate-500">{b.agenda}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {b.bookingNo} · {b.typeName ?? "-"} · {b.participantCount} peserta
                      </p>
                      {b.cancellationReason && <p className="mt-1 text-xs text-rose-600">Alasan: {b.cancellationReason}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{b.organizer}</p>
                      <p className="text-xs text-slate-500">{b.department ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusButtons id={b.id} transitions={transitions} returnTo={returnTo} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          total={result.total}
          page={result.page}
          pages={result.pages}
          size={result.size}
          pathname="/admin"
          query={{ view: keep.view, date: keep.date, q: keep.q }}
        />
      </Card>
    </>
  );
}
