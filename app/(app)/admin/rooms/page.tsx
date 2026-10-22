import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listLocations, listRooms } from "@/lib/data";
import { ROOM_STATUS_LABEL, type RoomStatus } from "@/lib/booking";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { createRoom, setRoomStatus } from "../actions";

export default function RoomsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Ruangan</h1>
        <p className="text-slate-600">
          Ruangan berstatus Perawatan atau Nonaktif tidak muncul di pilihan booking baru.
        </p>
      </header>
      <Suspense fallback={<p className="text-slate-500">Memuat ruangan…</p>}>
        <Rooms />
      </Suspense>
    </div>
  );
}

const STATUS_STYLE: Record<RoomStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  INACTIVE: "bg-slate-200 text-slate-600",
};

async function Rooms() {
  const user = await requirePermission("room.manage");
  const [rooms, locations] = await Promise.all([listRooms(user.tenantId), listLocations(user.tenantId)]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Ruangan</th>
              <th className="px-4 py-3">Kapasitas</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ubah status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.map((r) => {
              const status = r.status as RoomStatus;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs">{r.roomCode}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/rooms/${r.id}`} className="font-semibold text-[#0d2a7a] hover:underline">
                      {r.roomName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {r.floor ?? "-"} · {r.locationName}
                    </p>
                    {r.facilities.length > 0 && <p className="text-xs text-slate-400">{r.facilities.join(", ")}</p>}
                  </td>
                  <td className="px-4 py-3">{r.capacity} orang</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
                      {ROOM_STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(ROOM_STATUS_LABEL) as RoomStatus[])
                        .filter((s) => s !== status)
                        .map((to) => (
                          <form key={to} action={setRoomStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="to" value={to} />
                            <button className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold ring-1 ring-slate-300 hover:bg-slate-100">
                              {ROOM_STATUS_LABEL[to]}
                            </button>
                          </form>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="h-fit rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Tambah Ruangan</h2>
        <ActionForm action={createRoom} submitLabel="Tambah">
          <label className={labelClass}>
            Kode
            <input name="code" required maxLength={20} placeholder="MIS: PLM" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Nama ruangan
            <input name="name" required maxLength={150} className={fieldClass} />
          </label>
          <label className={labelClass}>
            Lantai
            <input name="floor" maxLength={50} placeholder="Lantai 1" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Kapasitas
            <input name="capacity" type="number" min={1} max={1000} defaultValue={6} required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Lokasi
            <select name="locationId" required className={fieldClass}>
              {locations
                .filter((l) => l.isActive)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
