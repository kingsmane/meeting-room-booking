import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { can, requireUser } from "@/lib/auth";
import { listBookings, listPendingBookings } from "@/lib/data";
import {
  addDays,
  allowedTransitions,
  formatDateLong,
  formatTime,
  isDateString,
  todayJakarta,
  type BookingStatus,
} from "@/lib/booking";
import { StatusBadge, StatusButtons } from "@/components/booking-ui";

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat jadwal…</p>}>
      <Schedule searchParams={searchParams} />
    </Suspense>
  );
}

const navBtn = "rounded-md bg-white px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-100";

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

  const bookings = pendingView ? await listPendingBookings(user) : await listBookings(user, date);
  const returnTo = pendingView ? "/admin?view=pending" : `/admin?date=${date}`;

  const count = (s: BookingStatus) => bookings.filter((b) => b.status === s).length;
  const stats = [
    { label: pendingView ? "Menunggu persetujuan" : "Total rapat", value: bookings.length },
    { label: "Disetujui", value: count("APPROVED") },
    { label: "Menunggu persetujuan", value: count("PENDING") },
    { label: "Ditunda / dibatalkan", value: count("POSTPONED") + count("CANCELLED") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">{pendingView ? "Menunggu Persetujuan" : "Jadwal Booking"}</h1>
          <p className="text-slate-600">
            {pendingView ? (
              "Semua pengajuan yang belum diputuskan."
            ) : (
              <>
                {formatDateLong(date)}
                {date === today && (
                  <span className="ml-2 rounded bg-yellow-300 px-1.5 py-0.5 text-xs font-bold text-slate-900">
                    HARI INI
                  </span>
                )}
              </>
            )}
            {user.bookingScope !== "ALL" && (
              <span className="ml-2 text-xs text-slate-500">
                (cakupan: {user.bookingScope === "DEPARTMENT" ? "departemen Anda" : "milik Anda"})
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin?view=pending" className={navBtn}>
            Menunggu persetujuan
          </Link>
          {!pendingView ? (
            <>
              <Link href={`/admin?date=${addDays(date, -1)}`} className={navBtn}>
                ← Sebelumnya
              </Link>
              <Link href="/admin" className={navBtn}>
                Hari ini
              </Link>
              <Link href={`/admin?date=${addDays(date, 1)}`} className={navBtn}>
                Berikutnya →
              </Link>
              <form className="flex gap-2">
                <input type="date" name="date" defaultValue={date} className="rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-300" />
                <button className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900">
                  Lihat
                </button>
              </form>
            </>
          ) : (
            <Link href="/admin" className={navBtn}>
              Jadwal harian
            </Link>
          )}
          {can(user, "booking.manage") && (
            <Link
              href={`/book?as=other&date=${date}`}
              className="rounded-md bg-[#0d2a7a] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a2160]"
            >
              + Booking Baru
            </Link>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-sm text-slate-600">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Ruangan</th>
              <th className="px-4 py-3">Rapat</th>
              <th className="px-4 py-3">Penyelenggara</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {pendingView ? "Tidak ada pengajuan yang menunggu." : "Belum ada booking pada tanggal ini."}
                </td>
              </tr>
            )}
            {bookings.map((b) => {
              const status = b.status as BookingStatus;
              const transitions = allowedTransitions(user, { status, organizerMemberId: b.organizerMemberId });
              return (
                <tr key={b.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-bold">
                    {pendingView && (
                      <span className="block text-xs font-normal text-slate-500">
                        {new Date(b.startAt.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toLocaleDateString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          day: "numeric",
                          month: "short",
                        })}
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
      </section>
    </div>
  );
}
