// E2E 1: autentikasi, otorisasi, booking, persetujuan, jadwal ulang, check-in, layar TV, logout.
import {
  Browser, check, day, denied, hm, idMap, is404, loc, minutesOfDayWib, one, rows, section, skip, sql, summary, text,
} from "./client.mjs";

const [today, tomorrow] = [day(0), day(1)];
const idOf = async (title) => (await one("select id from meeting_booking where title=$1 order by id desc limit 1", title))?.id;
const rooms = await idMap("select room_code k, id from meeting_room where tenant_id=(select id from saas_tenant where tenant_code='DEMO')");
const types = await idMap("select type_code k, id from meeting_type where tenant_id=(select id from saas_tenant where tenant_code='DEMO')");
const members = await idMap("select replace(u.username,'demo.','') k, m.id from iam_tenant_member m join iam_user u on u.id=m.user_id where u.username like 'demo.%'");
const form = (o) => ({
  title: o.title, agenda: "uji", roomId: o.roomId ?? rooms[o.room], typeId: types[o.type ?? "INTERNAL"],
  date: o.date ?? tomorrow, from: o.from, to: o.to, pax: o.pax ?? 3, repeat: "none", participants: o.participants ?? [],
});

section("Autentikasi");
const anon = new Browser();
let r = await anon.get("/admin");
check("anonim ke /admin diarahkan ke /login", r.status === 307 && r.location?.startsWith("/login?next=%2Fadmin"), r.location);
r = await anon.get("/");
check("anonim ke / diarahkan ke /login", r.status === 307 && r.location === "/login", r.location);
r = await anon.login("demo.budi", "salah");
const wrongMsg = r.alert;
check("password salah ditolak", r.status === 200 && /salah/.test(wrongMsg ?? ""), JSON.stringify(r).slice(0, 200));
r = await anon.login("tidak.ada", "apapun");
check("username tidak dikenal: pesan identik (tidak membocorkan)", !!wrongMsg && r.alert === wrongMsg, r.alert);
const forged = new Browser();
forged.jar.set("mrb_session", "eyJ1aWQiOjEsImV4cCI6OTk5OTk5OTk5OX0.palsu");
r = await forged.get("/");
check("cookie dengan tanda tangan palsu dianggap belum login", /\/login/.test(r.html + (r.location ?? "")), r.status);

section("Pembatasan percobaan login");
const lock = new Browser();
for (let i = 0; i < 5; i++) await lock.login("demo.andi", "salah" + i);
r = await lock.login("demo.andi", "Demo@2026");
check("setelah 5 gagal, password benar pun ditolak sementara", r.status === 200 && !!r.alert, JSON.stringify(r).slice(0, 150));

section("Karyawan (demo.budi, scope OWN)");
const budi = new Browser();
r = await budi.login("demo.budi");
check("login budi -> 303 ke /", r.status === 303 && r.location === "/", JSON.stringify(r).slice(0, 200));
check("cookie sesi diset", budi.jar.has("mrb_session"));
r = await budi.get("/");
check("beranda menyapa budi", /Halo, Budi Setiawan/.test(text(r.html)));
check("budi (OWN) ditolak di /admin", denied(await budi.get("/admin")));

section("Booking oleh karyawan");
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Rapat Budi", room: "BDG", from: "14:00", to: "15:00", participants: [members.maya, members.rafli] }));
check("buat booking internal -> 303 ke detail", r.status === 303 && /^\/bookings\/\d+$/.test(r.location ?? ""), JSON.stringify(r).slice(0, 250));
const bb = await one("select id,status,organizer_member_id from meeting_booking where title=$1", "UJI Rapat Budi");
check("status langsung APPROVED (tipe tanpa persetujuan)", bb?.status === "APPROVED");
check("penyelenggara diambil dari sesi, bukan dari form", bb?.organizer_member_id == members.budi);
check("2 peserta tersimpan", (await one("select count(*)::int n from meeting_participant where booking_id=$1", bb.id)).n === 2);
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Bentrok", room: "BDG", from: "14:30", to: "15:30" }));
check("bentrok jadwal ditolak oleh database", /sudah dipesan/.test(r.alert ?? ""), r.alert);
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Kapasitas", room: "MDN", from: "16:00", to: "17:00", pax: 99 }));
check("melebihi kapasitas ditolak", /Kapasitas/.test(r.alert ?? ""), r.alert);
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Lampau", room: "MDN", date: day(-1), from: "10:00", to: "11:00" }));
check("waktu lampau ditolak untuk karyawan", /sudah lewat/.test(r.alert ?? ""), r.alert);
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Jam Terbalik", room: "MDN", from: "11:00", to: "10:00" }));
check("jam selesai sebelum mulai ditolak", /setelah jam mulai/.test(r.alert ?? ""), r.alert);
await budi.submit("/book", ['name="title"'], form({ title: "UJI Board", room: "BLT", type: "BOARD", from: "10:00", to: "11:00" }));
const bd = await one("select id,status from meeting_booking where title=$1", "UJI Board");
check("tipe yang perlu persetujuan -> PENDING", bd?.status === "PENDING");
const notifs = await rows("select u.username from notification n join iam_user u on u.id=n.user_id where n.reference_id=$1 and n.notification_type='APPROVAL_REQUEST'", bd.id);
check("approver diberi notifikasi, pengaju tidak", notifs.length >= 3 && !notifs.some((n) => n.username === "demo.budi"), JSON.stringify(notifs.map((n) => n.username)));
await budi.submit("/book", ['name="title"'], { ...form({ title: "UJI Berulang", room: "SBY", from: "15:00", to: "16:00" }), repeat: "weekly", repeatCount: 3 });
const series = await one("select count(*)::int n, count(distinct series_id)::int s from meeting_booking where title=$1", "UJI Berulang");
check("rapat mingguan 3x dibuat dalam 1 seri", series.n === 3 && series.s === 1, JSON.stringify(series));
await budi.submit("/book", ['name="title"'], { ...form({ title: "UJI Seri Bentrok", room: "SBY", from: "15:30", to: "16:30" }), repeat: "weekly", repeatCount: 3 });
check("seri yang bentrok di salah satu tanggal batal seluruhnya (atomik)", (await one("select count(*)::int n from meeting_booking where title=$1", "UJI Seri Bentrok")).n === 0);

section("Otorisasi pada booking");
const foreign = await idOf("Marketing Campaign 12.12");
r = await budi.get(`/bookings/${foreign}`);
check("budi tidak dapat membuka booking orang lain (404 tanpa data)", is404(r) && !r.html.includes("Pembahasan strategi kampanye"), r.status);
r = await budi.get(`/bookings/${bb.id}`);
check("budi dapat membuka booking sendiri", r.status === 200 && /UJI Rapat Budi/.test(r.html));
r = await budi.submit(`/bookings/${bb.id}`, ['name="reason"'], { id: foreign, to: "CANCELLED" });
check("IDOR: membatalkan booking orang lain lewat form palsu ditolak", /tidak ditemukan|tidak dapat/i.test(loc(r)), JSON.stringify(r).slice(0, 220));
check("booking orang lain tetap APPROVED", (await one("select status from meeting_booking where id=$1", foreign)).status === "APPROVED");
r = await budi.submit(`/bookings/${bd.id}`, ['name="reason"'], { to: "APPROVED" });
check("pengaju tidak dapat menyetujui bookingnya sendiri", /tidak dapat/i.test(loc(r)) && (await one("select status from meeting_booking where id=$1", bd.id)).status === "PENDING", JSON.stringify(r).slice(0, 220));
const maya = new Browser();
await maya.login("demo.maya");
check("peserta undangan (maya) dapat melihat rapatnya", (await maya.get(`/bookings/${bb.id}`)).status === 200);
check("undangan tampil di beranda maya", /UJI Rapat Budi/.test(text((await maya.get("/")).html)));

section("Persetujuan (demo.mgmt = APPROVER)");
const mgmt = new Browser();
await mgmt.login("demo.mgmt");
check("approver melihat pengajuan budi", /UJI Board/.test(text((await mgmt.get("/admin?view=pending")).html)));
r = await mgmt.submit(`/bookings/${bd.id}`, ['name="reason"'], { reason: "Setuju, lanjutkan" }, { as: ["to", "APPROVED"] });
check("approve -> APPROVED", (await one("select status from meeting_booking where id=$1", bd.id)).status === "APPROVED", JSON.stringify(r).slice(0, 200));
const approvals = await rows("select status, remarks from meeting_approval where booking_id=$1", bd.id);
check("catatan persetujuan tersimpan di meeting_approval", approvals.length === 1 && approvals[0].status === "APPROVED" && approvals[0].remarks === "Setuju, lanjutkan", JSON.stringify(approvals));
check("pengaju diberi notifikasi hasil", (await one("select count(*)::int n from notification where user_id=(select user_id from iam_tenant_member where id=$1) and reference_id=$2 and notification_type='BOOKING_STATUS'", members.budi, bd.id)).n === 1);
const audit = await rows("select action from audit_log where record_id=$1 and module='booking'", bd.id);
check("audit log mencatat CREATE dan STATUS_APPROVED", audit.some((a) => a.action === "CREATE") && audit.some((a) => a.action === "STATUS_APPROVED"), JSON.stringify(audit));

section("Pemisahan tugas (demo.sarah = DEPT_HEAD)");
const sarah = new Browser();
await sarah.login("demo.sarah");
await sarah.submit("/book", ['name="title"'], form({ title: "UJI Board Sarah", room: "BLT", type: "BOARD", from: "13:00", to: "14:00" }));
const sb = await idOf("UJI Board Sarah");
await sarah.submit(`/bookings/${sb}`, ['name="reason"'], {}, { as: ["to", "APPROVED"] });
check("approver tidak boleh menyetujui pengajuannya sendiri", (await one("select status from meeting_booking where id=$1", sb)).status === "PENDING");
const admin = new Browser();
await admin.login("demo.admin");
await admin.submit(`/bookings/${sb}`, ['name="reason"'], {}, { as: ["to", "APPROVED"] });
check("admin dapat menyetujuinya", (await one("select status from meeting_booking where id=$1", sb)).status === "APPROVED");

section("Scope DEPARTMENT (demo.dimas, Sales)");
const dimas = new Browser();
await dimas.login("demo.dimas");
const dimasView = text((await dimas.get(`/admin?date=${today}`)).html);
check("dimas melihat rapat departemen Sales", /Review Penjualan/.test(dimasView));
check("dimas TIDAK melihat rapat departemen Marketing", !/Marketing Campaign 12\.12/.test(dimasView));
const adminView = text((await admin.get(`/admin?date=${today}`)).html);
check("admin (ALL) melihat semuanya", /Marketing Campaign 12\.12/.test(adminView) && /Review Penjualan/.test(adminView));

section("Jadwal ulang dan pembatalan");
r = await budi.submit(`/bookings/${bb.id}`, ['name="roomId"', 'name="from"'], { date: tomorrow, from: "16:00", to: "17:00", roomId: rooms.BDG });
check("budi menjadwalkan ulang miliknya", r.status === 303 && (await one("select to_char(start_at at time zone 'Asia/Jakarta','HH24:MI') s from meeting_booking where id=$1", bb.id)).s === "16:00", JSON.stringify(r).slice(0, 200));
check("reservasi anti-bentrok ikut berpindah", (await one("select to_char(lower(during) at time zone 'Asia/Jakarta','HH24:MI') s from meeting_room_reservation where booking_id=$1", bb.id)).s === "16:00");
r = await budi.submit("/book", ['name="title"'], form({ title: "UJI Slot Lama", room: "BDG", from: "14:00", to: "15:00" }));
check("slot lama kini bebas dipakai", r.status === 303, JSON.stringify(r).slice(0, 200));
r = await budi.submit(`/bookings/${bb.id}`, ['name="roomId"', 'name="from"'], { date: tomorrow, from: "14:30", to: "15:30", roomId: rooms.BDG });
check("jadwal ulang yang bentrok ditolak", /sudah dipesan/.test(r.alert ?? ""), r.alert);
await budi.submit(`/bookings/${bb.id}`, ['name="reason"'], { reason: "tidak jadi" }, { as: ["to", "CANCELLED"] });
const cancelled = await one("select b.status, r.status rs from meeting_booking b join meeting_room_reservation r on r.booking_id=b.id where b.id=$1", bb.id);
check("pemilik membatalkan miliknya; slot dilepas", cancelled.status === "CANCELLED" && cancelled.rs === "CANCELLED", JSON.stringify(cancelled));

section("Check-in");
const mod = minutesOfDayWib();
if (mod < 5 || mod > 23 * 60 + 15) {
  skip("check-in dan check-out", "terlalu dekat tengah malam WIB");
} else {
  // Pilih ruangan yang kosong pada jendela waktu sekarang supaya tes tidak bergantung pada jam menjalankannya.
  const free = await one(
    `select r.id from meeting_room r where r.tenant_id=(select id from saas_tenant where tenant_code='DEMO') and r.status='AVAILABLE'
       and not exists (select 1 from meeting_room_reservation x where x.room_id=r.id and x.status='ACTIVE'
         and x.during && tstzrange(now() - interval '5 minutes', now() + interval '45 minutes'))
     limit 1`,
  );
  await budi.submit("/book", ['name="title"'], form({ title: "UJI Sekarang", roomId: free.id, date: today, from: hm(-2), to: hm(40) }));
  const nowId = await idOf("UJI Sekarang");
  check("booking yang sedang berlangsung dibuat", !!nowId);
  await budi.submit(`/bookings/${nowId}`, ["Check-in"], {});
  check("check-in tercatat", (await one("select count(*)::int n from meeting_checkin where booking_id=$1", nowId)).n === 1);
  await budi.submit(`/bookings/${nowId}`, ["Check-out"], {});
  check("check-out tercatat", !!(await one("select checkout_at from meeting_checkin where booking_id=$1", nowId))?.checkout_at);
}

section("Layar TV");
const tenantId = (await one("select id from saas_tenant where tenant_code='DEMO'")).id;
const token = (await one("select settings->>'displayToken' t from saas_tenant_setting where tenant_id=$1", tenantId)).t;
// Booking seharian buatan tes: layar menyembunyikan rapat yang sudah selesai, jadi data seed tidak cukup stabil.
const [loc1] = await rows("select id from org_location where tenant_id=$1 and location_code='HQ'", tenantId);
const [roomRow] = await rows(
  "insert into meeting_room (tenant_id, location_id, room_code, room_name, capacity) values ($1,$2,'E2E','Ruang E2E',5) returning id",
  tenantId, loc1.id,
);
await sql.query(
  `with b as (insert into meeting_booking (tenant_id, booking_no, room_id, organizer_member_id, title, start_at, end_at, status, created_by)
              values ($1,'BK-E2E-DISPLAY',$2,$3,'UJI Layar Seharian',($4||'T00:00:00+07:00')::timestamptz,($4||'T23:59:00+07:00')::timestamptz,'APPROVED',
                      (select user_id from iam_tenant_member where id=$3)) returning id, tenant_id, room_id, start_at, end_at)
   insert into meeting_room_reservation (tenant_id, room_id, booking_id, reservation_type, during, status)
   select tenant_id, room_id, id, 'BOOKING', tstzrange(start_at, end_at, '[)'), 'ACTIVE' from b`,
  [tenantId, roomRow.id, members.budi, today],
);
const pub = new Browser();
r = await pub.get("/display/DEMO");
check("tanpa token -> 404, tanpa data", is404(r) && !r.html.includes("UJI Layar Seharian"), r.status);
r = await pub.get("/display/DEMO?key=salah");
check("token salah -> 404", is404(r) && !r.html.includes("UJI Layar Seharian"), r.status);
r = await pub.get(`/display/TIDAKADA?key=${token}`);
check("tenant lain dengan token ini -> 404", is404(r), r.status);
r = await pub.get(`/display/DEMO?key=${token}`);
check("token benar -> 200 dengan jadwal", r.status === 200 && /JADWAL RAPAT/.test(r.html) && r.html.includes("UJI Layar Seharian"), r.status);
check("rapat berstatus Menunggu tidak tampil di layar", !r.html.includes("Presentasi Anggaran Marketing"));
r = await pub.get(`/display/DEMO?key=${token}&location=HQ`);
check("filter lokasi HQ menampilkan rapatnya", r.html.includes("UJI Layar Seharian"));
r = await pub.get(`/display/DEMO?key=${token}&location=XX`);
check("lokasi yang tidak ada -> kosong", /Tidak ada rapat/.test(r.html) && !r.html.includes("UJI Layar Seharian"));

section("Logout");
await budi.submit("/", ["Keluar"], {});
check("logout menghapus sesi", !budi.jar.has("mrb_session"), JSON.stringify([...budi.jar.keys()]));
check("setelah logout /admin kembali ke login", (await budi.get("/admin")).status === 307);
summary();
