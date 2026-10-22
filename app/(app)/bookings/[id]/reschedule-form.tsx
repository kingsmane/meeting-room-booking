"use client";

import { useActionState } from "react";
import { rescheduleBooking, type FormState } from "../../actions";

const field =
  "mt-1 w-full rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]";
const label = "block text-sm font-semibold text-slate-700";

export function RescheduleForm({
  id,
  rooms,
  defaults,
}: {
  id: number;
  rooms: { id: number; name: string; capacity: number }[];
  defaults: { roomId: number; date: string; from: string; to: string };
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(rescheduleBooking, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={`${label} sm:col-span-2`}>
          Ruangan
          <select name="roomId" defaultValue={defaults.roomId} className={field}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (kapasitas {r.capacity})
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Tanggal
          <input name="date" type="date" defaultValue={defaults.date} required className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            Mulai
            <input name="from" type="time" defaultValue={defaults.from} required className={field} />
          </label>
          <label className={label}>
            Selesai
            <input name="to" type="time" defaultValue={defaults.to} required className={field} />
          </label>
        </div>
      </div>
      <button
        disabled={pending}
        className="rounded-md bg-[#0d2a7a] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a2160] disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan Jadwal Baru"}
      </button>
    </form>
  );
}
