// E2E 2: halaman administrasi: izin per peran, ruangan, blokir, data master, pengguna, pengaturan layar, akun, audit.
import {
  Browser, check, day, denied, idMap, is404, loc, one, rows, section, sql, summary, text,
} from "./client.mjs";

const tomorrow = day(1);
const tenantId = (await one("select id from saas_tenant where tenant_code='DEMO'")).id;
const rooms = await idMap(`select room_code k, id from meeting_room where tenant_id=${tenantId}`);
const types = await idMap(`select type_code k, id from meeting_type where tenant_id=${tenantId}`);
const roles = await idMap(`select role_code k, id from iam_role where tenant_id=${tenantId}`);
const depts = await idMap(`select department_code k, id from org_department where tenant_id=${tenantId}`);
const members = await idMap("select replace(u.username,'demo.','') k, m.id from iam_tenant_member m join iam_user u on u.id=m.user_id where u.username like 'demo.%'");
const hqId = (await one("select id from org_location where tenant_id=$1 and location_code='HQ'", tenantId)).id;
const settingsOf = async () => (await one("select settings from saas_tenant_setting where tenant_id=$1", tenantId)).settings;
const roleOf = async (memberId) => (await one("select r.role_code c from iam_member_role mr join iam_role r on r.id=mr.role_id where mr.member_id=$1", memberId)).c;

const admin = new Browser();
await admin.login("demo.admin");
const ga = new Browser();
await ga.login("demo.ga");
const budi = new Browser();
await budi.login("demo.budi");

section("Akses halaman administrasi per peran");
const adminPages = ["/admin/rooms", "/admin/master", "/admin/users", "/admin/settings", "/admin/audit"];
for (const p of adminPages) check(`budi ditolak di ${p}`, denied(await budi.get(p)));
for (const p of ["/admin/rooms", "/admin/master"]) check(`Staf GA boleh ${p}`, !denied(await ga.get(p)) && (await ga.get(p)).status === 200);
for (const p of ["/admin/users", "/admin/settings", "/admin/audit"]) check(`Staf GA ditolak di ${p}`, denied(await ga.get(p)));
for (const p of adminPages) {
  const r = await admin.get(p);
  check(`admin boleh ${p}`, r.status === 200 && !denied(r), r.status);
}
{
  // Pemalsuan: karyawan mengirim Server Action milik halaman admin (form dipinjam dari sesi admin).
  const pg = await admin.get("/admin/rooms");
  const form = [...pg.html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => /name="to"/.test(f));
  const res = await budi.post("/admin/rooms", form, { id: rooms.BDG, to: "INACTIVE" });
  const status = (await one("select status from meeting_room where id=$1", rooms.BDG)).status;
  check("Server Action admin dilindungi: POST palsu dari karyawan tidak mengubah ruangan", status === "AVAILABLE", `${res.status} ${status}`);
}

section("Ruangan");
let r = await admin.submit("/admin/rooms", ['name="code"'], { code: "uji1", name: "Ruang Uji", floor: "Lantai 3", capacity: 4, locationId: hqId });
const room = await one("select id, room_code, capacity from meeting_room where room_name='Ruang Uji'");
check("tambah ruangan (kode di-uppercase)", room?.room_code === "UJI1" && room.capacity === 4, JSON.stringify(r).slice(0, 200));
r = await admin.submit("/admin/rooms", ['name="code"'], { code: "UJI1", name: "Duplikat", floor: "", capacity: 4, locationId: hqId });
check("kode ganda ditolak", /sudah dipakai/.test(r.alert ?? ""), r.alert);
r = await admin.submit("/admin/rooms", ['name="code"'], { code: "X", name: "Salah", floor: "", capacity: 0, locationId: hqId });
check("kode/kapasitas tidak valid ditolak", !!r.alert, r.alert);
await admin.submit("/admin/rooms", [`value="${room.id}"`, 'value="MAINTENANCE"'], {});
check("ubah status ruangan -> MAINTENANCE", (await one("select status from meeting_room where id=$1", room.id)).status === "MAINTENANCE");
check("ruangan perawatan tidak muncul di form booking", !/Ruang Uji/.test(text((await budi.get("/book")).html)));
await admin.submit("/admin/rooms", [`value="${room.id}"`, 'value="AVAILABLE"'], {});
check("setelah tersedia kembali, muncul di form booking", /Ruang Uji/.test(text((await budi.get("/book")).html)));
const fac = await idMap(`select facility_code k, id from meeting_facility where tenant_id=${tenantId}`);
r = await admin.submit(`/admin/rooms/${room.id}`, ['name="description"'], { id: room.id, name: "Ruang Uji B", floor: "Lantai 3", description: "uji", capacity: 5, facilities: [fac.PROJ, fac.TV, 999999] });
const rf = await rows("select facility_id from meeting_room_facility where room_id=$1", room.id);
check("edit ruangan + fasilitas (ID tak valid diabaikan)", rf.length === 2 && (await one("select room_name from meeting_room where id=$1", room.id)).room_name === "Ruang Uji B", JSON.stringify(rf));

section("Blokir ruangan");
const bookingForm = (o) => ({ title: o.title, agenda: "", roomId: room.id, typeId: types.INTERNAL, date: tomorrow, from: o.from, to: o.to, pax: 2, repeat: "none" });
await admin.submit(`/admin/rooms/${room.id}`, ['name="startDate"'], { roomId: room.id, blockType: "MAINTENANCE", reason: "Cat ulang", startDate: tomorrow, startTime: "08:00", endDate: tomorrow, endTime: "12:00" });
check("blokir dibuat", (await one("select count(*)::int n from meeting_room_block where room_id=$1 and status='ACTIVE'", room.id)).n === 1);
r = await budi.submit("/book", ['name="title"'], bookingForm({ title: "UJI di blokir", from: "10:00", to: "11:00" }));
check("booking pada rentang blokir ditolak (constraint yang sama)", /sudah dipesan atau diblokir/.test(r.alert ?? ""), r.alert);
r = await budi.submit("/book", ['name="title"'], bookingForm({ title: "UJI luar blokir", from: "13:00", to: "14:00" }));
check("booking di luar rentang blokir diterima", r.status === 303, JSON.stringify(r).slice(0, 150));
r = await admin.submit(`/admin/rooms/${room.id}`, ['name="startDate"'], { roomId: room.id, blockType: "EVENT", reason: "Bentrok", startDate: tomorrow, startTime: "12:30", endDate: tomorrow, endTime: "13:30" });
check("blokir yang menimpa booking aktif ditolak", /booking aktif/.test(r.alert ?? ""), r.alert);
const blockId = (await one("select id from meeting_room_block where room_id=$1 and status='ACTIVE'", room.id)).id;
await admin.submit(`/admin/rooms/${room.id}`, ["Batalkan blokir"], {});
check("blokir dibatalkan", (await one("select status from meeting_room_block where id=$1", blockId)).status === "CANCELLED");
r = await budi.submit("/book", ['name="title"'], bookingForm({ title: "UJI setelah blokir batal", from: "10:00", to: "11:00" }));
check("setelah blokir dibatalkan, slot bebas", r.status === 303, JSON.stringify(r).slice(0, 150));

section("Data master");
r = await ga.submit("/admin/master", ['name="code"', 'value="type"'], { entity: "type", code: "WORKSHOP", name: "Workshop", requireApproval: "on" });
const workshop = await one("select id, require_approval from meeting_type where type_code='WORKSHOP' and tenant_id=$1", tenantId);
check("tipe rapat baru (perlu persetujuan)", workshop?.require_approval === true, JSON.stringify(r).slice(0, 200));
r = await ga.submit("/admin/master", ['name="code"', 'value="type"'], { entity: "type", code: "workshop", name: "Dobel" });
check("kode master ganda ditolak", /sudah dipakai/.test(r.alert ?? ""), r.alert);
await budi.submit("/book", ['name="title"'], { ...bookingForm({ title: "UJI Workshop", from: "09:00", to: "10:00" }), roomId: rooms.SMG, typeId: workshop.id });
check("tipe baru yang butuh persetujuan -> PENDING", (await one("select status from meeting_booking where title='UJI Workshop'"))?.status === "PENDING");
await ga.submit("/admin/master", ['value="approval"', `value="${workshop.id}"`], {});
check("toggle persetujuan tipe", (await one("select require_approval from meeting_type where id=$1", workshop.id)).require_approval === false);
await ga.submit("/admin/master", ['value="active"', `value="${workshop.id}"`], {});
check("nonaktifkan tipe", (await one("select is_active from meeting_type where id=$1", workshop.id)).is_active === false);
check("tipe nonaktif tidak muncul di form booking", !/Workshop/.test(text((await budi.get("/book")).html)));
await ga.submit("/admin/master", ['name="code"', 'value="department"'], { entity: "department", code: "RND", name: "Riset" });
check("departemen baru dibuat", !!(await one("select id from org_department where department_code='RND' and tenant_id=$1", tenantId)));
check("karyawan tidak dapat membuka master", denied(await budi.get("/admin/master")));

section("Pengguna");
const newUser = { fullName: "Pegawai Baru", username: "Pegawai.Baru", email: "baru@demo.test", password: "Baru12345", jobTitle: "Analis", employeeCode: "E-9", roleId: roles.EMPLOYEE, departmentId: depts.OPS };
r = await admin.submit("/admin/users", ['name="fullName"'], newUser);
const created = await one("select id, password_hash from iam_user where username='pegawai.baru'");
check("pengguna dibuat (username dinormalkan ke huruf kecil)", !!created, JSON.stringify(r).slice(0, 200));
check("password tersimpan sebagai hash scrypt, bukan teks", /^scrypt\$/.test(created?.password_hash ?? "") && !created.password_hash.includes("Baru12345"));
r = await admin.submit("/admin/users", ['name="fullName"'], { ...newUser, fullName: "X" });
check("username ganda ditolak", /sudah dipakai/.test(r.alert ?? ""), r.alert);
r = await admin.submit("/admin/users", ['name="fullName"'], { ...newUser, username: "lemah.sekali", password: "abc" });
check("password lemah ditolak", /minimal 8/.test(r.alert ?? ""), r.alert);
r = await admin.submit("/admin/users", ['name="fullName"'], { ...newUser, username: "peran.palsu", password: "Abcd1234", roleId: 999999 });
check("peran tidak valid ditolak", /Peran tidak valid/.test(r.alert ?? ""), r.alert);
const fresh = new Browser();
check("pengguna baru dapat login", (await fresh.login("pegawai.baru", "Baru12345")).status === 303);
check("pengguna baru berperan EMPLOYEE (ditolak di /admin)", denied(await fresh.get("/admin")));

const newMember = (await one("select m.id from iam_tenant_member m join iam_user u on u.id=m.user_id where u.username='pegawai.baru'")).id;
r = await admin.submit("/admin/users", ['name="roleId"', `value="${newMember}"`], { roleId: roles.APPROVER });
check("peran diubah ke APPROVER", (await roleOf(newMember)) === "APPROVER", JSON.stringify(r).slice(0, 200));
check("perubahan peran langsung berlaku pada sesi yang sedang berjalan", !denied(await fresh.get("/admin")));
await admin.submit("/admin/users", ['name="active"', `value="${newMember}"`], { active: "false" });
check("pengguna dinonaktifkan", (await one("select status from iam_tenant_member where id=$1", newMember)).status === "INACTIVE");
r = await fresh.get("/");
check("sesi pengguna nonaktif langsung tidak berlaku", /\/login/.test(r.html + (r.location ?? "")), r.status);
r = await new Browser().login("pegawai.baru", "Baru12345");
check("pengguna nonaktif tidak dapat login", r.status === 200 && !!r.alert, JSON.stringify(r).slice(0, 120));
await admin.submit("/admin/users", ['name="active"', `value="${newMember}"`], { active: "true" });
check("diaktifkan kembali", (await one("select status from iam_tenant_member where id=$1", newMember)).status === "ACTIVE");
await admin.submit("/admin/users", ['name="password"', `value="${newMember}"`, "Ganti"], { password: "Reset9999" });
check("reset password oleh admin berfungsi", (await new Browser().login("pegawai.baru", "Reset9999")).status === 303);
r = await new Browser().login("pegawai.baru", "Baru12345");
check("password lama tidak berlaku lagi", r.status === 200 && !!r.alert);

section("Perlindungan administrator terakhir");
const adminMember = members.admin;
r = await admin.submit("/admin/users", ['name="roleId"', `value="${adminMember}"`], { roleId: roles.EMPLOYEE });
check("admin tidak dapat mengubah peran dirinya", /tidak dapat mengubah peran sendiri/i.test(loc(r)), loc(r));
r = await admin.submit("/admin/users", ['name="active"'], { memberId: adminMember, active: "false" }); // UI menyembunyikan tombol ini, jadi dipalsukan
check("admin tidak dapat menonaktifkan dirinya (POST dipalsukan)", /sendiri/.test(loc(r)), loc(r));
check("admin tetap aktif dan berperan admin", (await one("select status from iam_tenant_member where id=$1", adminMember)).status === "ACTIVE" && (await roleOf(adminMember)) === "TENANT_ADMIN");
await admin.submit("/admin/users", ['name="roleId"', `value="${members.ga}"`], { roleId: roles.TENANT_ADMIN });
check("admin kedua dibuat", (await roleOf(members.ga)) === "TENANT_ADMIN");
const ga2 = new Browser();
await ga2.login("demo.ga");
r = await ga2.submit("/admin/users", ['name="roleId"', `value="${adminMember}"`], { roleId: roles.EMPLOYEE });
check("admin kedua menurunkan admin pertama: boleh (masih ada 1 admin)", (await roleOf(adminMember)) === "EMPLOYEE", loc(r));
r = await ga2.submit("/admin/users", ['name="roleId"', `value="${members.ga}"`], { roleId: roles.EMPLOYEE });
check("admin terakhir tidak dapat diturunkan", /tidak dapat|sendiri/i.test(loc(r)) && (await roleOf(members.ga)) === "TENANT_ADMIN", loc(r));
await ga2.submit("/admin/users", ['name="roleId"', `value="${adminMember}"`], { roleId: roles.TENANT_ADMIN });
check("pemulihan: admin pertama kembali berperan admin", (await roleOf(adminMember)) === "TENANT_ADMIN");

section("Pengaturan layar");
const adm = new Browser();
await adm.login("demo.admin");
await adm.submit("/admin/settings", ['name="announcements"'], { announcements: "Pengumuman uji satu\nPengumuman uji dua\n\n" });
let st = await settingsOf();
check("pengumuman tersimpan (baris kosong dibuang)", JSON.stringify(st.announcements) === JSON.stringify(["Pengumuman uji satu", "Pengumuman uji dua"]), JSON.stringify(st.announcements));
check("kunci lain di jsonb (token, display) tidak hilang saat merge", !!st.displayToken && !!st.display);
r = await adm.submit("/admin/settings", ['name="announcements"'], { announcements: Array(11).fill("x").join("\n") });
check("lebih dari 10 pengumuman ditolak", /Maksimal 10/.test(r.alert ?? ""), r.alert);
await adm.submit("/admin/settings", ['name="soonMinutes"'], { soonMinutes: 45, pageSize: 5, rotateSeconds: 20, refreshSeconds: 30 });
check("parameter layar tersimpan", (await settingsOf()).display.pageSize === 5);
r = await adm.submit("/admin/settings", ['name="soonMinutes"'], { soonMinutes: 1, pageSize: 5, rotateSeconds: 20, refreshSeconds: 30 });
check("parameter di luar batas ditolak", !!r.alert, r.alert);
const tok1 = (await settingsOf()).displayToken;
const pub = new Browser();
check("layar menampilkan pengumuman baru", /Pengumuman uji satu/.test((await pub.get(`/display/DEMO?key=${tok1}`)).html));
await adm.submit("/admin/settings", ["Buat token baru"], {});
const tok2 = (await settingsOf()).displayToken;
check("token baru berbeda dari yang lama", !!tok2 && tok2 !== tok1);
check("token lama berhenti bekerja", is404(await pub.get(`/display/DEMO?key=${tok1}`)));
r = await pub.get(`/display/DEMO?key=${tok2}`);
check("token baru bekerja", r.status === 200 && /JADWAL RAPAT/.test(r.html));
check("halaman pengaturan menampilkan alamat layar dengan token", (await adm.get("/admin/settings")).html.includes(`/display/DEMO?key=${tok2}`));

section("Akun dan audit");
r = await budi.submit("/account", ['name="current"'], { current: "salah", next: "Baru9999x", confirm: "Baru9999x" });
check("ganti password: password lama salah ditolak", /saat ini salah/.test(r.alert ?? ""), r.alert);
r = await budi.submit("/account", ['name="current"'], { current: "Demo@2026", next: "Baru9999x", confirm: "berbeda" });
check("konfirmasi yang tidak sama ditolak", /Konfirmasi/.test(r.alert ?? ""), r.alert);
await budi.submit("/account", ['name="current"'], { current: "Demo@2026", next: "Baru9999x", confirm: "Baru9999x" });
check("password sendiri berhasil diganti", (await new Browser().login("demo.budi", "Baru9999x")).status === 303);
await sql.query("update iam_user set password_hash=(select password_hash from iam_user where username='demo.mgmt') where username='demo.budi'"); // pulihkan password demo
const actions = (await rows("select distinct action from audit_log where tenant_id=$1", tenantId)).map((a) => a.action);
for (const a of ["CREATE", "UPDATE", "STATUS", "BLOCK_CREATE", "BLOCK_CANCEL", "ROLE_CHANGE", "DEACTIVATE", "ACTIVATE", "PASSWORD_RESET", "PASSWORD_CHANGE", "ANNOUNCEMENTS", "DISPLAY", "DISPLAY_TOKEN_ROTATE"]) {
  check(`audit mencatat ${a}`, actions.includes(a), JSON.stringify(actions));
}
const page = text((await adm.get("/admin/audit")).html);
check("halaman audit menampilkan aktivitas dan percobaan login", /ROLE_CHANGE/.test(page) && /Berhasil/.test(page) && /BAD_PASSWORD/.test(page));
check("audit terisi pelaku dan request_id", (await one("select count(*)::int n from audit_log where tenant_id=$1 and actor_nik is not null and request_id is not null", tenantId)).n > 10);
summary();
