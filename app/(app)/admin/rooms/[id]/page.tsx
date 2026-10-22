import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requirePermission } from "@/lib/auth";
import { getRoom, listFacilities } from "@/lib/data";
import { TZ, parseTs, todayJakarta } from "@/lib/booking";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { cancelBlock, createBlock, updateRoom } from "../../actions";

export default function RoomDetailPage({ params }: PageProps<"/admin/rooms/[id]">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<p className="text-slate-500">Memuat ruangan…</p>}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

const BLOCK_LABEL: Record<string, string> = {
  MAINTENANCE: "Perawatan",
  EVENT: "Acara",
  PRIVATE: "Pribadi",
  OTHER: "Lainnya",
};

const fmt = (s: string) =>
  parseTs(s).toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

async function Detail({ params }: { params: PageProps<"/admin/rooms/[id]">["params"] }) {
  const user = await requirePermission("room.manage");
  const { id: rawId } = await params;
  await connection(); // tanggal default blokir = hari ini
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const [room, facilities] = await Promise.all([getRoom(user.tenantId, id), listFacilities(user.tenantId)]);
  if (!room) notFound();
  const today = todayJakarta();
  const activeBlocks = room.blocks.filter((b) => b.status === "ACTIVE");

  return (
    <>
      <Link href="/admin/rooms" className="text-sm font-semibold text-[#0d2a7a] hover:underline">
        ← Semua ruangan
      </Link>
      <header>
        <h1 className="text-2xl font-black">{room.roomName}</h1>
        <p className="font-mono text-xs text-slate-500">{room.roomCode}</p>
      </header>

      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Detail ruangan</h2>
        <ActionForm action={updateRoom} submitLabel="Simpan" resetOnSuccess={false}>
          <input type="hidden" name="id" value={room.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={`${labelClass} sm:col-span-2`}>
              Nama
              <input name="name" defaultValue={room.roomName} required maxLength={150} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Kapasitas
              <input name="capacity" type="number" min={1} max={1000} defaultValue={room.capacity} required className={fieldClass} />
            </label>
          </div>
          <label className={labelClass}>
            Lantai
            <input name="floor" defaultValue={room.floor ?? ""} maxLength={50} className={fieldClass} />
          </label>
          <label className={labelClass}>
            Deskripsi
            <textarea name="description" defaultValue={room.description ?? ""} rows={2} maxLength={1000} className={fieldClass} />
          </label>
          <fieldset>
            <legend className={labelClass}>Fasilitas</legend>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {facilities
                .filter((f) => f.isActive || room.facilityIds.includes(f.id))
                .map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="facilities" value={f.id} defaultChecked={room.facilityIds.includes(f.id)} />
                    {f.name}
                  </label>
                ))}
              {facilities.length === 0 && <span className="text-sm text-slate-500">Belum ada fasilitas di Data Master.</span>}
            </div>
          </fieldset>
        </ActionForm>
      </section>

      <section className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-lg font-black">Blokir ruangan</h2>
        <p className="text-sm text-slate-600">
          Blokir menahan ruangan pada rentang waktu tertentu (perawatan, acara) dan otomatis ditolak jika bentrok
          dengan booking aktif.
        </p>
        {activeBlocks.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada blokir aktif atau mendatang.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {activeBlocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b>{BLOCK_LABEL[b.blockType] ?? b.blockType}</b> · {b.reason}
                  <span className="block text-xs text-slate-500">
                    {fmt(b.startAt)} → {fmt(b.endAt)}
                  </span>
                </span>
                <form action={cancelBlock}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="roomId" value={room.id} />
                  <button className="text-xs font-semibold text-rose-600 hover:underline">Batalkan blokir</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-100 pt-4">
          <ActionForm action={createBlock} submitLabel="Tambah blokir">
            <input type="hidden" name="roomId" value={room.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Jenis
                <select name="blockType" className={fieldClass}>
                  {Object.entries(BLOCK_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Alasan
                <input name="reason" required maxLength={255} className={fieldClass} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className={labelClass}>
                Mulai (tanggal)
                <input name="startDate" type="date" defaultValue={today} required className={fieldClass} />
              </label>
              <label className={labelClass}>
                Jam mulai
                <input name="startTime" type="time" defaultValue="08:00" required className={fieldClass} />
              </label>
              <label className={labelClass}>
                Selesai (tanggal)
                <input name="endDate" type="date" defaultValue={today} required className={fieldClass} />
              </label>
              <label className={labelClass}>
                Jam selesai
                <input name="endTime" type="time" defaultValue="17:00" required className={fieldClass} />
              </label>
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
