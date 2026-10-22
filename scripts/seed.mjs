// Seed data demo. Semua data tenant ada di tenant dengan kode DEMO, jadi mudah dihapus.
//   node --env-file=.env.local scripts/seed.mjs          -> isi data (batal jika DEMO sudah ada)
//   node --env-file=.env.local scripts/seed.mjs --reset  -> hapus data DEMO lalu isi ulang
// Jalankan `npm run db:migrate` dulu (kolom iam_user.password_hash).
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../lib/password.mjs";
import { PERMISSION_DEFS, ROLE_DEFS } from "../lib/permissions.mjs";

const sql = neon(process.env.DATABASE_URL);
const TENANT_CODE = "DEMO";
const DEMO_PASSWORD = "Demo@2026";
const reset = process.argv.includes("--reset");

// Tanggal "hari ini" dan "besok" menurut WIB, supaya data selalu terlihat hidup.
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const today = fmt(new Date());
const tomorrow = fmt(new Date(Date.now() + 24 * 3600 * 1000));
const ts = (date, hhmm) => `${date}T${hhmm}:00+07:00`;

async function wipe() {
  const [t] = await sql`select id from saas_tenant where tenant_code = ${TENANT_CODE}`;
  if (!t) return;
  const id = t.id;
  // Urutan dari anak ke induk supaya FK tidak menghalangi.
  for (const table of [
    "notification",
    "audit_log",
    "audit_login",
    "meeting_room_reservation",
    "meeting_booking_status_history",
    "meeting_approval",
    "meeting_participant",
    "meeting_checkin",
    "meeting_attachment",
    "meeting_booking",
    "meeting_series",
    "meeting_room_block",
  ]) {
    await sql.query(`delete from ${table} where tenant_id = $1`, [id]);
  }
  await sql`delete from meeting_room_facility where room_id in (select id from meeting_room where tenant_id = ${id})`;
  await sql`delete from meeting_facility where tenant_id = ${id}`;
  await sql`delete from meeting_room where tenant_id = ${id}`;
  await sql`delete from meeting_type where tenant_id = ${id}`;
  await sql`delete from iam_member_role where member_id in (select id from iam_tenant_member where tenant_id = ${id})`;
  await sql`delete from iam_role_scope where role_id in (select id from iam_role where tenant_id = ${id})`;
  await sql`delete from iam_role_permission where role_id in (select id from iam_role where tenant_id = ${id})`;
  await sql`delete from iam_role where tenant_id = ${id}`;
  await sql`delete from iam_tenant_member where tenant_id = ${id}`;
  await sql`delete from org_project where tenant_id = ${id}`;
  await sql`delete from org_department where tenant_id = ${id}`;
  await sql`delete from org_location where tenant_id = ${id}`;
  await sql`delete from saas_tenant_setting where tenant_id = ${id}`;
  await sql`delete from saas_subscription where tenant_id = ${id}`;
  await sql`delete from saas_tenant where id = ${id}`;
  await sql`delete from iam_user where username like ${"demo.%"}`;
  console.log("Data DEMO lama dihapus.");
}

const [existing] = await sql`select id from saas_tenant where tenant_code = ${TENANT_CODE}`;
if (existing && !reset) {
  console.log("Tenant DEMO sudah ada. Jalankan dengan --reset untuk mengisi ulang.");
  process.exit(0);
}
if (reset) await wipe();

// --- Tenant, paket, lokasi ---
const [tenant] = await sql`
  insert into saas_tenant (tenant_code, tenant_name, legal_name, timezone)
  values (${TENANT_CODE}, ${"Demo Corp"}, ${"PT Demo Sejahtera"}, ${"Asia/Jakarta"}) returning id`;
const tenantId = tenant.id;

const [plan] = await sql`
  insert into saas_plan (plan_code, plan_name, max_rooms)
  values (${"DEMO_PRO"}, ${"Demo Pro"}, ${50})
  on conflict (plan_code) do update set plan_name = excluded.plan_name returning id`;
await sql`insert into saas_subscription (tenant_id, plan_id, started_at) values (${tenantId}, ${plan.id}, now())`;

const [loc] = await sql`
  insert into org_location (tenant_id, location_code, location_name, address, timezone)
  values (${tenantId}, ${"HQ"}, ${"Kantor Pusat"}, ${"Jakarta"}, ${"Asia/Jakarta"}) returning id`;

// --- Pengaturan tenant: pengumuman, parameter layar TV, dan token akses layar ---
const displayToken = randomBytes(18).toString("base64url");
await sql`
  insert into saas_tenant_setting (tenant_id, settings)
  values (${tenantId}, ${JSON.stringify({
    announcements: [
      "Harap hadir tepat waktu dan menyiapkan materi rapat.",
      "Ruang rapat dapat berubah sewaktu-waktu.",
      "Untuk informasi lebih lanjut, hubungi Tim GA.",
    ],
    display: { soonMinutes: 30, pageSize: 8, rotateSeconds: 12, refreshSeconds: 60 },
    displayToken,
  })}::jsonb)`;

// --- Departemen ---
const deptDefs = [
  ["OPS", "Operations Team"], ["MKT", "Marketing Team"], ["SLS", "Sales Team"],
  ["PRD", "Product Team"], ["ECM", "Ecommerce Team"], ["LOG", "Logistic Team"],
  ["IT", "IT Team"], ["BOD", "Direksi"], ["GA", "General Affair"],
];
const dept = {};
for (const [code, name] of deptDefs) {
  const [r] = await sql`
    insert into org_department (tenant_id, department_code, department_name)
    values (${tenantId}, ${code}, ${name}) returning id`;
  dept[code] = r.id;
}

// --- Izin (global) dan peran (per tenant) ---
const perm = {};
for (const p of PERMISSION_DEFS) {
  const [r] = await sql`
    insert into iam_permission (permission_code, permission_name, module)
    values (${p.code}, ${p.name}, ${p.module})
    on conflict (permission_code) do update set permission_name = excluded.permission_name, module = excluded.module
    returning id`;
  perm[p.code] = r.id;
}
const role = {};
for (const r of ROLE_DEFS) {
  const [row] = await sql`
    insert into iam_role (tenant_id, role_code, role_name, description, is_system)
    values (${tenantId}, ${r.code}, ${r.name}, ${r.description}, ${true}) returning id`;
  role[r.code] = row.id;
  for (const [code, scope] of Object.entries(r.permissions)) {
    await sql`insert into iam_role_permission (role_id, permission_id) values (${row.id}, ${perm[code]})`;
    if (scope) {
      await sql`insert into iam_role_scope (role_id, permission_id, scope_type) values (${row.id}, ${perm[code]}, ${scope})`;
    }
  }
}

// --- User + member + peran. Semua password demo sama: lihat DEMO_PASSWORD. ---
const people = [
  ["admin", "Admin Demo", "IT", "Administrator", "TENANT_ADMIN"],
  ["ga", "Rina Kusuma", "GA", "Staf General Affair", "GA_STAFF"],
  ["mgmt", "Management Team", "BOD", "Sekretaris Direksi", "APPROVER"],
  ["budi", "Budi Setiawan", "OPS", "Operations Manager", "EMPLOYEE"],
  ["sarah", "Sarah Anindita", "MKT", "Marketing Lead", "DEPT_HEAD"],
  ["dimas", "Dimas Pratama", "SLS", "Sales Manager", "DEPT_HEAD"],
  ["maya", "Maya Lestari", "PRD", "Product Manager", "EMPLOYEE"],
  ["rafli", "Rafli Hidayat", "ECM", "Ecommerce Lead", "EMPLOYEE"],
  ["andi", "Andi Prakoso", "LOG", "Logistic Supervisor", "EMPLOYEE"],
  ["nadia", "Nadia Rahma", "IT", "IT Specialist", "EMPLOYEE"],
];
const passwordHash = await hashPassword(DEMO_PASSWORD);
const member = {};
const userId = {};
for (const [key, fullName, d, title, roleCode] of people) {
  const [u] = await sql`
    insert into iam_user (username, full_name, email, password_hash)
    values (${"demo." + key}, ${fullName}, ${key + "@demo.test"}, ${passwordHash}) returning id`;
  const [m] = await sql`
    insert into iam_tenant_member (tenant_id, user_id, employee_code, department_id, job_title)
    values (${tenantId}, ${u.id}, ${"EMP-" + key.toUpperCase()}, ${dept[d]}, ${title}) returning id`;
  await sql`insert into iam_member_role (member_id, role_id, assigned_by) values (${m.id}, ${role[roleCode]}, ${userId.admin ?? u.id})`;
  member[key] = m.id;
  userId[key] = u.id;
}
const adminUser = userId.admin;

// --- Tipe rapat ---
const typeDefs = [
  ["INTERNAL", "Rapat Internal", false],
  ["TRAINING", "Training", false],
  ["BOARD", "Rapat Direksi", true],
];
const mtype = {};
for (const [code, name, approval] of typeDefs) {
  const [r] = await sql`
    insert into meeting_type (tenant_id, type_code, type_name, require_approval)
    values (${tenantId}, ${code}, ${name}, ${approval}) returning id`;
  mtype[code] = r.id;
}

// --- Ruangan dan fasilitas ---
const roomDefs = [
  ["JKT", "Ruang Jakarta", "Lantai 2", 12], ["BDG", "Ruang Bandung", "Lantai 2", 10],
  ["SMG", "Ruang Semarang", "Lantai 1", 8], ["SBY", "Ruang Surabaya", "Lantai 1", 8],
  ["MDN", "Ruang Medan", "Lantai 2", 6], ["MKS", "Ruang Makassar", "Lantai 1", 6],
  ["TGR", "Ruang Tangerang", "Lantai 2", 20], ["BLT", "Ruang Belitung", "Lantai 1", 14],
];
const room = {};
for (const [code, name, floor, cap] of roomDefs) {
  const [r] = await sql`
    insert into meeting_room (tenant_id, location_id, room_code, room_name, floor, capacity, created_by)
    values (${tenantId}, ${loc.id}, ${code}, ${name}, ${floor}, ${cap}, ${adminUser}) returning id`;
  room[code] = r.id;
}
const facilityDefs = [
  ["PROJ", "Proyektor"], ["TV", "TV Layar Besar"], ["WB", "Whiteboard"],
  ["VC", "Video Conference"], ["SND", "Sound System"],
];
const facility = {};
for (const [code, name] of facilityDefs) {
  const [r] = await sql`
    insert into meeting_facility (tenant_id, facility_code, facility_name)
    values (${tenantId}, ${code}, ${name}) returning id`;
  facility[code] = r.id;
}
const roomFacilities = {
  JKT: ["PROJ", "WB", "VC"], BDG: ["TV", "WB"], SMG: ["TV"], SBY: ["WB"],
  MDN: ["TV"], MKS: ["WB"], TGR: ["PROJ", "SND", "VC", "WB"], BLT: ["PROJ", "VC", "SND"],
};
for (const [rc, list] of Object.entries(roomFacilities)) {
  for (const fc of list) {
    await sql`insert into meeting_room_facility (room_id, facility_id) values (${room[rc]}, ${facility[fc]})`;
  }
}

// --- Booking (satu statement atomik: booking + reservasi + riwayat status) ---
let seq = 0;
async function addBooking(b) {
  const bookingNo = `BK-${b.date.replaceAll("-", "")}-${String(++seq).padStart(3, "0")}`;
  const start = ts(b.date, b.from);
  const end = ts(b.date, b.to);
  const [row] = await sql`
    with nb as (
      insert into meeting_booking
        (tenant_id, booking_no, room_id, organizer_member_id, meeting_type_id, title, agenda,
         start_at, end_at, participant_count, status, cancellation_reason, created_by)
      values (${tenantId}, ${bookingNo}, ${room[b.room]}, ${member[b.org]}, ${mtype[b.type]}, ${b.title},
              ${b.agenda}, ${start}::timestamptz, ${end}::timestamptz, ${b.pax}, ${b.status},
              ${b.reason ?? null}, ${adminUser})
      returning id, tenant_id, room_id, start_at, end_at, status
    ), r as (
      insert into meeting_room_reservation (tenant_id, room_id, booking_id, reservation_type, during, status)
      select tenant_id, room_id, id, 'BOOKING', tstzrange(start_at, end_at, '[)'),
             case when status in ('REJECTED', 'CANCELLED', 'NO_SHOW') then 'CANCELLED' else 'ACTIVE' end
      from nb
    ), h as (
      insert into meeting_booking_status_history (tenant_id, booking_id, old_status, new_status, reason, changed_by)
      select tenant_id, id, null, status, ${"Data demo"}, ${adminUser} from nb
    )
    select id from nb`;
  return row.id;
}

const rows = [
  // Hari ini: sama dengan 8 baris pada desain layar TV.
  { date: today, from: "08:00", to: "09:00", room: "JKT", org: "budi", type: "INTERNAL", title: "Weekly Operational Review", agenda: "Review kinerja dan rencana minggu ini", pax: 8, status: "APPROVED" },
  { date: today, from: "09:00", to: "10:00", room: "BDG", org: "sarah", type: "INTERNAL", title: "Marketing Campaign 12.12", agenda: "Pembahasan strategi kampanye", pax: 6, status: "APPROVED" },
  { date: today, from: "10:00", to: "11:00", room: "SMG", org: "dimas", type: "INTERNAL", title: "Review Penjualan & Target Q4", agenda: "Evaluasi penjualan dan rencana Q4", pax: 7, status: "APPROVED" },
  { date: today, from: "11:00", to: "12:00", room: "SBY", org: "maya", type: "INTERNAL", title: "Pengembangan Produk Baru", agenda: "Diskusi kebutuhan produk ibu dan anak", pax: 5, status: "APPROVED" },
  { date: today, from: "13:00", to: "14:00", room: "MDN", org: "rafli", type: "INTERNAL", title: "Evaluasi Program Affiliate", agenda: "Hasil program dan rencana pengembangan", pax: 5, status: "APPROVED" },
  { date: today, from: "14:00", to: "15:00", room: "MKS", org: "andi", type: "INTERNAL", title: "Persiapan Pembukaan Gudang", agenda: "Gudang Makassar & Tangerang", pax: 6, status: "APPROVED" },
  { date: today, from: "15:00", to: "16:00", room: "TGR", org: "nadia", type: "TRAINING", title: "Training Sistem ERP", agenda: "Pengenalan modul dan simulasi", pax: 18, status: "APPROVED" },
  { date: today, from: "16:00", to: "17:00", room: "BLT", org: "mgmt", type: "BOARD", title: "Rapat Direksi", agenda: "Pembahasan strategi perusahaan", pax: 10, status: "POSTPONED" },
  // Menunggu persetujuan, untuk mencoba alur approve / reject.
  { date: today, from: "17:00", to: "18:00", room: "JKT", org: "sarah", type: "BOARD", title: "Presentasi Anggaran Marketing", agenda: "Pengajuan anggaran Q1", pax: 9, status: "PENDING" },
  { date: tomorrow, from: "09:00", to: "10:30", room: "BDG", org: "dimas", type: "INTERNAL", title: "Sales Kickoff", agenda: "Target dan pembagian wilayah", pax: 8, status: "PENDING" },
  { date: tomorrow, from: "13:00", to: "15:00", room: "TGR", org: "nadia", type: "TRAINING", title: "Workshop Keamanan Data", agenda: "Awareness keamanan informasi", pax: 20, status: "APPROVED" },
  // Contoh yang sudah dibatalkan (slotnya dilepas).
  { date: tomorrow, from: "10:00", to: "11:00", room: "SMG", org: "andi", type: "INTERNAL", title: "Rapat Vendor Ekspedisi", agenda: "Negosiasi tarif", pax: 4, status: "CANCELLED", reason: "Vendor berhalangan hadir" },
];
const ids = [];
for (const b of rows) ids.push(await addBooking(b));

// Contoh peserta pada rapat pertama dan rapat training.
for (const [bid, list] of [
  [ids[0], [["budi", null], ["andi", null], [null, ["Konsultan Eksternal", "konsultan@mitra.test"]]]],
  [ids[6], [["nadia", null], ["maya", null], ["rafli", null]]],
]) {
  for (const [key, ext] of list) {
    const name = key ? people.find((p) => p[0] === key)[1] : ext[0];
    await sql`
      insert into meeting_participant (tenant_id, booking_id, member_id, participant_name, email, participant_type, invited_at)
      values (${tenantId}, ${bid}, ${key ? member[key] : null}, ${name}, ${key ? key + "@demo.test" : ext[1]},
              ${key ? "INTERNAL" : "EXTERNAL"}, now())`;
  }
}

const [{ n: nBooking }] = await sql`select count(*)::int n from meeting_booking where tenant_id = ${tenantId}`;
console.log(`Seed selesai: tenant ${TENANT_CODE} (id ${tenantId}), ${roomDefs.length} ruangan, ${nBooking} booking.`);
console.log(`Login demo: username demo.<nama> (mis. demo.admin, demo.ga, demo.budi), password: ${DEMO_PASSWORD}`);
console.log(`Layar TV: /display/${TENANT_CODE}?key=${displayToken}`);
