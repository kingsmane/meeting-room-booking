import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { listAuditLog, listLoginAudit } from "@/lib/data";
import { TZ, parseTs } from "@/lib/booking";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Audit Log</h1>
        <p className="text-slate-600">Jejak perubahan dan percobaan login (100 aktivitas terbaru).</p>
      </header>
      <Suspense fallback={<p className="text-slate-500">Memuat audit…</p>}>
        <Audit />
      </Suspense>
    </div>
  );
}

const at = (s: string) =>
  parseTs(s).toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

async function Audit() {
  const user = await requirePermission("audit.view");
  const [log, logins] = await Promise.all([listAuditLog(user.tenantId, 100), listLoginAudit(user.tenantId, 50)]);

  return (
    <>
      <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Pelaku</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Objek</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {log.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Belum ada aktivitas tercatat.
                </td>
              </tr>
            )}
            {log.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{at(l.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.actor ?? "—"}</td>
                <td className="px-4 py-2 font-semibold">{l.action}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {l.module}/{l.table}
                  {l.recordId ? ` #${l.recordId}` : ""}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{l.ip?.replace(/\/\d+$/, "") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="text-lg font-black">Percobaan login</h2>
      <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Hasil</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logins.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{at(l.at)}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.username ?? "(tidak dikenal)"}</td>
                <td className="px-4 py-2">
                  {l.success ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Berhasil</span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">Gagal · {l.reason}</span>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{l.ip?.replace(/\/\d+$/, "") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
