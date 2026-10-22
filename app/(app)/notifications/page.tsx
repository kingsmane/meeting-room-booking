import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data";
import { parseTs, TZ } from "@/lib/booking";
import { markNotificationsRead } from "../actions";

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Suspense fallback={<p className="text-slate-500">Memuat notifikasi…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireUser();
  const items = await listNotifications(user);
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Notifikasi</h1>
          <p className="text-slate-600">{unread} belum dibaca.</p>
        </div>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button className="rounded-md bg-white px-3 py-2 text-sm font-semibold ring-1 ring-slate-300 hover:bg-slate-100">
              Tandai semua dibaca
            </button>
          </form>
        )}
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Belum ada notifikasi.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.isRead ? "" : "bg-sky-50"}`}>
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
    </>
  );
}
