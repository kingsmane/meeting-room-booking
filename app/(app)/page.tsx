import { Suspense } from "react";
import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { countPendingApprovals, listInvitations, listMyBookings } from "@/lib/data";
import { fetchPage, parsePaging } from "@/lib/pagination";
import { BookingList } from "@/components/booking-ui";
import { Pagination } from "@/components/pagination";
import { Card, PageHeader, StatCard } from "@/components/ui";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Memuat…</p>}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const user = await requireUser();
  const params = await searchParams;
  const { page, size } = parsePaging(params);
  const [mine, invites, pending] = await Promise.all([
    fetchPage((limit, offset) => listMyBookings(user, { limit, offset }), page, size),
    listInvitations(user),
    can(user, "booking.approve") ? countPendingApprovals(user) : Promise.resolve(0),
  ]);
  const upcoming = mine.rows.filter((b) => b.status === "APPROVED" || b.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${user.fullName}`}
        description="Ringkasan booking ruang rapat Anda."
        actions={
          can(user, "booking.create") && (
            <Link
              href="/book"
              className="inline-flex h-9 items-center rounded-lg bg-[#0d2a7a] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#0a2160]"
            >
              + Booking Baru
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Booking saya" value={mine.total} icon="calendar" tone="blue" />
        <StatCard label="Aktif / menunggu (halaman ini)" value={upcoming} icon="check" tone="green" />
        <StatCard label="Undangan rapat" value={invites.length} icon="users" tone="amber" />
        {can(user, "booking.approve") && (
          <StatCard label="Perlu persetujuan Anda" value={pending} icon="clock" tone="rose" />
        )}
      </div>

      {pending > 0 && (
        <Link
          href="/admin?view=pending"
          className="block rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          <p className="font-bold text-amber-900">{pending} pengajuan menunggu persetujuan Anda</p>
          <p className="text-sm text-amber-800">Buka untuk menyetujui atau menolak →</p>
        </Link>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card flush title="Booking saya">
          <BookingList rows={mine.rows} empty="Anda belum punya booking. Buat yang pertama lewat tombol di atas." />
          <Pagination
            total={mine.total}
            page={mine.page}
            pages={mine.pages}
            size={mine.size}
            pathname="/"
          />
        </Card>

        <Card flush title="Undangan rapat">
          <BookingList rows={invites} empty="Tidak ada undangan rapat mendatang." />
        </Card>
      </div>
    </div>
  );
}
