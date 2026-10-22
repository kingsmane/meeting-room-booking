// E2E 3: paging dan pencarian di sisi server (jadwal booking, pengguna, notifikasi, audit, ruangan).
import { Browser, check, day, one, rows, section, sql, summary, text } from "./client.mjs";

const tenantId = (await one("select id from saas_tenant where tenant_code='DEMO'")).id;
const hq = (await one("select id from org_location where tenant_id=$1 and location_code='HQ'", tenantId)).id;
const date = day(10);
const adminMember = (await one("select m.id, m.user_id from iam_tenant_member m join iam_user u on u.id=m.user_id where u.username='demo.admin'"));

// --- data uji: 24 booking pada satu hari (slot 30 menit di satu ruangan), 25 pengguna, 25 notifikasi ---
const [room] = await rows(
  "insert into meeting_room (tenant_id, location_id, room_code, room_name, capacity) values ($1,$2,'PAGING','Ruang Paging',5) returning id",
  tenantId, hq,
);
for (let i = 0; i < 24; i++) {
  const hh = String(Math.floor(i / 2)).padStart(2, "0");
  const mm = i % 2 ? "30" : "00";
  const hh2 = String(Math.floor((i + 1) / 2)).padStart(2, "0");
  const mm2 = (i + 1) % 2 ? "30" : "00";
  const endDate = i === 23 ? day(11) : date;
  await sql.query(
    `with b as (insert into meeting_booking (tenant_id, booking_no, room_id, organizer_member_id, title, start_at, end_at, status, created_by)
       values ($1, $2, $3, $4, $5, ($6||'T'||$7||':00+07:00')::timestamptz, ($8||'T'||$9||':00+07:00')::timestamptz, 'APPROVED', $10) returning id, tenant_id, room_id, start_at, end_at)
     insert into meeting_room_reservation (tenant_id, room_id, booking_id, reservation_type, during, status)
     select tenant_id, room_id, id, 'BOOKING', tstzrange(start_at, end_at, '[)'), 'ACTIVE' from b`,
    [tenantId, `BK-PG-${String(i + 1).padStart(3, "0")}`, room.id, adminMember.id, `UJI Paging ${String(i + 1).padStart(2, "0")}`,
      date, `${hh}:${mm}`, endDate, i === 23 ? "00:00" : `${hh2}:${mm2}`, adminMember.user_id],
  );
}
for (let i = 1; i <= 25; i++) {
  const n = String(i).padStart(2, "0");
  const [u] = await rows("insert into iam_user (username, full_name, email) values ($1,$2,$3) returning id", `uji.paging.${n}`, `Uji Paging ${n}`, `paging${n}@demo.test`);
  await sql.query("insert into iam_tenant_member (tenant_id, user_id, department_id) values ($1,$2,(select id from org_department where tenant_id=$1 and department_code='OPS'))", [tenantId, u.id]);
}
for (let i = 1; i <= 25; i++) {
  await sql.query("insert into notification (tenant_id, user_id, notification_type, title, message) values ($1,$2,'INFO',$3,$4)", [tenantId, adminMember.user_id, `Notifikasi uji ${String(i).padStart(2, "0")}`, "isi"]);
}

const admin = new Browser();
await admin.login("demo.admin");
const titlesOn = (html) => [...text(html).matchAll(/UJI Paging \d\d/g)].map((m) => m[0]);
const unique = (a) => [...new Set(a)];

section("Paging jadwal booking (24 data)");
let r = await admin.get(`/admin?date=${date}`);
let t = text(r.html);
check("halaman 1: 'Menampilkan 1–10 dari 24'", /Menampilkan 1–10 dari 24/.test(t), t.match(/Menampilkan[^P]*/)?.[0]);
check("halaman 1 berisi tepat 10 baris, urut waktu", unique(titlesOn(r.html)).length === 10 && unique(titlesOn(r.html))[0] === "UJI Paging 01");
const p1 = unique(titlesOn(r.html));
r = await admin.get(`/admin?date=${date}&page=2`);
t = text(r.html);
check("halaman 2: 'Menampilkan 11–20 dari 24'", /Menampilkan 11–20 dari 24/.test(t));
const p2 = unique(titlesOn(r.html));
r = await admin.get(`/admin?date=${date}&page=3`);
t = text(r.html);
check("halaman 3: 'Menampilkan 21–24 dari 24'", /Menampilkan 21–24 dari 24/.test(t));
const p3 = unique(titlesOn(r.html));
const all = [...p1, ...p2, ...p3];
check("seluruh 24 baris muncul tepat sekali di semua halaman (tanpa duplikat/hilang)", all.length === 24 && unique(all).length === 24, `${all.length}/${unique(all).length}`);
check("halaman 3 hanya 4 baris", p3.length === 4);
r = await admin.get(`/admin?date=${date}&page=99`);
check("halaman melebihi batas -> mundur ke halaman terakhir", /Menampilkan 21–24 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&page=abc`);
check("page tidak valid -> halaman 1", /Menampilkan 1–10 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&page=-5`);
check("page negatif -> halaman 1", /Menampilkan 1–10 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&size=25`);
check("size=25 menampilkan semua 24 dalam satu halaman", /Menampilkan 1–24 dari 24/.test(text(r.html)) && unique(titlesOn(r.html)).length === 24);
r = await admin.get(`/admin?date=${date}&size=7`);
check("size di luar pilihan (7) -> kembali ke 10", /Menampilkan 1–10 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&size=999999`);
check("size sangat besar tidak diterima (tetap 10)", /Menampilkan 1–10 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}`);
check("tautan halaman memuat tanggal dan nomor halaman", r.html.includes(`/admin?date=${date}&amp;page=2`) || r.html.includes(`/admin?date=${date}&page=2`));
check("halaman aktif ditandai aria-current", /aria-current="page"[^>]*>1</.test(r.html));
r = await admin.get(`/admin?date=${date}&q=UJI+Paging+07`);
t = text(r.html);
check("pencarian judul: 1 hasil", /Menampilkan 1–1 dari 1/.test(t) && titlesOn(r.html).every((x) => x === "UJI Paging 07"));
r = await admin.get(`/admin?date=${date}&q=Ruang+Paging&page=2`);
check("pencarian nama ruangan + paging: halaman 2 dari 24 hasil", /Menampilkan 11–20 dari 24/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&q=%25`);
check("karakter % di pencarian di-escape (tidak cocok dengan semua data)", /Tidak ada booking yang cocok/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&q=_`);
check("karakter _ di pencarian di-escape", /Tidak ada booking yang cocok/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}&q=${encodeURIComponent("' OR 1=1 --")}`);
check("input mirip SQL injection diperlakukan sebagai teks biasa", r.status === 200 && /Tidak ada booking yang cocok/.test(text(r.html)));
r = await admin.get(`/admin?date=${date}`);
check("kartu statistik memakai total hari itu, bukan jumlah halaman", /24\s*Total rapat/.test(text(r.html)) || /Total rapat[^0-9]*24|24[^0-9]*Total rapat/.test(text(r.html)));

section("Paging scope: karyawan hanya melihat datanya sendiri");
const dimas = new Browser();
await dimas.login("demo.dimas");
r = await dimas.get(`/admin?date=${date}`);
check("kepala departemen lain tidak melihat 24 booking milik departemen admin", !/UJI Paging/.test(text(r.html)) && /Belum ada booking/.test(text(r.html)));
const budi = new Browser();
await budi.login("demo.budi");
check("karyawan tetap ditolak di /admin", (await budi.get(`/admin?date=${date}`)).html.includes("NEXT_REDIRECT;replace;/forbidden"));

section("Paging pengguna (35 data)");
r = await admin.get("/admin/users");
t = text(r.html);
check("pengguna halaman 1: 1–10 dari 35", /Menampilkan 1–10 dari 35/.test(t), t.match(/Menampilkan[^P]{0,30}/)?.[0]);
r = await admin.get("/admin/users?page=4");
check("pengguna halaman 4: 31–35 dari 35", /Menampilkan 31–35 dari 35/.test(text(r.html)));
r = await admin.get("/admin/users?q=uji.paging.2");
t = text(r.html);
check("cari username 'uji.paging.2': 6 hasil (20–25)", /Menampilkan 1–6 dari 6/.test(t), t.match(/Menampilkan[^P]{0,30}/)?.[0]);
r = await admin.get("/admin/users?q=paging&size=25&page=2");
check("halaman di luar jangkauan pada hasil pencarian mundur ke halaman terakhir (25 hasil, size 25)", /Menampilkan 1–25 dari 25/.test(text(r.html)), text(r.html).match(/Menampilkan[^P]{0,30}/)?.[0]);
r = await admin.get("/admin/users?q=Operations");
check("cari nama departemen: 26 anggota Operations Team (Budi + 25 data uji)", /Menampilkan 1–10 dari 26/.test(text(r.html)) && /Operations Team/.test(text(r.html)), text(r.html).match(/Menampilkan[^P]{0,30}/)?.[0]);
r = await admin.get("/admin/users?q=tidak-ada-orang-ini");
check("pencarian tanpa hasil menampilkan pesan", /Tidak ada pengguna yang cocok/.test(text(r.html)));
const form = [...(await admin.get("/admin/users?page=2")).html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
check("aksi pada baris di halaman 2 tetap tersedia (form ubah peran ada)", form.some((f) => f.includes('name="roleId"')));

section("Paging notifikasi (25 data)");
r = await admin.get("/notifications");
check("notifikasi: 1–10 dari 25 dan terbaru di atas", /Menampilkan 1–10 dari 25/.test(text(r.html)) && /Notifikasi uji 25/.test(text(r.html)));
r = await admin.get("/notifications?page=3");
check("notifikasi halaman 3: 21–25", /Menampilkan 21–25 dari 25/.test(text(r.html)) && /Notifikasi uji 01/.test(text(r.html)));
r = await admin.get("/notifications?page=3&size=10");
await admin.submit("/notifications?page=3", ["Tandai dibaca"], {});
check("'Tandai dibaca' pada halaman 3 menandai tepat satu notifikasi", (await one("select count(*)::int n from notification where user_id=$1 and is_read=true and title like 'Notifikasi uji%'", adminMember.user_id)).n === 1);

section("Paging audit log");
r = await admin.get("/admin/audit");
check("audit halaman terbuka dengan 2 tabel dan 2 pager", r.status === 200 && /Aktivitas/.test(text(r.html)) && /Percobaan login/.test(text(r.html)));
const nAudit = (await one("select count(*)::int n from audit_log where tenant_id=$1", tenantId)).n;
const nLogin = (await one("select count(*)::int n from audit_login where tenant_id=$1", tenantId)).n;
check("total di pager audit = jumlah baris di database", new RegExp(`dari ${nAudit}\\b`).test(text(r.html)) || nAudit === 0, `audit=${nAudit} login=${nLogin}`);
r = await admin.get("/admin/audit?lpage=1&page=1&size=25");
check("audit dengan size=25 terbuka", r.status === 200);

section("Paging ruangan");
r = await admin.get("/admin/rooms");
check("ruangan: ada Ruang Paging dan pager", /Menampilkan 1–\d+ dari \d+/.test(text(r.html)));
r = await admin.get("/admin/rooms?q=Paging");
check("cari ruangan 'Paging': 1 hasil", /Menampilkan 1–1 dari 1/.test(text(r.html)));
r = await admin.get("/admin/rooms?q=PAGING");
check("pencarian ruangan tidak peka huruf besar/kecil", /Menampilkan 1–1 dari 1/.test(text(r.html)));

section("Beranda: paging 'Booking saya'");
for (let i = 0; i < 12; i++) {
  const hh = String(8 + i).padStart(2, "0");
  await sql.query(
    `with b as (insert into meeting_booking (tenant_id, booking_no, room_id, organizer_member_id, title, start_at, end_at, status, created_by)
       values ($1,$2,$3,$4,$5,($6||'T'||$7||':00+07:00')::timestamptz,($6||'T'||$8||':00+07:00')::timestamptz,'APPROVED',$9) returning id, tenant_id, room_id, start_at, end_at)
     insert into meeting_room_reservation (tenant_id, room_id, booking_id, reservation_type, during, status)
     select tenant_id, room_id, id, 'BOOKING', tstzrange(start_at, end_at, '[)'), 'ACTIVE' from b`,
    [tenantId, `BK-HM-${i}`, room.id, adminMember.id, `UJI Beranda ${String(i + 1).padStart(2, "0")}`, day(12), `${hh}:00`, `${hh}:45`, adminMember.user_id],
  );
}
r = await admin.get("/");
t = text(r.html);
// Urut menurut waktu mulai: 24 booking uji paging (+10 hari) lebih dulu, lalu 12 booking beranda (+12 hari) = 36.
check("beranda: 'Booking saya' 1–10 dari 36, hanya data paling awal", /Menampilkan 1–10 dari 36/.test(t) && /UJI Paging 01/.test(t) && !/UJI Beranda/.test(t), t.match(/Menampilkan[^P]{0,30}/)?.[0]);
r = await admin.get("/?page=4");
t = text(r.html);
check("beranda halaman 4: 31–36 memuat data terakhir", /Menampilkan 31–36 dari 36/.test(t) && /UJI Beranda 12/.test(t) && !/UJI Paging/.test(t));
r = await admin.get("/?page=3");
check("beranda halaman 3 memuat batas dua kelompok data", /UJI Paging 24/.test(text(r.html)) && /UJI Beranda 01/.test(text(r.html)));
summary();
