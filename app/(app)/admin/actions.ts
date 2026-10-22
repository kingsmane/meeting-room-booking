"use server";

// Server Action administrasi: ruangan, blokir, data master, pengguna, pengaturan, dan akun sendiri.
// Pola yang sama dengan app/(app)/actions.ts: izin -> validasi input -> operasi -> audit.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  iamRole,
  iamTenantMember,
  iamUser,
  meetingFacility,
  meetingRoom,
  meetingType,
  orgDepartment,
  orgLocation,
  saasPlan,
  saasSubscription,
} from "@/db/schema";
import { requirePermission, requireUser } from "@/lib/auth";
import { audit, rowsOf } from "@/lib/audit";
import { countActiveRooms } from "@/lib/data";
import { hashPassword, verifyPassword } from "@/lib/password.mjs";
import { isRoomStatus, isDateString, isTimeString, toTimestamptz } from "@/lib/booking";
import { DISPLAY_LIMITS, newDisplayToken, normalizeSettings, patchSettings } from "@/lib/settings";
import type { FormState } from "@/components/action-form";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => Number(str(fd, key));
const CODE = /^[A-Z0-9_-]{2,20}$/;

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

function bigintArray(ids: number[]) {
  const safe = ids.filter((n) => Number.isInteger(n));
  return safe.length
    ? sql`ARRAY[${sql.join(safe.map((n) => sql`${n}`), sql`, `)}]::bigint[]`
    : sql`ARRAY[]::bigint[]`;
}

function validPassword(p: string): string | null {
  if (p.length < 8) return "Password minimal 8 karakter.";
  if (p.length > 100) return "Password terlalu panjang.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password harus mengandung huruf dan angka.";
  return null;
}

// ---------- Ruangan ----------

export async function setRoomStatus(fd: FormData) {
  const user = await requirePermission("room.manage");
  const id = num(fd, "id");
  const to = str(fd, "to");
  if (!Number.isInteger(id) || !isRoomStatus(to)) throw new Error("Permintaan tidak valid.");

  const [old] = await db
    .select({ status: meetingRoom.status })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.id, id), eq(meetingRoom.tenantId, user.tenantId)));
  if (!old) throw new Error("Ruangan tidak ditemukan.");

  await db
    .update(meetingRoom)
    .set({ status: to, updatedAt: new Date().toISOString(), updatedBy: user.userId })
    .where(and(eq(meetingRoom.id, id), eq(meetingRoom.tenantId, user.tenantId)));
  await audit(user, { module: "room", table: "meeting_room", recordId: id, action: "STATUS", oldData: old, newData: { status: to } });
  revalidatePath("/admin/rooms");
}

export async function createRoom(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("room.manage");
  const code = str(fd, "code").toUpperCase();
  const name = str(fd, "name");
  const floor = str(fd, "floor");
  const capacity = num(fd, "capacity");
  const locationId = num(fd, "locationId");

  if (!CODE.test(code)) return { error: "Kode ruangan 2-20 karakter (huruf, angka, - atau _)." };
  if (!name || name.length > 150) return { error: "Nama ruangan wajib diisi (maksimal 150 karakter)." };
  if (floor.length > 50) return { error: "Lantai maksimal 50 karakter." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return { error: "Kapasitas 1–1000." };

  const [loc] = await db
    .select({ id: orgLocation.id })
    .from(orgLocation)
    .where(and(eq(orgLocation.id, locationId), eq(orgLocation.tenantId, user.tenantId)));
  if (!loc) return { error: "Lokasi tidak ditemukan." };

  // Kuota paket langganan.
  const [plan] = await db
    .select({ max: saasPlan.maxRooms })
    .from(saasSubscription)
    .innerJoin(saasPlan, eq(saasPlan.id, saasSubscription.planId))
    .where(eq(saasSubscription.tenantId, user.tenantId))
    .limit(1);
  if (plan?.max != null && (await countActiveRooms(user.tenantId)) >= plan.max) {
    return { error: `Kuota ruangan paket Anda (${plan.max}) sudah penuh.` };
  }

  try {
    const [row] = await db
      .insert(meetingRoom)
      .values({
        tenantId: user.tenantId,
        locationId: loc.id,
        roomCode: code,
        roomName: name,
        floor: floor || null,
        capacity,
        createdBy: user.userId,
      })
      .returning({ id: meetingRoom.id });
    await audit(user, { module: "room", table: "meeting_room", recordId: row.id, action: "CREATE", newData: { code, name, capacity } });
  } catch (e) {
    if (pgCode(e) === "23505") return { error: `Kode ruangan ${code} sudah dipakai.` };
    console.error("createRoom gagal", e);
    return { error: "Gagal menyimpan ruangan. Coba lagi." };
  }
  revalidatePath("/admin/rooms");
  return { ok: "Ruangan ditambahkan." };
}

export async function updateRoom(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("room.manage");
  const id = num(fd, "id");
  const name = str(fd, "name");
  const floor = str(fd, "floor");
  const description = str(fd, "description");
  const capacity = num(fd, "capacity");
  const facilityIds = fd.getAll("facilities").map(Number).filter(Number.isInteger);

  if (!Number.isInteger(id)) return { error: "Permintaan tidak valid." };
  if (!name || name.length > 150) return { error: "Nama ruangan wajib diisi (maksimal 150 karakter)." };
  if (floor.length > 50 || description.length > 1000) return { error: "Isian terlalu panjang." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return { error: "Kapasitas 1–1000." };

  const [old] = await db
    .select({ name: meetingRoom.roomName, capacity: meetingRoom.capacity, floor: meetingRoom.floor })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.id, id), eq(meetingRoom.tenantId, user.tenantId)));
  if (!old) return { error: "Ruangan tidak ditemukan." };

  await db
    .update(meetingRoom)
    .set({
      roomName: name,
      floor: floor || null,
      description: description || null,
      capacity,
      updatedAt: new Date().toISOString(),
      updatedBy: user.userId,
    })
    .where(and(eq(meetingRoom.id, id), eq(meetingRoom.tenantId, user.tenantId)));

  // Fasilitas diganti seluruhnya; hanya fasilitas milik tenant ini yang diterima.
  await db.execute(sql`
    with del as (delete from meeting_room_facility where room_id = ${id})
    insert into meeting_room_facility (room_id, facility_id)
    select ${id}, f.id from meeting_facility f
    where f.tenant_id = ${user.tenantId} and f.id = any(${bigintArray(facilityIds)})
  `);
  await audit(user, { module: "room", table: "meeting_room", recordId: id, action: "UPDATE", oldData: old, newData: { name, floor, capacity, facilityIds } });
  revalidatePath("/admin/rooms", "layout");
  return { ok: "Ruangan diperbarui." };
}

export async function createBlock(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("room.manage");
  const roomId = num(fd, "roomId");
  const type = str(fd, "blockType");
  const reason = str(fd, "reason");
  const [d1, t1, d2, t2] = [str(fd, "startDate"), str(fd, "startTime"), str(fd, "endDate"), str(fd, "endTime")];

  if (!Number.isInteger(roomId)) return { error: "Permintaan tidak valid." };
  if (!["MAINTENANCE", "EVENT", "PRIVATE", "OTHER"].includes(type)) return { error: "Jenis blokir tidak valid." };
  if (!reason || reason.length > 255) return { error: "Alasan wajib diisi (maksimal 255 karakter)." };
  if (!isDateString(d1) || !isDateString(d2) || !isTimeString(t1) || !isTimeString(t2)) {
    return { error: "Tanggal atau jam tidak valid." };
  }
  const start = toTimestamptz(d1, t1);
  const end = toTimestamptz(d2, t2);
  if (new Date(end) <= new Date(start)) return { error: "Waktu selesai harus setelah waktu mulai." };

  const [room] = await db
    .select({ id: meetingRoom.id })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.id, roomId), eq(meetingRoom.tenantId, user.tenantId)));
  if (!room) return { error: "Ruangan tidak ditemukan." };

  // Blokir memakai tabel reservasi yang sama dengan booking, sehingga exclusion constraint
  // otomatis menolak blokir yang menimpa booking aktif (dan sebaliknya).
  try {
    const res = await db.execute(sql`
      with nb as (
        insert into meeting_room_block (tenant_id, room_id, reason, block_type, start_at, end_at, created_by)
        values (${user.tenantId}, ${roomId}, ${reason}, ${type}, ${start}::timestamptz, ${end}::timestamptz, ${user.userId})
        returning id, tenant_id, room_id, start_at, end_at
      ), r as (
        insert into meeting_room_reservation (tenant_id, room_id, block_id, reservation_type, during, status)
        select tenant_id, room_id, id, 'BLOCK', tstzrange(start_at, end_at, '[)'), 'ACTIVE' from nb
      )
      select id from nb
    `);
    await audit(user, {
      module: "room",
      table: "meeting_room_block",
      recordId: Number(rowsOf(res)[0]?.id),
      action: "BLOCK_CREATE",
      newData: { roomId, type, reason, start, end },
    });
  } catch (e) {
    if (pgCode(e) === "23P01") {
      return { error: "Ada booking aktif pada rentang waktu tersebut. Batalkan atau pindahkan booking itu dulu." };
    }
    console.error("createBlock gagal", e);
    return { error: "Gagal menyimpan blokir. Coba lagi." };
  }
  revalidatePath(`/admin/rooms/${roomId}`);
  return { ok: "Blokir ditambahkan." };
}

export async function cancelBlock(fd: FormData) {
  const user = await requirePermission("room.manage");
  const id = num(fd, "id");
  const roomId = num(fd, "roomId");
  if (!Number.isInteger(id)) throw new Error("Permintaan tidak valid.");
  await db.execute(sql`
    with b as (
      update meeting_room_block set status = 'CANCELLED'
      where id = ${id} and tenant_id = ${user.tenantId} and status = 'ACTIVE' returning id
    )
    update meeting_room_reservation set status = 'CANCELLED' where block_id in (select id from b)
  `);
  await audit(user, { module: "room", table: "meeting_room_block", recordId: id, action: "BLOCK_CANCEL" });
  revalidatePath(`/admin/rooms/${roomId}`);
}

// ---------- Data master ----------

type Entity = "department" | "type" | "facility" | "location";
const ENTITIES: Entity[] = ["department", "type", "facility", "location"];
const isEntity = (v: string): v is Entity => (ENTITIES as string[]).includes(v);

export async function addMaster(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("master.manage");
  const entity = str(fd, "entity");
  const code = str(fd, "code").toUpperCase();
  const name = str(fd, "name");
  if (!isEntity(entity)) return { error: "Permintaan tidak valid." };
  if (!CODE.test(code)) return { error: "Kode 2-20 karakter (huruf, angka, - atau _)." };
  if (!name || name.length > 150) return { error: "Nama wajib diisi (maksimal 150 karakter)." };

  try {
    if (entity === "department") {
      await db.insert(orgDepartment).values({ tenantId: user.tenantId, departmentCode: code, departmentName: name });
    } else if (entity === "type") {
      await db.insert(meetingType).values({
        tenantId: user.tenantId,
        typeCode: code,
        typeName: name,
        requireApproval: fd.get("requireApproval") === "on",
      });
    } else if (entity === "facility") {
      await db.insert(meetingFacility).values({ tenantId: user.tenantId, facilityCode: code, facilityName: name });
    } else {
      await db.insert(orgLocation).values({
        tenantId: user.tenantId,
        locationCode: code,
        locationName: name,
        timezone: "Asia/Jakarta",
      });
    }
  } catch (e) {
    if (pgCode(e) === "23505") return { error: `Kode ${code} sudah dipakai.` };
    console.error("addMaster gagal", e);
    return { error: "Gagal menyimpan. Coba lagi." };
  }
  await audit(user, { module: "master", table: entity, action: "CREATE", newData: { code, name } });
  revalidatePath("/admin/master");
  return { ok: "Data ditambahkan." };
}

// field "active": aktif/nonaktif; field "approval": hanya untuk tipe rapat.
export async function toggleMaster(fd: FormData) {
  const user = await requirePermission("master.manage");
  const entity = str(fd, "entity");
  const field = str(fd, "field");
  const id = num(fd, "id");
  if (!isEntity(entity) || !Number.isInteger(id) || !["active", "approval"].includes(field)) {
    throw new Error("Permintaan tidak valid.");
  }
  const t = user.tenantId;

  if (entity === "type" && field === "approval") {
    await db.execute(sql`update meeting_type set require_approval = not require_approval where id = ${id} and tenant_id = ${t}`);
  } else if (field === "active") {
    if (entity === "department") {
      await db.execute(sql`update org_department set is_active = not is_active where id = ${id} and tenant_id = ${t}`);
    } else if (entity === "type") {
      await db.execute(sql`update meeting_type set is_active = not is_active where id = ${id} and tenant_id = ${t}`);
    } else if (entity === "facility") {
      await db.execute(sql`update meeting_facility set is_active = not is_active where id = ${id} and tenant_id = ${t}`);
    } else {
      await db.execute(sql`update org_location set is_active = not is_active where id = ${id} and tenant_id = ${t}`);
    }
  } else {
    throw new Error("Permintaan tidak valid.");
  }
  await audit(user, { module: "master", table: entity, recordId: id, action: `TOGGLE_${field.toUpperCase()}` });
  revalidatePath("/admin/master");
}

// ---------- Pengguna ----------

// Jumlah admin tenant yang aktif, dipakai untuk mencegah tenant kehilangan admin terakhirnya.
async function activeAdminCount(tenantId: number) {
  const res = await db.execute(sql`
    select count(distinct m.id)::int as n
    from iam_tenant_member m
    join iam_user u on u.id = m.user_id and u.status = 'ACTIVE'
    join iam_member_role mr on mr.member_id = m.id
    join iam_role r on r.id = mr.role_id and r.role_code = 'TENANT_ADMIN' and r.is_active
    where m.tenant_id = ${tenantId} and m.status = 'ACTIVE'
  `);
  return Number(rowsOf(res)[0]?.n ?? 0);
}

async function isAdminMember(tenantId: number, memberId: number) {
  const res = await db.execute(sql`
    select 1 from iam_member_role mr join iam_role r on r.id = mr.role_id
    where mr.member_id = ${memberId} and r.role_code = 'TENANT_ADMIN' and r.tenant_id = ${tenantId}
  `);
  return rowsOf(res).length > 0;
}

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("user.manage");
  const fullName = str(fd, "fullName");
  const username = str(fd, "username").toLowerCase();
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const jobTitle = str(fd, "jobTitle");
  const employeeCode = str(fd, "employeeCode");
  const roleId = num(fd, "roleId");
  const departmentRaw = str(fd, "departmentId");
  const departmentId = departmentRaw ? Number(departmentRaw) : null;

  if (!fullName || fullName.length > 150) return { error: "Nama lengkap wajib diisi." };
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) return { error: "Username 3-50 karakter: huruf kecil, angka, titik, - atau _." };
  if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Format email tidak valid." };
  const pwErr = validPassword(password);
  if (pwErr) return { error: pwErr };
  if (jobTitle.length > 100 || employeeCode.length > 50) return { error: "Isian terlalu panjang." };

  const [role] = await db
    .select({ id: iamRole.id })
    .from(iamRole)
    .where(and(eq(iamRole.id, roleId), eq(iamRole.tenantId, user.tenantId), eq(iamRole.isActive, true)));
  if (!role) return { error: "Peran tidak valid." };
  if (departmentId !== null) {
    const [d] = await db
      .select({ id: orgDepartment.id })
      .from(orgDepartment)
      .where(and(eq(orgDepartment.id, departmentId), eq(orgDepartment.tenantId, user.tenantId)));
    if (!d) return { error: "Departemen tidak valid." };
  }

  const hash = await hashPassword(password);
  try {
    const res = await db.execute(sql`
      with u as (
        insert into iam_user (username, full_name, email, password_hash)
        values (${username}, ${fullName}, ${email || null}, ${hash}) returning id
      ), m as (
        insert into iam_tenant_member (tenant_id, user_id, employee_code, department_id, job_title)
        select ${user.tenantId}, u.id, ${employeeCode || null}, ${departmentId}::bigint, ${jobTitle || null} from u
        returning id
      ), mr as (
        insert into iam_member_role (member_id, role_id, assigned_by) select m.id, ${role.id}, ${user.userId} from m
      )
      select m.id from m
    `);
    await audit(user, {
      module: "user",
      table: "iam_user",
      recordId: Number(rowsOf(res)[0]?.id),
      action: "CREATE",
      newData: { username, fullName, roleId: role.id, departmentId },
    });
  } catch (e) {
    if (pgCode(e) === "23505") return { error: `Username ${username} sudah dipakai.` };
    console.error("createUser gagal", e);
    return { error: "Gagal menyimpan pengguna. Coba lagi." };
  }
  revalidatePath("/admin/users");
  return { ok: `Pengguna ${username} dibuat.` };
}

export async function changeUserRole(fd: FormData) {
  const user = await requirePermission("user.manage");
  const memberId = num(fd, "memberId");
  const roleId = num(fd, "roleId");
  if (!Number.isInteger(memberId) || !Number.isInteger(roleId)) throw new Error("Permintaan tidak valid.");
  if (memberId === user.memberId) redirect("/admin/users?err=" + encodeURIComponent("Anda tidak dapat mengubah peran sendiri."));

  const [member] = await db
    .select({ id: iamTenantMember.id })
    .from(iamTenantMember)
    .where(and(eq(iamTenantMember.id, memberId), eq(iamTenantMember.tenantId, user.tenantId)));
  const [role] = await db
    .select({ id: iamRole.id, code: iamRole.roleCode })
    .from(iamRole)
    .where(and(eq(iamRole.id, roleId), eq(iamRole.tenantId, user.tenantId), eq(iamRole.isActive, true)));
  if (!member || !role) redirect("/admin/users?err=" + encodeURIComponent("Data tidak valid."));

  if (role.code !== "TENANT_ADMIN" && (await isAdminMember(user.tenantId, memberId)) && (await activeAdminCount(user.tenantId)) <= 1) {
    redirect("/admin/users?err=" + encodeURIComponent("Tidak dapat menghapus Administrator terakhir."));
  }

  await db.execute(sql`
    with del as (delete from iam_member_role where member_id = ${memberId})
    insert into iam_member_role (member_id, role_id, assigned_by) values (${memberId}, ${roleId}, ${user.userId})
  `);
  await audit(user, { module: "user", table: "iam_member_role", recordId: memberId, action: "ROLE_CHANGE", newData: { roleId, role: role.code } });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function setMemberActive(fd: FormData) {
  const user = await requirePermission("user.manage");
  const memberId = num(fd, "memberId");
  const active = str(fd, "active") === "true";
  if (!Number.isInteger(memberId)) throw new Error("Permintaan tidak valid.");
  if (memberId === user.memberId) redirect("/admin/users?err=" + encodeURIComponent("Anda tidak dapat menonaktifkan akun sendiri."));
  if (!active && (await isAdminMember(user.tenantId, memberId)) && (await activeAdminCount(user.tenantId)) <= 1) {
    redirect("/admin/users?err=" + encodeURIComponent("Tidak dapat menonaktifkan Administrator terakhir."));
  }

  await db
    .update(iamTenantMember)
    .set({ status: active ? "ACTIVE" : "INACTIVE", leftAt: active ? null : new Date().toISOString() })
    .where(and(eq(iamTenantMember.id, memberId), eq(iamTenantMember.tenantId, user.tenantId)));
  await audit(user, { module: "user", table: "iam_tenant_member", recordId: memberId, action: active ? "ACTIVATE" : "DEACTIVATE" });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("user.manage");
  const memberId = num(fd, "memberId");
  const password = String(fd.get("password") ?? "");
  const pwErr = validPassword(password);
  if (pwErr) return { error: pwErr };

  const [m] = await db
    .select({ userId: iamTenantMember.userId })
    .from(iamTenantMember)
    .where(and(eq(iamTenantMember.id, memberId), eq(iamTenantMember.tenantId, user.tenantId)));
  if (!m) return { error: "Pengguna tidak ditemukan." };

  await db.update(iamUser).set({ passwordHash: await hashPassword(password) }).where(eq(iamUser.id, m.userId));
  await audit(user, { module: "user", table: "iam_user", recordId: m.userId, action: "PASSWORD_RESET" });
  return { ok: "Password diganti." };
}

// ---------- Akun sendiri ----------

export async function changeOwnPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (next !== confirm) return { error: "Konfirmasi password tidak sama." };
  const pwErr = validPassword(next);
  if (pwErr) return { error: pwErr };

  const [row] = await db.select({ hash: iamUser.passwordHash }).from(iamUser).where(eq(iamUser.id, user.userId));
  if (!(await verifyPassword(current, row?.hash))) return { error: "Password saat ini salah." };

  await db.update(iamUser).set({ passwordHash: await hashPassword(next) }).where(eq(iamUser.id, user.userId));
  await audit(user, { module: "user", table: "iam_user", recordId: user.userId, action: "PASSWORD_CHANGE" });
  return { ok: "Password diganti." };
}

// ---------- Pengaturan ----------

export async function saveAnnouncements(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings.manage");
  const lines = String(fd.get("announcements") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 10) return { error: "Maksimal 10 pengumuman." };
  if (lines.some((l) => l.length > 200)) return { error: "Setiap pengumuman maksimal 200 karakter." };

  await patchSettings(user.tenantId, { announcements: lines });
  await audit(user, { module: "settings", table: "saas_tenant_setting", action: "ANNOUNCEMENTS", newData: { count: lines.length } });
  revalidatePath("/admin/settings");
  return { ok: "Pengumuman disimpan. Layar TV akan memperbaruinya dalam beberapa saat." };
}

export async function saveDisplay(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("settings.manage");
  const values: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(DISPLAY_LIMITS)) {
    const n = num(fd, key);
    if (!Number.isInteger(n) || n < min || n > max) return { error: `Nilai ${key} harus ${min}–${max}.` };
    values[key] = n;
  }
  await patchSettings(user.tenantId, { display: normalizeSettings({ display: values }).display });
  await audit(user, { module: "settings", table: "saas_tenant_setting", action: "DISPLAY", newData: values });
  revalidatePath("/admin/settings");
  return { ok: "Pengaturan layar disimpan." };
}

export async function regenerateDisplayToken() {
  const user = await requirePermission("settings.manage");
  await patchSettings(user.tenantId, { displayToken: newDisplayToken() });
  await audit(user, { module: "settings", table: "saas_tenant_setting", action: "DISPLAY_TOKEN_ROTATE" });
  revalidatePath("/admin/settings");
}
