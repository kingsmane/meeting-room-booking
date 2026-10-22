import { Suspense } from "react";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth";
import { listLocations } from "@/lib/data";
import { DISPLAY_LIMITS, getSettings } from "@/lib/settings";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { regenerateDisplayToken, saveAnnouncements, saveDisplay } from "../actions";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-black">Pengaturan</h1>
        <p className="text-slate-600">Pengumuman, perilaku layar TV, dan alamat akses layar.</p>
      </header>
      <Suspense fallback={<p className="text-slate-500">Memuat pengaturan…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const user = await requirePermission("settings.manage");
  const [settings, locations] = await Promise.all([getSettings(user.tenantId), listLocations(user.tenantId)]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}/display/${encodeURIComponent(user.tenantCode)}`;
  const d = settings.display;

  return (
    <>
      <section className="space-y-3 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="text-lg font-black">Alamat layar TV</h2>
        <p className="text-sm text-slate-600">
          Layar tidak memakai login; aksesnya dijaga token pada alamat. Perlakukan alamat ini seperti password.
          Jika bocor, buat token baru, lalu perbarui alamat di semua layar.
        </p>
        {settings.displayToken ? (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Semua lokasi</p>
            <input
              readOnly
              value={`${base}?key=${settings.displayToken}`}
              className="w-full rounded-md bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-slate-300"
            />
            {locations.filter((l) => l.isActive).length > 1 &&
              locations
                .filter((l) => l.isActive)
                .map((l) => (
                  <div key={l.id}>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hanya {l.name}</p>
                    <input
                      readOnly
                      value={`${base}?key=${settings.displayToken}&location=${encodeURIComponent(l.code)}`}
                      className="w-full rounded-md bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-slate-300"
                    />
                  </div>
                ))}
          </>
        ) : (
          <p className="text-sm font-semibold text-amber-700">Belum ada token. Buat token untuk mengaktifkan layar.</p>
        )}
        <form action={regenerateDisplayToken}>
          <button className="rounded-md bg-white px-3 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50">
            {settings.displayToken ? "Buat token baru (alamat lama berhenti bekerja)" : "Buat token"}
          </button>
        </form>
      </section>

      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Pengumuman</h2>
        <ActionForm action={saveAnnouncements} submitLabel="Simpan pengumuman" resetOnSuccess={false}>
          <label className={labelClass}>
            Satu pengumuman per baris (maksimal 10, @200 karakter)
            <textarea
              name="announcements"
              rows={5}
              defaultValue={settings.announcements.join("\n")}
              className={fieldClass}
            />
          </label>
        </ActionForm>
      </section>

      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Perilaku layar</h2>
        <ActionForm action={saveDisplay} submitLabel="Simpan" resetOnSuccess={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              “Segera dimulai” (menit sebelum mulai)
              <input name="soonMinutes" type="number" required defaultValue={d.soonMinutes} min={DISPLAY_LIMITS.soonMinutes[0]} max={DISPLAY_LIMITS.soonMinutes[1]} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Baris per halaman
              <input name="pageSize" type="number" required defaultValue={d.pageSize} min={DISPLAY_LIMITS.pageSize[0]} max={DISPLAY_LIMITS.pageSize[1]} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Ganti halaman tiap (detik)
              <input name="rotateSeconds" type="number" required defaultValue={d.rotateSeconds} min={DISPLAY_LIMITS.rotateSeconds[0]} max={DISPLAY_LIMITS.rotateSeconds[1]} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Muat ulang data tiap (detik)
              <input name="refreshSeconds" type="number" required defaultValue={d.refreshSeconds} min={DISPLAY_LIMITS.refreshSeconds[0]} max={DISPLAY_LIMITS.refreshSeconds[1]} className={fieldClass} />
            </label>
          </div>
        </ActionForm>
      </section>
    </>
  );
}
