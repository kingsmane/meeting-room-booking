import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { listDepartments, listFacilities, listLocations, listMeetingTypes } from "@/lib/data";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { addMaster, toggleMaster } from "../actions";

export default function MasterPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Data Master</h1>
        <p className="text-slate-600">
          Data yang sudah dipakai tidak dihapus, tetapi dinonaktifkan agar riwayat booking tetap utuh.
        </p>
      </header>
      <Suspense fallback={<p className="text-slate-500">Memuat data master…</p>}>
        <Master />
      </Suspense>
    </div>
  );
}

type Item = { id: number; code: string; name: string; isActive: boolean; requireApproval?: boolean };

function Section({
  title,
  entity,
  items,
  withApproval,
}: {
  title: string;
  entity: "department" | "type" | "facility" | "location";
  items: Item[];
  withApproval?: boolean;
}) {
  return (
    <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
      <h2 className="mb-3 text-lg font-black">{title}</h2>
      <ul className="mb-4 divide-y divide-slate-100 text-sm">
        {items.length === 0 && <li className="py-2 text-slate-500">Belum ada data.</li>}
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={i.isActive ? "" : "text-slate-400 line-through"}>
              <span className="mr-2 font-mono text-xs text-slate-500">{i.code}</span>
              {i.name}
              {withApproval && i.requireApproval && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-800">
                  PERLU PERSETUJUAN
                </span>
              )}
            </span>
            <span className="flex gap-3">
              {withApproval && (
                <form action={toggleMaster}>
                  <input type="hidden" name="entity" value={entity} />
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="field" value="approval" />
                  <button className="text-xs font-semibold text-slate-600 hover:underline">
                    {i.requireApproval ? "Tanpa persetujuan" : "Wajib persetujuan"}
                  </button>
                </form>
              )}
              <form action={toggleMaster}>
                <input type="hidden" name="entity" value={entity} />
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="field" value="active" />
                <button className="text-xs font-semibold text-[#0d2a7a] hover:underline">
                  {i.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
      <ActionForm action={addMaster} submitLabel="Tambah" className="grid items-end gap-3 sm:grid-cols-[8rem_1fr_auto_auto]">
        <input type="hidden" name="entity" value={entity} />
        <label className={labelClass}>
          Kode
          <input name="code" required maxLength={20} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Nama
          <input name="name" required maxLength={150} className={fieldClass} />
        </label>
        {withApproval ? (
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="requireApproval" /> Perlu persetujuan
          </label>
        ) : (
          <span />
        )}
      </ActionForm>
    </section>
  );
}

async function Master() {
  const user = await requirePermission("master.manage");
  const [departments, types, facilities, locations] = await Promise.all([
    listDepartments(user.tenantId),
    listMeetingTypes(user.tenantId),
    listFacilities(user.tenantId),
    listLocations(user.tenantId),
  ]);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Tipe rapat" entity="type" items={types} withApproval />
      <Section title="Departemen" entity="department" items={departments} />
      <Section title="Fasilitas ruangan" entity="facility" items={facilities} />
      <Section title="Lokasi" entity="location" items={locations} />
    </div>
  );
}
