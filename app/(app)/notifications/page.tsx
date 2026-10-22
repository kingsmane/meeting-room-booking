import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data";
import { parseTs, TZ } from "@/lib/booking";
import { fetchPage, parsePaging } from "@/lib/pagination";
import { Pagination } from "@/components/pagination";
import { Card, PageHeader } from "@/components/ui";
import { markNotificationsRead } from "../actions";

export default function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat notifikasi…</p>}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/notifications">["searchParams"] }) {
  const user = await requireUser();
  const params = await searchParams;
  const { page, size } = parsePaging(params);
  const result = await fetchPage((limit, offset) => listNotifications(user, { limit, offset }), page, size);
  const unread = result.rows.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Notifikasi"
        description={`${result.total} notifikasi${unread ? `, ${unread} belum dibaca di halaman ini` : ""}.`}
        actions={
          unread > 0 && (
            <form action={markNotificationsRead}>
              <button className="h-9 rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
                Tandai semua dibaca
              </button>
            </form>
          )
        }
      />

      <Card flush>
        {result.rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Belum ada notifikasi.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {result.rows.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.isRead ? "" : "bg-sky-50/60"}`}>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {!n.isRead && <span className="mr-2 inline-block size-2 rounded-full bg-sky-500" />}
                    {n.title}
                  </p>
                  <p className="text-sm text-slate-700">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {parseTs(n.createdAt).toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                    {n.refType === "booking" && n.refId ? (
                      <>
                        {" · "}
                        <Link href={`/bookings/${n.refId}`} className="font-semibold text-[#0d2a7a] hover:underline">
                          Lihat booking
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                {!n.isRead && (
                  <form action={markNotificationsRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="shrink-0 text-xs font-semibold text-slate-500 hover:underline">Tandai dibaca</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination
          total={result.total}
          page={result.page}
          pages={result.pages}
          size={result.size}
          pathname="/notifications"
        />
      </Card>
    </div>
  );
}
