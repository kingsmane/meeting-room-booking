import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { listAuditLog, listLoginAudit } from "@/lib/data";
import { TZ, parseTs } from "@/lib/booking";
import { fetchPage, parsePaging } from "@/lib/pagination";
import { Pagination } from "@/components/pagination";
import { Card, EmptyRow, PageHeader, th } from "@/components/ui";

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat audit…</p>}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

const at = (s: string) =>
  parseTs(s).toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const user = await requirePermission("audit.view");
  const params = await searchParams;
  // Dua tabel punya penomoran halaman sendiri; ukuran halaman dipakai bersama.
  const { page, size } = parsePaging(params);
  const { page: lpage } = parsePaging(params, { pageKey: "lpage" });
  const [log, logins] = await Promise.all([
    fetchPage((limit, offset) => listAuditLog(user.tenantId, { limit, offset }), page, size),
    fetchPage((limit, offset) => listLoginAudit(user.tenantId, { limit, offset }), lpage, size),
  ]);
  const sizeQ = size === 10 ? undefined : String(size);

  return (
    <>
      <PageHeader title="Audit Log" description="Jejak perubahan data dan percobaan login." />

      <Card flush title="Aktivitas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Waktu</th>
                <th className={th}>Pelaku</th>
                <th className={th}>Aksi</th>
                <th className={th}>Objek</th>
                <th className={th}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.rows.length === 0 && <EmptyRow colSpan={5}>Belum ada aktivitas tercatat.</EmptyRow>}
              {log.rows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
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
        </div>
        <Pagination
          total={log.total}
          page={log.page}
          pages={log.pages}
          size={log.size}
          pathname="/admin/audit"
          query={{ lpage: logins.page > 1 ? String(logins.page) : undefined }}
        />
      </Card>

      <Card flush title="Percobaan login">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Waktu</th>
                <th className={th}>Username</th>
                <th className={th}>Hasil</th>
                <th className={th}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logins.rows.length === 0 && <EmptyRow colSpan={4}>Belum ada percobaan login.</EmptyRow>}
              {logins.rows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/60">
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
        </div>
        <Pagination
          total={logins.total}
          page={logins.page}
          pages={logins.pages}
          size={logins.size}
          pathname="/admin/audit"
          pageKey="lpage"
          query={{ page: log.page > 1 ? String(log.page) : undefined, size: sizeQ }}
        />
      </Card>
    </>
  );
}
