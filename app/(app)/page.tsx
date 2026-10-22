import { Suspense } from "react";
import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { countPendingApprovals, listInvitations, listMyBookings } from "@/lib/data";
import { BookingList } from "@/components/booking-ui";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat…</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await requireUser();
  const [mine, invites, pending] = await Promise.all([
    listMyBookings(user),
    listInvitations(user),
    can(user, "booking.approve") ? countPendingApprovals(user) : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Halo, {user.fullName}</h1>
          <p className="text-slate-600">Ringkasan booking ruang rapat Anda.</p>
        </div>
        {can(user, "booking.create") && (
          <Link href="/book" className="rounded-md bg-[#0d2a7a] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a2160]">
            + Booking Baru
          </Link>
        )}
      </header>

      {pending > 0 && (
        <Link
          href="/admin?view=pending"
          className="block rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          <p className="font-bold text-amber-900">{pending} pengajuan menunggu persetujuan Anda</p>
          <p className="text-sm text-amber-800">Buka untuk menyetujui atau menolak →</p>
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-black">Booking saya</h2>
        <BookingList rows={mine} empty="Anda belum punya booking. Buat yang pertama lewat tombol di atas." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-black">Undangan rapat</h2>
        <BookingList rows={invites} empty="Tidak ada undangan rapat mendatang." />
      </section>
    </div>
  );
}
