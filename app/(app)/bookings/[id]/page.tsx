import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { can, requireUser, type SessionUser } from "@/lib/auth";
import { getBooking, getBookingExtras, getBookingFormOptions, listMembersLite } from "@/lib/data";
import {
  CHECKIN_EARLY_MS,
  STATUS_LABEL,
  TZ,
  allowedTransitions,
  canCheckIn,
  canEditParticipants,
  canReschedule,
  formatDateLong,
  formatTime,
  nowMs,
  parseTs,
  ACTION_LABEL,
  type BookingStatus,
} from "@/lib/booking";
import { StatusBadge } from "@/components/booking-ui";
import { addParticipant, changeBookingStatus, checkIn, checkOut, removeParticipant } from "../../actions";
import { RescheduleForm } from "./reschedule-form";

export default function BookingDetailPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<p className="text-slate-500">Memuat booking…</p>}>
        <Detail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const dateTime = (s: string) =>
  parseTs(s).toLocaleString("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const btn = "rounded-md px-3 py-1.5 text-xs font-bold";
const input =
  "rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]";

async function Detail({
  params,
  searchParams,
}: {
  params: PageProps<"/bookings/[id]">["params"];
  searchParams: PageProps<"/bookings/[id]">["searchParams"];
}) {
  const user: SessionUser = await requireUser();
  const { id: rawId } = await params;
  const query = await searchParams;
  await connection(); // jendela check-in bergantung pada jam sekarang
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const booking = await getBooking(user, id);
  if (!booking) notFound();

  const status = booking.status as BookingStatus;
  const ref = { status, organizerMemberId: booking.organizerMemberId };
  const transitions = allowedTransitions(user, ref);
  const extras = await getBookingExtras(user.tenantId, id);
  const err = Array.isArray(query.err) ? query.err[0] : query.err;

  const mayCheckIn = canCheckIn(user, ref);
  const start = parseTs(booking.startAt).getTime();
  const end = parseTs(booking.endAt).getTime();
  const now = nowMs();
  const windowOpen = now >= start - CHECKIN_EARLY_MS && now <= end;
  const myOpenCheckin = extras.checkins.some((c) => c.memberId === user.memberId && !c.checkoutAt);

  const mayReschedule = canReschedule(user, ref);
  const mayEditParticipants = canEditParticipants(user, ref);
  const [options, members] = await Promise.all([
    mayReschedule ? getBookingFormOptions(user, false) : Promise.resolve(null),
    mayEditParticipants ? listMembersLite(user.tenantId) : Promise.resolve([]),
  ]);
  const existing = new Set(extras.participants.map((p) => p.memberId));
  const dateKey = parseTs(booking.startAt).toLocaleDateString("en-CA", { timeZone: TZ });

  return (
    <>
      <Link href={can(user, "booking.manage") || can(user, "booking.approve") ? "/admin" : "/"} className="text-sm font-semibold text-[#0d2a7a] hover:underline">
        ← Kembali
      </Link>

      {err && (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {err}
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">{booking.title}</h1>
          <p className="text-sm text-slate-500">
            {booking.bookingNo}
            {booking.seriesId ? " · bagian dari rapat berulang" : ""}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </header>

      <section className="grid gap-4 rounded-lg bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2">
        <Info label="Waktu">
          {formatDateLong(dateKey)}
          <br />
          <b>
            {formatTime(booking.startAt)} – {formatTime(booking.endAt)} WIB
          </b>
        </Info>
        <Info label="Ruangan">
          <b>{booking.roomName}</b>
          <br />
          {booking.floor ?? "-"}
        </Info>
        <Info label="Penyelenggara">
          <b>{booking.organizer}</b>
          <br />
          {booking.department ?? "-"}
        </Info>
        <Info label="Tipe / jumlah peserta">
          {booking.typeName ?? "-"} · {booking.participantCount} orang
        </Info>
        {booking.agenda && (
          <div className="sm:col-span-2">
            <Info label="Agenda">{booking.agenda}</Info>
          </div>
        )}
        {booking.cancellationReason && (
          <div className="sm:col-span-2">
            <Info label="Alasan">
              <span className="text-rose-700">{booking.cancellationReason}</span>
            </Info>
          </div>
        )}
      </section>

      {transitions.length > 0 && (
        <section className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-black">Ubah status</h2>
          <form action={changeBookingStatus} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={`/bookings/${id}`} />
            <input name="reason" maxLength={500} placeholder="Alasan / catatan (opsional)" className={`${input} min-w-0 flex-1`} />
            {transitions.map((to) => (
              <button
                key={to}
                name="to"
                value={to}
                className={`${btn} ${
                  to === "APPROVED" || to === "COMPLETED"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : to === "REJECTED"
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : "bg-white ring-1 ring-slate-300 hover:bg-slate-100"
                }`}
              >
                {ACTION_LABEL[to] ?? STATUS_LABEL[to]}
              </button>
            ))}
          </form>
        </section>
      )}

      {mayCheckIn && (
        <section className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-black">Check-in</h2>
          {extras.checkins.length > 0 && (
            <ul className="text-sm text-slate-700">
              {extras.checkins.map((c) => (
                <li key={c.id}>
                  {c.who ?? "—"}: masuk {dateTime(c.checkinAt)}
                  {c.checkoutAt ? `, keluar ${dateTime(c.checkoutAt)}` : ""}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            {!myOpenCheckin ? (
              <form action={checkIn}>
                <input type="hidden" name="id" value={id} />
                <button disabled={!windowOpen} className={`${btn} bg-[#0d2a7a] text-white disabled:opacity-40`}>
                  Check-in
                </button>
              </form>
            ) : (
              <form action={checkOut}>
                <input type="hidden" name="id" value={id} />
                <button className={`${btn} bg-slate-700 text-white`}>Check-out</button>
              </form>
            )}
          </div>
          {!windowOpen && !myOpenCheckin && (
            <p className="text-xs text-slate-500">Check-in dibuka 15 menit sebelum rapat sampai rapat selesai.</p>
          )}
        </section>
      )}

      {mayReschedule && options && (
        <details className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <summary className="cursor-pointer font-black">Jadwalkan ulang</summary>
          <div className="mt-3">
            <RescheduleForm
              id={id}
              rooms={options.rooms}
              defaults={{
                roomId: booking.roomId,
                date: dateKey,
                from: formatTime(booking.startAt),
                to: formatTime(booking.endAt),
              }}
            />
          </div>
        </details>
      )}

      <section className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-black">Peserta ({extras.participants.length})</h2>
        {extras.participants.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada peserta yang diundang.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {extras.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  <b>{p.name}</b>
                  {p.email ? <span className="text-slate-500"> · {p.email}</span> : null}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-slate-600">
                    {p.type === "EXTERNAL" ? "Eksternal" : "Internal"}
                  </span>
                </span>
                {mayEditParticipants && (
                  <form action={removeParticipant}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="participantId" value={p.id} />
                    <button className="text-xs font-semibold text-rose-600 hover:underline">Hapus</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {mayEditParticipants && (
          <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
            <form action={addParticipant} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Undang anggota</p>
              <select name="memberId" required defaultValue="" className={`${input} w-full`}>
                <option value="" disabled>
                  Pilih anggota
                </option>
                {members
                  .filter((m) => m.id !== booking.organizerMemberId && !existing.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.department ? `· ${m.department}` : ""}
                    </option>
                  ))}
              </select>
              <button className={`${btn} bg-[#0d2a7a] text-white`}>Undang</button>
            </form>
            <form action={addParticipant} className="space-y-2">
              <input type="hidden" name="id" value={id} />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tamu eksternal</p>
              <input name="name" required maxLength={150} placeholder="Nama" className={`${input} w-full`} />
              <input name="email" type="email" maxLength={150} placeholder="Email (opsional)" className={`${input} w-full`} />
              <button className={`${btn} bg-[#0d2a7a] text-white`}>Tambah tamu</button>
            </form>
          </div>
        )}
      </section>

      {extras.approvals.length > 0 && (
        <section className="space-y-2 rounded-lg bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-black">Persetujuan</h2>
          <ul className="text-sm">
            {extras.approvals.map((a) => (
              <li key={a.id}>
                <b>{a.approver}</b>: <StatusBadge status={a.status} />
                {a.actedAt ? <span className="text-slate-500"> · {dateTime(a.actedAt)}</span> : null}
                {a.remarks ? <span className="text-slate-600"> · {a.remarks}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-black">Riwayat</h2>
        <ol className="space-y-2 text-sm">
          {extras.history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-x-2">
              <span className="w-28 shrink-0 text-xs text-slate-500">{dateTime(h.changedAt)}</span>
              {h.oldStatus && (
                <>
                  <StatusBadge status={h.oldStatus} />
                  <span className="text-slate-400">→</span>
                </>
              )}
              <StatusBadge status={h.newStatus} />
              <span className="text-slate-600">
                {h.reason ? `${h.reason} · ` : ""}
                {h.changedBy ?? "sistem"}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}
