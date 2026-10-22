import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="max-w-sm text-center">
        <p className="text-6xl font-black text-slate-300">403</p>
        <h1 className="mt-2 text-xl font-black text-slate-900">Akses ditolak</h1>
        <p className="mt-1 text-slate-600">Akun Anda tidak memiliki izin untuk membuka halaman ini.</p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-[#0d2a7a] px-4 py-2 text-sm font-bold text-white">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
