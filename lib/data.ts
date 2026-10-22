// Query baca. Hanya dipakai dari Server Component / Server Action.
// Fungsi yang menerima SessionUser menerapkan scope booking.view (OWN / DEPARTMENT / ALL).
import { and, asc, desc, eq, exists, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  auditLogin,
  iamMemberRole,
  iamRole,
  iamTenantMember,
  iamUser,
  meetingApproval,
  meetingBooking,
  meetingBookingStatusHistory,
  meetingCheckin,
  meetingFacility,
  meetingParticipant,
  meetingRoom,
  meetingRoomBlock,
  meetingRoomFacility,
  meetingType,
  notification,
  orgDepartment,
  orgLocation,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// ---------- Booking ----------

const bookingColumns = {
  id: meetingBooking.id,
  bookingNo: meetingBooking.bookingNo,
  title: meetingBooking.title,
  agenda: meetingBooking.agenda,
  specialRequest: meetingBooking.specialRequest,
  startAt: meetingBooking.startAt,
  endAt: meetingBooking.endAt,
  status: meetingBooking.status,
  participantCount: meetingBooking.participantCount,
  cancellationReason: meetingBooking.cancellationReason,
  seriesId: meetingBooking.seriesId,
  organizerMemberId: meetingBooking.organizerMemberId,
  roomId: meetingBooking.roomId,
  roomName: meetingRoom.roomName,
  floor: meetingRoom.floor,
  organizer: iamUser.fullName,
  organizerUserId: iamUser.id,
  department: orgDepartment.departmentName,
  typeName: meetingType.typeName,
  requireApproval: meetingType.requireApproval,
};

function bookingQuery() {
  return db
    .select(bookingColumns)
    .from(meetingBooking)
    .innerJoin(meetingRoom, eq(meetingBooking.roomId, meetingRoom.id))
    .innerJoin(iamTenantMember, eq(meetingBooking.organizerMemberId, iamTenantMember.id))
    .innerJoin(iamUser, eq(iamTenantMember.userId, iamUser.id))
    .leftJoin(orgDepartment, eq(iamTenantMember.departmentId, orgDepartment.id))
    .leftJoin(meetingType, eq(meetingBooking.meetingTypeId, meetingType.id));
}

// Batas data yang boleh dilihat user. Dipakai oleh daftar maupun halaman detail.
function scopeCondition(user: SessionUser): SQL {
  if (user.bookingScope === "ALL") return sql`true`;
  const own = eq(meetingBooking.organizerMemberId, user.memberId);
  if (user.bookingScope === "DEPARTMENT") {
    return user.departmentId
      ? (or(own, eq(iamTenantMember.departmentId, user.departmentId)) as SQL)
      : own;
  }
  return or(
    own,
    exists(
      db
        .select({ one: sql`1` })
        .from(meetingParticipant)
        .where(
          and(
            eq(meetingParticipant.bookingId, meetingBooking.id),
            eq(meetingParticipant.memberId, user.memberId),
          ),
        ),
    ),
  ) as SQL;
}

const notDeleted = isNull(meetingBooking.deletedAt);

export async function listBookings(user: SessionUser, date: string) {
  return bookingQuery()
    .where(
      and(
        eq(meetingBooking.tenantId, user.tenantId),
        notDeleted,
        scopeCondition(user),
        sql`(${meetingBooking.startAt} at time zone 'Asia/Jakarta')::date = ${date}::date`,
      ),
    )
    .orderBy(asc(meetingBooking.startAt), asc(meetingRoom.roomName));
}

// Booking milik user (sebagai penyelenggara) mulai 7 hari terakhir sampai mendatang.
export async function listMyBookings(user: SessionUser) {
  return bookingQuery()
    .where(
      and(
        eq(meetingBooking.tenantId, user.tenantId),
        notDeleted,
        eq(meetingBooking.organizerMemberId, user.memberId),
        gte(meetingBooking.endAt, sql`now() - interval '7 days'`),
      ),
    )
    .orderBy(asc(meetingBooking.startAt))
    .limit(100);
}

// Rapat yang mengundang user sebagai peserta (bukan penyelenggara).
export async function listInvitations(user: SessionUser) {
  return bookingQuery()
    .where(
      and(
        eq(meetingBooking.tenantId, user.tenantId),
        notDeleted,
        sql`${meetingBooking.organizerMemberId} <> ${user.memberId}`,
        sql`${meetingBooking.status} in ('APPROVED', 'POSTPONED', 'PENDING')`,
        gte(meetingBooking.endAt, sql`now()`),
        exists(
          db
            .select({ one: sql`1` })
            .from(meetingParticipant)
            .where(
              and(
                eq(meetingParticipant.bookingId, meetingBooking.id),
                eq(meetingParticipant.memberId, user.memberId),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(meetingBooking.startAt))
    .limit(50);
}

export async function getBooking(user: SessionUser, id: number) {
  const [row] = await bookingQuery()
    .where(
      and(
        eq(meetingBooking.id, id),
        eq(meetingBooking.tenantId, user.tenantId),
        notDeleted,
        scopeCondition(user),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getBookingExtras(tenantId: number, bookingId: number) {
  const [participants, history, approvals, checkins] = await Promise.all([
    db
      .select({
        id: meetingParticipant.id,
        name: meetingParticipant.participantName,
        email: meetingParticipant.email,
        type: meetingParticipant.participantType,
        attendance: meetingParticipant.attendanceStatus,
        memberId: meetingParticipant.memberId,
      })
      .from(meetingParticipant)
      .where(and(eq(meetingParticipant.bookingId, bookingId), eq(meetingParticipant.tenantId, tenantId)))
      .orderBy(asc(meetingParticipant.id)),
    db
      .select({
        id: meetingBookingStatusHistory.id,
        oldStatus: meetingBookingStatusHistory.oldStatus,
        newStatus: meetingBookingStatusHistory.newStatus,
        reason: meetingBookingStatusHistory.reason,
        changedAt: meetingBookingStatusHistory.changedAt,
        changedBy: iamUser.fullName,
      })
      .from(meetingBookingStatusHistory)
      .leftJoin(iamUser, eq(iamUser.id, meetingBookingStatusHistory.changedBy))
      .where(
        and(
          eq(meetingBookingStatusHistory.bookingId, bookingId),
          eq(meetingBookingStatusHistory.tenantId, tenantId),
        ),
      )
      .orderBy(asc(meetingBookingStatusHistory.id)),
    db
      .select({
        id: meetingApproval.id,
        sequenceNo: meetingApproval.sequenceNo,
        status: meetingApproval.status,
        actedAt: meetingApproval.actedAt,
        remarks: meetingApproval.remarks,
        approver: iamUser.fullName,
      })
      .from(meetingApproval)
      .innerJoin(iamTenantMember, eq(iamTenantMember.id, meetingApproval.approverMemberId))
      .innerJoin(iamUser, eq(iamUser.id, iamTenantMember.userId))
      .where(and(eq(meetingApproval.bookingId, bookingId), eq(meetingApproval.tenantId, tenantId)))
      .orderBy(asc(meetingApproval.sequenceNo)),
    db
      .select({
        id: meetingCheckin.id,
        checkinAt: meetingCheckin.checkinAt,
        checkoutAt: meetingCheckin.checkoutAt,
        memberId: meetingCheckin.memberId,
        who: iamUser.fullName,
      })
      .from(meetingCheckin)
      .leftJoin(iamTenantMember, eq(iamTenantMember.id, meetingCheckin.memberId))
      .leftJoin(iamUser, eq(iamUser.id, iamTenantMember.userId))
      .where(and(eq(meetingCheckin.bookingId, bookingId), eq(meetingCheckin.tenantId, tenantId)))
      .orderBy(asc(meetingCheckin.checkinAt)),
  ]);
  return { participants, history, approvals, checkins };
}

export async function countPendingApprovals(user: SessionUser) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(meetingBooking)
    .innerJoin(iamTenantMember, eq(meetingBooking.organizerMemberId, iamTenantMember.id))
    .where(
      and(
        eq(meetingBooking.tenantId, user.tenantId),
        eq(meetingBooking.status, "PENDING"),
        notDeleted,
        scopeCondition(user),
        sql`${meetingBooking.organizerMemberId} <> ${user.memberId}`,
      ),
    );
  return row?.n ?? 0;
}

// ---------- Form booking ----------

export async function getBookingFormOptions(user: SessionUser, withMembers: boolean) {
  const [rooms, members, types, facilityRows] = await Promise.all([
    db
      .select({
        id: meetingRoom.id,
        name: meetingRoom.roomName,
        floor: meetingRoom.floor,
        capacity: meetingRoom.capacity,
      })
      .from(meetingRoom)
      .where(
        and(
          eq(meetingRoom.tenantId, user.tenantId),
          eq(meetingRoom.isActive, true),
          eq(meetingRoom.status, "AVAILABLE"),
        ),
      )
      .orderBy(asc(meetingRoom.roomName)),
    withMembers ? listMembersLite(user.tenantId) : Promise.resolve([]),
    db
      .select({
        id: meetingType.id,
        name: meetingType.typeName,
        requireApproval: meetingType.requireApproval,
      })
      .from(meetingType)
      .where(and(eq(meetingType.tenantId, user.tenantId), eq(meetingType.isActive, true)))
      .orderBy(asc(meetingType.typeName)),
    db
      .select({ roomId: meetingRoomFacility.roomId, name: meetingFacility.facilityName })
      .from(meetingRoomFacility)
      .innerJoin(meetingFacility, eq(meetingFacility.id, meetingRoomFacility.facilityId))
      .innerJoin(meetingRoom, eq(meetingRoom.id, meetingRoomFacility.roomId))
      .where(eq(meetingRoom.tenantId, user.tenantId)),
  ]);

  const byRoom = new Map<number, string[]>();
  for (const f of facilityRows) byRoom.set(f.roomId, [...(byRoom.get(f.roomId) ?? []), f.name]);
  return {
    rooms: rooms.map((r) => ({ ...r, facilities: byRoom.get(r.id) ?? [] })),
    members,
    types,
  };
}

export async function listMembersLite(tenantId: number) {
  return db
    .select({
      id: iamTenantMember.id,
      userId: iamUser.id,
      name: iamUser.fullName,
      department: orgDepartment.departmentName,
    })
    .from(iamTenantMember)
    .innerJoin(iamUser, eq(iamTenantMember.userId, iamUser.id))
    .leftJoin(orgDepartment, eq(iamTenantMember.departmentId, orgDepartment.id))
    .where(and(eq(iamTenantMember.tenantId, tenantId), eq(iamTenantMember.status, "ACTIVE")))
    .orderBy(asc(iamUser.fullName));
}

// ---------- Ruangan ----------

export async function listRooms(tenantId: number) {
  const [rooms, facilityRows] = await Promise.all([
    db
      .select({
        id: meetingRoom.id,
        roomCode: meetingRoom.roomCode,
        roomName: meetingRoom.roomName,
        floor: meetingRoom.floor,
        capacity: meetingRoom.capacity,
        status: meetingRoom.status,
        locationName: orgLocation.locationName,
      })
      .from(meetingRoom)
      .innerJoin(orgLocation, eq(meetingRoom.locationId, orgLocation.id))
      .where(and(eq(meetingRoom.tenantId, tenantId), eq(meetingRoom.isActive, true)))
      .orderBy(asc(meetingRoom.roomName)),
    db
      .select({ roomId: meetingRoomFacility.roomId, name: meetingFacility.facilityName })
      .from(meetingRoomFacility)
      .innerJoin(meetingFacility, eq(meetingFacility.id, meetingRoomFacility.facilityId))
      .innerJoin(meetingRoom, eq(meetingRoom.id, meetingRoomFacility.roomId))
      .where(eq(meetingRoom.tenantId, tenantId)),
  ]);
  const byRoom = new Map<number, string[]>();
  for (const f of facilityRows) byRoom.set(f.roomId, [...(byRoom.get(f.roomId) ?? []), f.name]);
  return rooms.map((r) => ({ ...r, facilities: byRoom.get(r.id) ?? [] }));
}

export async function getRoom(tenantId: number, id: number) {
  const [room] = await db
    .select({
      id: meetingRoom.id,
      roomCode: meetingRoom.roomCode,
      roomName: meetingRoom.roomName,
      floor: meetingRoom.floor,
      capacity: meetingRoom.capacity,
      description: meetingRoom.description,
      status: meetingRoom.status,
      locationId: meetingRoom.locationId,
    })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.id, id), eq(meetingRoom.tenantId, tenantId)))
    .limit(1);
  if (!room) return null;
  const [facilityIds, blocks] = await Promise.all([
    db
      .select({ id: meetingRoomFacility.facilityId })
      .from(meetingRoomFacility)
      .where(eq(meetingRoomFacility.roomId, id)),
    db
      .select({
        id: meetingRoomBlock.id,
        reason: meetingRoomBlock.reason,
        blockType: meetingRoomBlock.blockType,
        startAt: meetingRoomBlock.startAt,
        endAt: meetingRoomBlock.endAt,
        status: meetingRoomBlock.status,
      })
      .from(meetingRoomBlock)
      .where(
        and(
          eq(meetingRoomBlock.roomId, id),
          eq(meetingRoomBlock.tenantId, tenantId),
          gte(meetingRoomBlock.endAt, sql`now()`),
        ),
      )
      .orderBy(asc(meetingRoomBlock.startAt)),
  ]);
  return { ...room, facilityIds: facilityIds.map((f) => f.id), blocks };
}

export async function countActiveRooms(tenantId: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.tenantId, tenantId), eq(meetingRoom.isActive, true)));
  return row?.n ?? 0;
}

// ---------- Data master ----------

export async function listLocations(tenantId: number) {
  return db
    .select({
      id: orgLocation.id,
      code: orgLocation.locationCode,
      name: orgLocation.locationName,
      isActive: orgLocation.isActive,
    })
    .from(orgLocation)
    .where(eq(orgLocation.tenantId, tenantId))
    .orderBy(asc(orgLocation.locationName));
}

export async function listDepartments(tenantId: number) {
  return db
    .select({
      id: orgDepartment.id,
      code: orgDepartment.departmentCode,
      name: orgDepartment.departmentName,
      isActive: orgDepartment.isActive,
    })
    .from(orgDepartment)
    .where(eq(orgDepartment.tenantId, tenantId))
    .orderBy(asc(orgDepartment.departmentName));
}

export async function listMeetingTypes(tenantId: number) {
  return db
    .select({
      id: meetingType.id,
      code: meetingType.typeCode,
      name: meetingType.typeName,
      requireApproval: meetingType.requireApproval,
      isActive: meetingType.isActive,
    })
    .from(meetingType)
    .where(eq(meetingType.tenantId, tenantId))
    .orderBy(asc(meetingType.typeName));
}

export async function listFacilities(tenantId: number) {
  return db
    .select({
      id: meetingFacility.id,
      code: meetingFacility.facilityCode,
      name: meetingFacility.facilityName,
      isActive: meetingFacility.isActive,
    })
    .from(meetingFacility)
    .where(eq(meetingFacility.tenantId, tenantId))
    .orderBy(asc(meetingFacility.facilityName));
}

// ---------- Pengguna dan peran ----------

export async function listUsers(tenantId: number) {
  const members = await db
    .select({
      memberId: iamTenantMember.id,
      userId: iamUser.id,
      username: iamUser.username,
      fullName: iamUser.fullName,
      email: iamUser.email,
      userStatus: iamUser.status,
      memberStatus: iamTenantMember.status,
      jobTitle: iamTenantMember.jobTitle,
      departmentId: iamTenantMember.departmentId,
      department: orgDepartment.departmentName,
      lastLoginAt: iamUser.lastLoginAt,
      hasPassword: sql<boolean>`${iamUser.passwordHash} is not null`,
    })
    .from(iamTenantMember)
    .innerJoin(iamUser, eq(iamUser.id, iamTenantMember.userId))
    .leftJoin(orgDepartment, eq(orgDepartment.id, iamTenantMember.departmentId))
    .where(eq(iamTenantMember.tenantId, tenantId))
    .orderBy(asc(iamUser.fullName));

  const roles = members.length
    ? await db
        .select({
          memberId: iamMemberRole.memberId,
          roleId: iamRole.id,
          roleCode: iamRole.roleCode,
          roleName: iamRole.roleName,
        })
        .from(iamMemberRole)
        .innerJoin(iamRole, eq(iamRole.id, iamMemberRole.roleId))
        .where(
          inArray(
            iamMemberRole.memberId,
            members.map((m) => m.memberId),
          ),
        )
    : [];

  return members.map((m) => ({
    ...m,
    roles: roles.filter((r) => r.memberId === m.memberId),
  }));
}

export async function listRoles(tenantId: number) {
  return db
    .select({ id: iamRole.id, code: iamRole.roleCode, name: iamRole.roleName })
    .from(iamRole)
    .where(and(eq(iamRole.tenantId, tenantId), eq(iamRole.isActive, true)))
    .orderBy(asc(iamRole.roleName));
}

// ---------- Notifikasi dan audit ----------

export async function countUnread(user: SessionUser) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .where(
      and(
        eq(notification.tenantId, user.tenantId),
        eq(notification.userId, user.userId),
        eq(notification.isRead, false),
      ),
    );
  return row?.n ?? 0;
}

export async function listNotifications(user: SessionUser) {
  return db
    .select({
      id: notification.id,
      type: notification.notificationType,
      title: notification.title,
      message: notification.message,
      refType: notification.referenceType,
      refId: notification.referenceId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .where(and(eq(notification.tenantId, user.tenantId), eq(notification.userId, user.userId)))
    .orderBy(desc(notification.createdAt))
    .limit(50);
}

export async function listAuditLog(tenantId: number, limit = 100) {
  return db
    .select({
      id: auditLog.id,
      module: auditLog.module,
      table: auditLog.tableName,
      recordId: auditLog.recordId,
      action: auditLog.action,
      actor: auditLog.actorNik,
      ip: sql<string | null>`${auditLog.ipAddress}::text`,
      newData: auditLog.newData,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.tenantId, tenantId))
    .orderBy(desc(auditLog.id))
    .limit(limit);
}

export async function listLoginAudit(tenantId: number, limit = 50) {
  return db
    .select({
      id: auditLogin.id,
      username: iamUser.username,
      success: auditLogin.success,
      reason: auditLogin.failureReason,
      ip: sql<string | null>`${auditLogin.ipAddress}::text`,
      at: auditLogin.loginAt,
    })
    .from(auditLogin)
    .leftJoin(iamUser, eq(iamUser.id, auditLogin.userId))
    .where(eq(auditLogin.tenantId, tenantId))
    .orderBy(desc(auditLogin.id))
    .limit(limit);
}

// ---------- Layar TV ----------

// Rapat hari ini yang tampil di layar: disetujui atau ditunda, opsional per lokasi.
export async function getDisplayData(tenantId: number, date: string, locationCode?: string) {
  const [settings, rows] = await Promise.all([
    getSettings(tenantId),
    db
      .select({
        id: meetingBooking.id,
        title: meetingBooking.title,
        agenda: meetingBooking.agenda,
        startAt: meetingBooking.startAt,
        endAt: meetingBooking.endAt,
        status: meetingBooking.status,
        roomName: meetingRoom.roomName,
        floor: meetingRoom.floor,
        organizer: iamUser.fullName,
        department: orgDepartment.departmentName,
      })
      .from(meetingBooking)
      .innerJoin(meetingRoom, eq(meetingBooking.roomId, meetingRoom.id))
      .innerJoin(orgLocation, eq(meetingRoom.locationId, orgLocation.id))
      .innerJoin(iamTenantMember, eq(meetingBooking.organizerMemberId, iamTenantMember.id))
      .innerJoin(iamUser, eq(iamTenantMember.userId, iamUser.id))
      .leftJoin(orgDepartment, eq(iamTenantMember.departmentId, orgDepartment.id))
      .where(
        and(
          eq(meetingBooking.tenantId, tenantId),
          notDeleted,
          inArray(meetingBooking.status, ["APPROVED", "POSTPONED"]),
          sql`(${meetingBooking.startAt} at time zone 'Asia/Jakarta')::date = ${date}::date`,
          locationCode ? eq(orgLocation.locationCode, locationCode) : sql`true`,
        ),
      )
      .orderBy(asc(meetingBooking.startAt), asc(meetingRoom.roomName)),
  ]);

  return { now: Date.now(), settings, bookings: rows };
}

// Semua pengajuan yang menunggu persetujuan (lintas tanggal), sesuai scope user.
export async function listPendingBookings(user: SessionUser) {
  return bookingQuery()
    .where(
      and(
        eq(meetingBooking.tenantId, user.tenantId),
        notDeleted,
        eq(meetingBooking.status, "PENDING"),
        gte(meetingBooking.endAt, sql`now()`),
        scopeCondition(user),
      ),
    )
    .orderBy(asc(meetingBooking.startAt))
    .limit(200);
}
