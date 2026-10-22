export default function DisplayIndex() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1931] p-6 text-center text-white">
      <div className="max-w-md">
        <h1 className="text-2xl font-black">Layar Jadwal Rapat</h1>
        <p className="mt-2 text-white/70">
          Alamat layar bersifat khusus per tenant dan memakai token. Administrator dapat menyalinnya di
          Pengaturan → Layar TV.
        </p>
      </div>
    </div>
  );
}
