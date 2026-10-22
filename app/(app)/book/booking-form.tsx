"use client";

import { useActionState, useState } from "react";
import { createBookingFor, createMyBooking, type FormState } from "../actions";

type Options = {
  rooms: { id: number; name: string; floor: string | null; capacity: number; facilities: string[] }[];
  members: { id: number; name: string; department: string | null }[];
  types: { id: number; name: string; requireApproval: boolean }[];
};

const field =
  "mt-1 w-full rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]";
const label = "block text-sm font-semibold text-slate-700";

export function BookingForm({
  options,
  defaultDate,
  mode,
  selfMemberId,
}: {
  options: Options;
  defaultDate: string;
  mode: "self" | "other";
  selfMemberId: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "other" ? createBookingFor : createMyBooking,
    {},
  );
  const [roomId, setRoomId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [repeat, setRepeat] = useState("none");

  const room = options.rooms.find((r) => String(r.id) === roomId);
  const type = options.types.find((t) => String(t.id) === typeId);

  return (
    <form action={formAction} className="space-y-4 rounded-lg bg-white p-5 ring-1 ring-slate-200">
      {state.error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      )}

      <label className={label}>
        Judul rapat
        <input name="title" required maxLength={255} className={field} />
      </label>

      <label className={label}>
        Agenda / subtopik
        <textarea name="agenda" rows={2} maxLength={2000} className={field} />
      </label>

      {mode === "other" && (
        <label className={label}>
          Penyelenggara
          <select name="memberId" required defaultValue="" className={field}>
            <option value="" disabled>
              Pilih penyelenggara
            </option>
            {options.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.department ? `· ${m.department}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Ruangan
          <select
            name="roomId"
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className={field}
          >
            <option value="" disabled>
              Pilih ruangan
            </option>
            {options.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.floor ?? "-"}, kapasitas {r.capacity})
              </option>
            ))}
          </select>
          {room && (
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Fasilitas: {room.facilities.length ? room.facilities.join(", ") : "—"}
            </span>
          )}
        </label>
        <label className={label}>
          Tipe rapat
          <select
            name="typeId"
            required
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className={field}
          >
            <option value="" disabled>
              Pilih tipe
            </option>
            {options.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {type?.requireApproval && (
            <span className="mt-1 block text-xs font-normal text-amber-700">
              Tipe ini perlu persetujuan; booking akan berstatus Menunggu.
            </span>
          )}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <label className={`${label} sm:col-span-1`}>
          Tanggal
          <input name="date" type="date" defaultValue={defaultDate} required className={field} />
        </label>
        <label className={label}>
          Mulai
          <input name="from" type="time" defaultValue="09:00" required className={field} />
        </label>
        <label className={label}>
          Selesai
          <input name="to" type="time" defaultValue="10:00" required className={field} />
        </label>
        <label className={label}>
          Peserta
          <input
            name="pax"
            type="number"
            min={1}
            max={room?.capacity}
            defaultValue={2}
            required
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Pengulangan
          <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={field}>
            <option value="none">Tidak berulang</option>
            <option value="weekly">Setiap minggu</option>
          </select>
        </label>
        {repeat === "weekly" && (
          <label className={label}>
            Jumlah pertemuan (termasuk yang pertama)
            <input name="repeatCount" type="number" min={2} max={12} defaultValue={4} className={field} />
          </label>
        )}
      </div>

      <fieldset>
        <legend className={label}>Undang peserta (opsional)</legend>
        <div className="mt-1 grid max-h-44 gap-1 overflow-y-auto rounded-md p-2 ring-1 ring-slate-300 sm:grid-cols-2">
          {options.members
            .filter((m) => m.id !== selfMemberId)
            .map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="participants" value={m.id} />
                <span className="truncate">
                  {m.name}
                  {m.department ? <span className="text-slate-400"> · {m.department}</span> : null}
                </span>
              </label>
            ))}
        </div>
      </fieldset>

      <button
        disabled={pending}
        className="rounded-md bg-[#0d2a7a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0a2160] disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan Booking"}
      </button>
    </form>
  );
}
