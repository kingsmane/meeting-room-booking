// Konstanta dan helper murni (tanpa akses database) untuk modul booking.

export const TZ = "Asia/Jakarta";
const TZ_OFFSET = "+07:00"; // WIB tidak memakai DST

export type BookingStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "POSTPONED"
  | "COMPLETED"
  | "NO_SHOW";

export type RoomStatus = "AVAILABLE" | "MAINTENANCE" | "INACTIVE";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  POSTPONED: "Ditunda",
  COMPLETED: "Selesai",
  NO_SHOW: "Tidak Hadir",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  POSTPONED: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-sky-100 text-sky-800",
  NO_SHOW: "bg-purple-100 text-purple-800",
};

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "Tersedia",
  MAINTENANCE: "Perawatan",
  INACTIVE: "Nonaktif",
};

// Transisi status yang diizinkan. Status akhir (REJECTED, CANCELLED, COMPLETED,
// NO_SHOW) tidak punya transisi keluar.
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["POSTPONED", "COMPLETED", "NO_SHOW", "CANCELLED"],
  POSTPONED: ["APPROVED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

// Status yang melepas slot ruangan (reservasi menjadi CANCELLED).
export const RELEASES_SLOT: BookingStatus[] = ["REJECTED", "CANCELLED", "NO_SHOW"];

export const ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  APPROVED: "Setujui",
  REJECTED: "Tolak",
  CANCELLED: "Batalkan",
  POSTPONED: "Tunda",
  COMPLETED: "Selesai",
  NO_SHOW: "Tidak hadir",
  PENDING: "Ajukan",
};

export function isBookingStatus(v: unknown): v is BookingStatus {
  return typeof v === "string" && v in STATUS_LABEL;
}

export function isRoomStatus(v: unknown): v is RoomStatus {
  return typeof v === "string" && v in ROOM_STATUS_LABEL;
}

// Postgres mengembalikan "2026-10-22 02:00:00+00"; JS butuh format ISO penuh.
export function parseTs(s: string): Date {
  return new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
}

export function todayJakarta(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00${TZ_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function isDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function isTimeString(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

// "2026-10-22" + "09:00" (WIB) -> ISO dengan offset, aman dikirim ke timestamptz.
export function toTimestamptz(date: string, time: string): string {
  return `${date}T${time}:00${TZ_OFFSET}`;
}

export function formatTime(s: string): string {
  return parseTs(s).toLocaleTimeString("id-ID", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(".", ":");
}

export function formatDateLong(date: string): string {
  return new Date(`${date}T00:00:00${TZ_OFFSET}`).toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---- Kebijakan akses booking (dipakai UI untuk menampilkan tombol DAN Server Action untuk memvalidasi) ----

export type Actor = { permissions: ReadonlySet<string>; memberId: number };
export type BookingRef = { status: BookingStatus; organizerMemberId: number };

const OWN_CANCELLABLE: BookingStatus[] = ["DRAFT", "PENDING", "APPROVED", "POSTPONED"];
const RESCHEDULABLE: BookingStatus[] = ["PENDING", "APPROVED", "POSTPONED"];

// Aturan: approver tidak boleh menyetujui/menolak pengajuannya sendiri (kecuali pemegang booking.manage);
// pembuat boleh membatalkan miliknya sendiri; perubahan status lain hanya untuk booking.manage.
export function allowedTransitions(actor: Actor, b: BookingRef): BookingStatus[] {
  const own = b.organizerMemberId === actor.memberId;
  const manage = actor.permissions.has("booking.manage");
  const approve = actor.permissions.has("booking.approve");
  return TRANSITIONS[b.status].filter((to) => {
    if (to === "REJECTED" || (to === "APPROVED" && b.status === "PENDING")) {
      return approve && (!own || manage);
    }
    if (to === "CANCELLED") return manage || (own && OWN_CANCELLABLE.includes(b.status));
    return manage;
  });
}

export function canReschedule(actor: Actor, b: BookingRef) {
  const own = b.organizerMemberId === actor.memberId;
  return RESCHEDULABLE.includes(b.status) && (actor.permissions.has("booking.manage") || own);
}

export function canCheckIn(actor: Actor, b: BookingRef) {
  const own = b.organizerMemberId === actor.memberId;
  return b.status === "APPROVED" && (actor.permissions.has("booking.manage") || own);
}

export function canEditParticipants(actor: Actor, b: BookingRef) {
  const own = b.organizerMemberId === actor.memberId;
  return !["REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"].includes(b.status) &&
    (actor.permissions.has("booking.manage") || own);
}

export const CHECKIN_EARLY_MS = 15 * 60 * 1000; // check-in dibuka 15 menit sebelum mulai

// Dipisah dari komponen supaya aturan "tidak boleh memanggil fungsi tidak murni saat render" tidak terpicu;
// hanya dipanggil setelah `await connection()` di halaman yang bergantung pada waktu.
export function nowMs() {
  return Date.now();
}
