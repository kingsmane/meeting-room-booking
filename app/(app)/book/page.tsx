import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { can, requirePermission } from "@/lib/auth";
import { getBookingFormOptions } from "@/lib/data";
import { isDateString, todayJakarta } from "@/lib/booking";
import { BookingForm } from "./booking-form";

export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense fallback={<p className="text-slate-500">Memuat form…</p>}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Loader({ searchParams }: { searchParams: PageProps<"/book">["searchParams"] }) {
  const user = await requirePermission("booking.create", "booking.manage");
  const params = await searchParams;
  await connection(); // tanggal default = hari ini, berbeda tiap request
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const other = params.as === "other" && can(user, "booking.manage");
  const options = await getBookingFormOptions(user, true);

  return (
    <>
      <header>
        <h1 className="text-2xl font-black">{other ? "Booking atas Nama Orang Lain" : "Booking Baru"}</h1>
        <p className="text-slate-600">
          Bentrok jadwal dicegah langsung oleh database. Tipe rapat yang butuh persetujuan akan berstatus Menunggu.
        </p>
        {can(user, "booking.manage") && can(user, "booking.create") && (
          <Link
            href={other ? "/book" : "/book?as=other"}
            className="mt-2 inline-block text-sm font-semibold text-[#0d2a7a] hover:underline"
          >
            {other ? "← Buat untuk diri sendiri" : "Buat atas nama orang lain →"}
          </Link>
        )}
      </header>
      <BookingForm
        key={other ? "other" : "self"}
        options={options}
        defaultDate={isDateString(rawDate) ? rawDate : todayJakarta()}
        mode={other ? "other" : "self"}
        selfMemberId={user.memberId}
      />
    </>
  );
}
