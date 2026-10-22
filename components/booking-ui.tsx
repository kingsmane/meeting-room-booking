import Link from "next/link";
import { changeBookingStatus } from "@/app/(app)/actions";
import {
  ACTION_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  formatTime,
  type BookingStatus,
} from "@/lib/booking";

export function StatusBadge({ status }: { status: string }) {
  const s = status as BookingStatus;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[s] ?? "bg-slate-100"}`}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

const BUTTON_STYLE: Partial<Record<BookingStatus, string>> = {
  APPROVED: "bg-emerald-600 text-white hover:bg-emerald-700",
  REJECTED: "bg-rose-600 text-white hover:bg-rose-700",
  CANCELLED: "bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50",
  POSTPONED: "bg-white text-orange-700 ring-1 ring-orange-300 hover:bg-orange-50",
  COMPLETED: "bg-sky-600 text-white hover:bg-sky-700",
  NO_SHOW: "bg-white text-purple-700 ring-1 ring-purple-300 hover:bg-purple-50",
};

// Tombol aksi cepat. `transitions` sudah difilter oleh allowedTransitions(); action tetap memvalidasi ulang di server.
export function StatusButtons({
  id,
  transitions,
  returnTo,
}: {
  id: number;
  transitions: BookingStatus[];
  returnTo: string;
}) {
  if (transitions.length === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {transitions.map((to) => (
        <form key={to} action={changeBookingStatus}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${BUTTON_STYLE[to] ?? "bg-slate-700 text-white"}`}>
            {ACTION_LABEL[to] ?? to}
          </button>
        </form>
      ))}
    </div>
  );
}

type Row = {
  id: number;
  title: string;
  agenda: string | null;
  startAt: string;
  endAt: string;
  status: string;
  roomName: string;
  floor: string | null;
  organizer: string;
  bookingNo: string;
};

// Daftar ringkas booking (dipakai beranda). Menampilkan tanggal karena rentangnya lebih dari satu hari.
export function BookingList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
      {rows.map((b) => (
        <li key={b.id}>
          <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.title}</p>
              <p className="text-xs text-slate-500">
                {dateShort(b.startAt)} · {formatTime(b.startAt)}–{formatTime(b.endAt)} · {b.roomName}
                {b.floor ? ` (${b.floor})` : ""}
              </p>
            </div>
            <StatusBadge status={b.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function dateShort(s: string) {
  return new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
