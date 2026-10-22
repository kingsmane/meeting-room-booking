# Meeting Room Booking

Sistem booking ruang rapat multi-tenant dengan layar jadwal untuk TV. Next.js 16 (App Router, Cache
Components), React 19, Tailwind 4, Drizzle ORM, Postgres di Neon.

> Next.js versi ini berbeda dari yang umum dikenal. Baca `node_modules/next/dist/docs/` sebelum mengubah
> kode Next.js (lihat `AGENTS.md`).

## Menjalankan

```bash
npm install
# .env.local harus berisi DATABASE_URL (Neon) dan SESSION_SECRET (>= 32 karakter acak)
npm run db:migrate      # menambah kolom iam_user.password_hash (idempotent)
npm run db:seed         # data demo tenant DEMO (atau db:seed:reset untuk mengisi ulang dari nol)
npm run dev
```

Akun demo (password semua: `Demo@2026`):

| Username | Peran | Cakupan booking |
|---|---|---|
| `demo.admin` | Administrator | Semua fitur |
| `demo.ga` | Staf GA | Semua booking, ruangan, data master |
| `demo.mgmt` | Approver | Semua booking, menyetujui/menolak |
| `demo.sarah`, `demo.dimas` | Kepala Departemen | Booking departemennya, menyetujui |
| `demo.budi`, `demo.maya`, … | Karyawan | Hanya miliknya |

Alamat layar TV dicetak oleh seed dan tersedia di Pengaturan: `/display/DEMO?key=<token>[&location=HQ]`.

## Peta aplikasi

| Rute | Untuk | Izin |
|---|---|---|
| `/login` | Semua | – |
| `/` Beranda, `/book`, `/notifications`, `/account` | Pengguna login | `booking.create` untuk `/book` |
| `/bookings/[id]` | Detail, status, jadwal ulang, peserta, check-in | sesuai scope `booking.view` |
| `/admin` | Jadwal harian dan antrean persetujuan | `booking.manage`/`booking.approve`/scope ≥ DEPARTMENT |
| `/admin/rooms`, `/admin/rooms/[id]` | Ruangan, fasilitas, blokir | `room.manage` |
| `/admin/master` | Tipe rapat, departemen, fasilitas, lokasi | `master.manage` |
| `/admin/users` | Pengguna dan peran | `user.manage` |
| `/admin/settings` | Pengumuman, perilaku dan token layar TV | `settings.manage` |
| `/admin/audit` | Audit log dan percobaan login | `audit.view` |
| `/display/[tenant]?key=` | Layar TV (tanpa login, dijaga token) | token tenant |

## Struktur

- `db/schema.ts` – skema Drizzle hasil introspeksi database yang sudah ada (jangan `drizzle-kit push`).
  Kolom `during` (`tstzrange`) didefinisikan manual sebagai custom type; `drizzle-kit pull` akan menimpanya.
- `db/migrations/` – perubahan skema manual (`npm run db:migrate`).
- `lib/auth.ts` – Data Access Layer: sesi, izin, scope. `lib/permissions.mjs` – daftar izin dan peran
  (dipakai aplikasi dan seed). `lib/booking.ts` – status, transisi, dan kebijakan akses (murni).
- `app/(app)/actions.ts`, `app/(app)/admin/actions.ts` – seluruh mutasi (Server Action).
- `components/app-shell.tsx` – kerangka template admin (sidebar, topbar, breadcrumb, menu pengguna, drawer di
  layar kecil). `components/ui.tsx` – `PageHeader`, `Card`, `StatCard`, `SearchBar`. `components/icons.tsx` – ikon SVG.
- `lib/pagination.ts` + `components/pagination.tsx` – paging di sisi server (lihat bawah).

## Paging dan pencarian

Semua daftar (jadwal booking, antrean persetujuan, pengguna, ruangan, audit log, notifikasi, "Booking saya")
dipaging di database dengan `LIMIT/OFFSET`. Total baris diambil di query yang sama lewat `count(*) over()`.

- Parameter URL: `page`, `size` (10/25/50), `q` (pencarian). Audit log punya `lpage` untuk tabel login.
- Nilai tidak valid dinormalkan (`page=abc` → 1; `size=7` → 10); halaman di luar jangkauan mundur ke halaman terakhir.
- Pencarian memakai `ILIKE` dengan karakter `%`, `_`, `\` di-escape. Scope akses (`OWN`/`DEPARTMENT`/`ALL`) berlaku
  di query yang sama, jadi total dan isi halaman tidak membocorkan data di luar cakupan pengguna.
- Untuk menambah daftar baru: buat fungsi data yang menerima `{ limit, offset }` dan menyertakan
  `total: sql<number>\`count(*) over()::int\``, lalu panggil `fetchPage(...)` dan render `<Pagination />`.
- `scripts/seed.mjs` – data demo. `proxy.ts` – pengecekan awal cookie sesi.

## Keputusan desain yang perlu diketahui

- **Anti-bentrok ada di database**, bukan di kode: exclusion constraint `uq_room_reservation_no_overlap`
  pada `meeting_room_reservation`. Booking dan blokir ruangan memakai tabel yang sama. Semua operasi
  jamak (booking, seri berulang, jadwal ulang) satu statement SQL atomik.
- **Izin dibaca ulang dari database di setiap request.** Mengubah peran atau menonaktifkan pengguna langsung
  berlaku, termasuk pada sesi yang sedang berjalan. Cookie sesi hanya berisi identitas dan masa berlaku.
- **Setiap Server Action memvalidasi ulang** autentikasi, izin, kepemilikan, dan kebijakan terhadap data di
  database. Tombol yang disembunyikan di UI bukan batas keamanan.
- Approver tidak dapat menyetujui pengajuannya sendiri (kecuali pemegang `booking.manage`). Administrator
  terakhir tenant tidak dapat diturunkan atau dinonaktifkan.
- RLS di `meeting_booking` (`app.tenant_id`) tidak aktif untuk role `neondb_owner` (bypass). Isolasi tenant
  dijaga oleh filter `tenant_id` pada setiap query. Jika memakai role non-owner, set `app.tenant_id` per request.
- Login dibatasi: 5 gagal per user atau 30 per IP dalam 15 menit. Audit login dan audit aksi ditulis ke
  `audit_login` dan `audit_log`.

## Pengujian

```bash
npm test                          # tes unit (kebijakan akses, password, izin, paging): cepat, tanpa server dan database
npm run build && npx next start -p 3100     # terminal lain, untuk tes E2E
npm run test:e2e -- --yes         # tes E2E terhadap server di atas
```

- Tes unit memakai `node:test` dan membaca `lib/booking.ts` langsung lewat `--experimental-strip-types`
  (Node 22.6+), jadi file itu harus tetap murni (tanpa import dari Next.js atau database).
- Tes E2E (`tests/e2e/`) meniru browser: login, mengirim form Server Action, lalu memeriksa hasilnya di
  database. Cakupannya autentikasi, otorisasi (termasuk IDOR dan POST palsu), booking, bentrok, persetujuan,
  scope, jadwal ulang, check-in, layar TV, ruangan, blokir, master, pengguna, pengaturan, audit, serta paging
  dan pencarian (`03-paging.mjs`, memakai puluhan data uji).
- **Runner E2E menghapus dan mengisi ulang tenant `DEMO`** di `DATABASE_URL` dan memerlukan `--yes`. Gunakan
  database pengembangan. Alamat server dapat diubah dengan `E2E_BASE_URL`.
- Uji terhadap build produksi (`next start`), bukan `next dev`: mode dev menampilkan `InvariantError` soal
  `cookies()` di log, yang hanya noise.

## Belum dibangun

Lampiran file (`meeting_attachment`, butuh penyimpanan objek), check-in QR (`qr_token`), persetujuan
bertingkat (hanya satu tingkat), proyek (`org_project`), kuota booking per bulan, email/push (notifikasi
hanya di dalam aplikasi), SSO (`external_subject`), serta tes untuk tampilan layar TV di browser nyata
(tes E2E memeriksa HTML dan database, bukan render visual).
