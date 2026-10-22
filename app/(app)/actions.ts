"use server";

// Server Action untuk booking, peserta, check-in, dan notifikasi.
// Setiap action: (1) autentikasi + izin, (2) validasi ulang semua input, (3) cek kebijakan terhadap
// data di database (bukan data dari form), (4) operasi atomik, (5) audit dan notifikasi.
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  iamTenantMember,
  iamUser,
  meetingParticipant,
  meetingRoom,
  meetingType,
} from "@/db/schema";
import { requirePermission, requireUser, can, type SessionUser } from "@/lib/auth";
import { approverUserIds, audit, notify, rowsOf } from "@/lib/audit";
import { getBooking } from "@/lib/data";
import {
  CHECKIN_EARLY_MS,
  RELEASES_SLOT,
  STATUS_LABEL,
  TRANSITIONS,
  addDays,
  allowedTransitions,
  canCheckIn,
  canEditParticipants,
  canReschedule,
  isBookingStatus,
  isDateString,
  isTimeString,
  parseTs,
  toTimestamptz,
  type BookingStatus,
} from "@/lib/booking";

export type FormState = { error?: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const num = (fd: FormData, key: string) => Number(str(fd, key));

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

// Daftar angka sebagai array bigint Postgres (aman: hanya integer yang lolos).
function bigintArray(ids: number[]) {
  const safe = ids.filter((n) => Number.isInteger(n));
  return safe.length
    ? sql`ARRAY[${sql.join(safe.map((n) => sql`${n}`), sql`, `)}]::bigint[]`
    : sql`ARRAY[]::bigint[]`;
}

// Redirect hanya ke path internal.
function safePath(v: string, fallback: string) {
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

function withParam(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const p = new URLSearchParams(query);
  p.set(key, value);
  return `${base}?${p.toString()}`;
}

function bookingNo(date: string) {
  return `BK-${date.replaceAll("-", "")}-${randomInt(10000, 100000)}`;
}

// ---------- Buat booking ----------

type CreateInput = { organizerMemberId: number; fd: FormData };

async function submitBooking(user: SessionUser, { organizerMemberId, fd }: CreateInput): Promise<FormState> {
  const roomId = num(fd, "roomId");
  const typeId = num(fd, "typeId");
  const title = str(fd, "title");
  const agenda = str(fd, "agenda");
  const date = str(fd, "date");
  const from = str(fd, "from");
  const to = str(fd, "to");
  const pax = num(fd, "pax");
  const repeat = str(fd, "repeat");
  const repeatCount = repeat === "weekly" ? num(fd, "repeatCount") : 1;
  const participantIds = fd.getAll("participants").map(Number).filter(Number.isInteger);

  if (!title || title.length > 255) return { error: "Judul wajib diisi (maksimal 255 karakter)." };
  if (agenda.length > 2000) return { error: "Agenda terlalu panjang (maksimal 2000 karakter)." };
  if (!isDateString(date) || !isTimeString(from) || !isTimeString(to)) {
    return { error: "Tanggal atau jam tidak valid." };
  }
  if (to <= from) return { error: "Jam selesai harus setelah jam mulai." };
  if (!Number.isInteger(pax) || pax < 1) return { error: "Jumlah peserta minimal 1." };
  if (!Number.isInteger(roomId) || !Number.isInteger(typeId)) {
    return { error: "Ruangan dan tipe rapat wajib dipilih." };
  }
  if (repeat !== "" && repeat !== "none" && repeat !== "weekly") return { error: "Pengulangan tidak valid." };
  if (repeat === "weekly" && !(Number.isInteger(repeatCount) && repeatCount >= 2 && repeatCount <= 12)) {
    return { error: "Jumlah pengulangan mingguan 2–12 kali." };
  }

  const startsAt = new Date(toTimestamptz(date, from)).getTime();
  if (!can(user, "booking.manage") && startsAt < Date.now() - 5 * 60 * 1000) {
    return { error: "Waktu mulai sudah lewat." };
  }

  const [room] = await db
    .select({ name: meetingRoom.roomName, capacity: meetingRoom.capacity, status: meetingRoom.status })
    .from(meetingRoom)
    .where(
      and(eq(meetingRoom.id, roomId), eq(meetingRoom.tenantId, user.tenantId), eq(meetingRoom.isActive, true)),
    );
  if (!room) return { error: "Ruangan tidak ditemukan." };
  if (room.status !== "AVAILABLE") return { error: "Ruangan sedang tidak tersedia." };
  if (pax > room.capacity) return { error: `Kapasitas ruangan hanya ${room.capacity} orang.` };

  const [organizer] = await db
    .select({ userId: iamTenantMember.userId })
    .from(iamTenantMember)
    .where(
      and(
        eq(iamTenantMember.id, organizerMemberId),
        eq(iamTenantMember.tenantId, user.tenantId),
        eq(iamTenantMember.status, "ACTIVE"),
      ),
    );
  if (!organizer) return { error: "Penyelenggara tidak ditemukan." };

  const [type] = await db
    .select({ requireApproval: meetingType.requireApproval })
    .from(meetingType)
    .where(
      and(eq(meetingType.id, typeId), eq(meetingType.tenantId, user.tenantId), eq(meetingType.isActive, true)),
    );
  if (!type) return { error: "Tipe rapat tidak ditemukan." };

  // Tipe yang butuh persetujuan berstatus Menunggu; pemegang booking.manage langsung Disetujui.
  const finalStatus: BookingStatus = type.requireApproval && !can(user, "booking.manage") ? "PENDING" : "APPROVED";

  const dates = Array.from({ length: repeatCount }, (_, i) => addDays(date, 7 * i));
  const series = dates.length > 1;
  const rows = sql.join(
    dates.map(
      (d) => sql`(${user.tenantId}, ${bookingNo(d)}, ${roomId}, ${organizerMemberId}, ${typeId},
        ${series ? sql`(select id from s)` : null}, ${title}, ${agenda || null},
        ${toTimestamptz(d, from)}::timestamptz, ${toTimestamptz(d, to)}::timestamptz, ${pax},
        ${finalStatus}::text, ${user.userId})`,
    ),
    sql`, `,
  );

  // Satu statement atomik: (seri) + booking + reservasi + riwayat. Bentrok jadwal ditolak oleh exclusion
  // constraint database (SQLSTATE 23P01), jadi aman terhadap pemesanan bersamaan dan seri ikut batal semua.
  let ids: number[];
  try {
    const res = await db.execute(sql`
      with ${
        series
          ? sql`s as (
        insert into meeting_series (tenant_id, series_code, recurrence_rule, start_date, end_date)
        values (${user.tenantId}, ${"SR-" + date.replaceAll("-", "") + "-" + randomInt(1000, 10000)},
                ${"FREQ=WEEKLY;COUNT=" + repeatCount}, ${date}::date, ${dates[dates.length - 1]}::date)
        returning id
      ),`
          : sql``
      } nb as (
        insert into meeting_booking
          (tenant_id, booking_no, room_id, organizer_member_id, meeting_type_id, series_id, title, agenda,
           start_at, end_at, participant_count, status, created_by)
        values ${rows}
        returning id, tenant_id, room_id, start_at, end_at, status
      ), r as (
        insert into meeting_room_reservation (tenant_id, room_id, booking_id, reservation_type, during, status)
        select tenant_id, room_id, id, 'BOOKING', tstzrange(start_at, end_at, '[)'), 'ACTIVE' from nb
      ), h as (
        insert into meeting_booking_status_history (tenant_id, booking_id, old_status, new_status, reason, changed_by)
        select tenant_id, id, null, status, 'Booking dibuat', ${user.userId}::bigint from nb
      )
      select id from nb order by start_at
    `);
    ids = rowsOf(res).map((r) => Number(r.id));
  } catch (e) {
    if (pgCode(e) === "23P01") {
      return {
        error: series
          ? "Ruangan sudah dipesan pada salah satu tanggal dalam seri ini. Pilih jam atau ruangan lain."
          : "Ruangan sudah dipesan atau diblokir pada rentang waktu tersebut. Pilih jam atau ruangan lain.",
      };
    }
    console.error("submitBooking gagal", e);
    return { error: "Gagal menyimpan booking. Coba lagi." };
  }

  // Peserta internal (hanya anggota tenant ini yang aktif).
  if (participantIds.length) {
    await db.execute(sql`
      insert into meeting_participant (tenant_id, booking_id, member_id, participant_name, email, participant_type, invited_at)
      select ${user.tenantId}, b.id, m.id, u.full_name, u.email, 'INTERNAL', now()
      from unnest(${bigintArray(ids)}) as b(id)
      cross join iam_tenant_member m
      join iam_user u on u.id = m.user_id
      where m.tenant_id = ${user.tenantId} and m.status = 'ACTIVE'
        and m.id = any(${bigintArray(participantIds)}) and m.id <> ${organizerMemberId}
    `);
    const invitees = await db
      .select({ userId: iamTenantMember.userId })
      .from(iamTenantMember)
      .where(and(eq(iamTenantMember.tenantId, user.tenantId), sql`${iamTenantMember.id} = any(${bigintArray(participantIds)})`));
    await notify(user.tenantId, invitees.map((i) => i.userId), {
      type: "INVITATION",
      title: "Undangan rapat",
      message: `Anda diundang ke "${title}" pada ${date} ${from}–${to}, ${room.name}.`,
      refType: "booking",
      refId: ids[0],
    });
  }

  if (finalStatus === "PENDING") {
    const approvers = (await approverUserIds(user.tenantId)).filter((id) => id !== organizer.userId);
    await notify(user.tenantId, approvers, {
      type: "APPROVAL_REQUEST",
      title: "Pengajuan booking baru",
      message: `"${title}" di ${room.name}, ${date} ${from}–${to}, menunggu persetujuan.`,
      refType: "booking",
      refId: ids[0],
    });
  }
  if (organizer.userId !== user.userId) {
    await notify(user.tenantId, [organizer.userId], {
      type: "BOOKING_CREATED",
      title: "Booking dibuatkan untuk Anda",
      message: `${user.fullName} membuat booking "${title}" di ${room.name}, ${date} ${from}–${to}.`,
      refType: "booking",
      refId: ids[0],
    });
  }

  await audit(user, {
    module: "booking",
    table: "meeting_booking",
    recordId: ids[0],
    action: "CREATE",
    newData: { ids, title, roomId, date, from, to, status: finalStatus, organizerMemberId },
  });

  revalidatePath("/", "layout");
  redirect(`/bookings/${ids[0]}`);
}

// Karyawan membuat booking untuk dirinya sendiri; penyelenggara selalu diambil dari sesi, bukan dari form.
export async function createMyBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("booking.create");
  return submitBooking(user, { organizerMemberId: user.memberId, fd });
}

// Staf dengan booking.manage membuat booking atas nama orang lain.
export async function createBookingFor(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("booking.manage");
  const memberId = num(fd, "memberId");
  if (!Number.isInteger(memberId)) return { error: "Penyelenggara wajib dipilih." };
  return submitBooking(user, { organizerMemberId: memberId, fd });
}

// ---------- Ubah status ----------

export async function changeBookingStatus(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const to = str(fd, "to");
  const returnTo = safePath(str(fd, "returnTo"), `/bookings/${id}`);
  const reason = str(fd, "reason").slice(0, 500);
  if (!Number.isInteger(id) || !isBookingStatus(to)) redirect(withParam(returnTo, "err", "Permintaan tidak valid."));

  // Kebijakan dicek terhadap data di database, bukan terhadap apa yang dikirim form.
  const booking = await getBooking(user, id);
  if (!booking) redirect(withParam(returnTo, "err", "Booking tidak ditemukan."));
  const from = booking.status as BookingStatus;
  if (!allowedTransitions(user, { status: from, organizerMemberId: booking.organizerMemberId }).includes(to)) {
    redirect(withParam(returnTo, "err", "Anda tidak dapat melakukan perubahan status ini."));
  }

  const allowedFrom = (Object.keys(TRANSITIONS) as BookingStatus[]).filter((s) => TRANSITIONS[s].includes(to));
  const defaultReason =
    to === "CANCELLED" ? "Dibatalkan" : to === "REJECTED" ? "Ditolak" : "Status diubah";
  const finalReason = reason || defaultReason;
  const keepReason = to === "CANCELLED" || to === "REJECTED";
  const releases = RELEASES_SLOT.includes(to);
  const fromList = sql.join(allowedFrom.map((s) => sql`${s}`), sql`, `);

  const res = await db.execute(sql`
    with old as (
      select id, tenant_id, status from meeting_booking
      where id = ${id} and tenant_id = ${user.tenantId} and deleted_at is null and status in (${fromList})
      for update
    ), b as (
      update meeting_booking mb
      set status = ${to}::text, updated_at = now(), updated_by = ${user.userId}::bigint,
          cancellation_reason = case when ${keepReason} then ${finalReason}::text else mb.cancellation_reason end
      from old where mb.id = old.id
      returning mb.id
    ), ap as (
      insert into meeting_approval (tenant_id, booking_id, sequence_no, approver_member_id, status, acted_at, remarks)
      select old.tenant_id, old.id, 1, ${user.memberId}::bigint, ${to}::text, now(), ${reason || null}::text
      from old join b on b.id = old.id
      where old.status = 'PENDING' and ${to}::text in ('APPROVED', 'REJECTED')
      on conflict (booking_id, sequence_no) do update
        set status = excluded.status, acted_at = excluded.acted_at,
            approver_member_id = excluded.approver_member_id, remarks = excluded.remarks
    )${
      releases
        ? sql`, r as (
      update meeting_room_reservation set status = 'CANCELLED' where booking_id in (select id from b)
    )`
        : sql``
    }, h as (
      insert into meeting_booking_status_history (tenant_id, booking_id, old_status, new_status, reason, changed_by)
      select old.tenant_id, old.id, old.status, ${to}::text, ${finalReason}::text, ${user.userId}::bigint
      from old join b on b.id = old.id
    )
    select id from b
  `);

  if (rowsOf(res).length === 0) {
    redirect(withParam(returnTo, "err", "Status booking sudah berubah oleh pengguna lain. Muat ulang halaman."));
  }

  if (booking.organizerUserId !== user.userId) {
    await notify(user.tenantId, [booking.organizerUserId], {
      type: "BOOKING_STATUS",
      title: `Booking ${STATUS_LABEL[to].toLowerCase()}`,
      message: `"${booking.title}" kini berstatus ${STATUS_LABEL[to]}${reason ? ` (${reason})` : ""}.`,
      refType: "booking",
      refId: id,
    });
  }
  await audit(user, {
    module: "booking",
    table: "meeting_booking",
    recordId: id,
    action: `STATUS_${to}`,
    oldData: { status: from },
    newData: { status: to, reason: finalReason },
  });

  revalidatePath("/", "layout");
  redirect(returnTo);
}

// ---------- Jadwal ulang ----------

export async function rescheduleBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = num(fd, "id");
  const roomId = num(fd, "roomId");
  const date = str(fd, "date");
  const from = str(fd, "from");
  const to = str(fd, "to");

  if (!Number.isInteger(id) || !Number.isInteger(roomId)) return { error: "Permintaan tidak valid." };
  if (!isDateString(date) || !isTimeString(from) || !isTimeString(to)) return { error: "Tanggal atau jam tidak valid." };
  if (to <= from) return { error: "Jam selesai harus setelah jam mulai." };

  const booking = await getBooking(user, id);
  if (!booking) return { error: "Booking tidak ditemukan." };
  const current = booking.status as BookingStatus;
  if (!canReschedule(user, { status: current, organizerMemberId: booking.organizerMemberId })) {
    return { error: "Booking ini tidak dapat dijadwalkan ulang oleh Anda." };
  }
  if (!can(user, "booking.manage") && new Date(toTimestamptz(date, from)).getTime() < Date.now() - 5 * 60 * 1000) {
    return { error: "Waktu mulai sudah lewat." };
  }

  const [room] = await db
    .select({ name: meetingRoom.roomName, capacity: meetingRoom.capacity, status: meetingRoom.status })
    .from(meetingRoom)
    .where(and(eq(meetingRoom.id, roomId), eq(meetingRoom.tenantId, user.tenantId), eq(meetingRoom.isActive, true)));
  if (!room) return { error: "Ruangan tidak ditemukan." };
  if (room.status !== "AVAILABLE") return { error: "Ruangan sedang tidak tersedia." };
  if (booking.participantCount > room.capacity) return { error: `Kapasitas ruangan hanya ${room.capacity} orang.` };

  // Tipe yang butuh persetujuan: jadwal ulang oleh non-approver mengembalikan status ke Menunggu.
  const canApprove = can(user, "booking.approve") || can(user, "booking.manage");
  let next: BookingStatus = current;
  if (booking.requireApproval && !canApprove) next = "PENDING";
  else if (current === "POSTPONED") next = "APPROVED";

  const start = toTimestamptz(date, from);
  const end = toTimestamptz(date, to);
  const note = `Jadwal ulang ke ${date} ${from}–${to}, ${room.name}`;

  try {
    const res = await db.execute(sql`
      with old as (
        select id, tenant_id, status from meeting_booking
        where id = ${id} and tenant_id = ${user.tenantId} and deleted_at is null
          and status in ('PENDING', 'APPROVED', 'POSTPONED')
        for update
      ), b as (
        update meeting_booking mb
        set room_id = ${roomId}, start_at = ${start}::timestamptz, end_at = ${end}::timestamptz,
            status = ${next}::text, updated_at = now(), updated_by = ${user.userId}::bigint
        from old where mb.id = old.id
        returning mb.id, mb.tenant_id
      ), r as (
        update meeting_room_reservation
        set room_id = ${roomId}, during = tstzrange(${start}::timestamptz, ${end}::timestamptz, '[)')
        where booking_id in (select id from b) and status = 'ACTIVE'
      ), h as (
        insert into meeting_booking_status_history (tenant_id, booking_id, old_status, new_status, reason, changed_by)
        select old.tenant_id, old.id, old.status, ${next}::text, ${note}::text, ${user.userId}::bigint
        from old join b on b.id = old.id
      )
      select id from b
    `);
    if (rowsOf(res).length === 0) return { error: "Status booking sudah berubah. Muat ulang halaman." };
  } catch (e) {
    if (pgCode(e) === "23P01") {
      return { error: "Ruangan sudah dipesan atau diblokir pada rentang waktu tersebut." };
    }
    console.error("rescheduleBooking gagal", e);
    return { error: "Gagal menjadwalkan ulang. Coba lagi." };
  }

  if (next === "PENDING" && current !== "PENDING") {
    const approvers = (await approverUserIds(user.tenantId)).filter((u) => u !== booking.organizerUserId);
    await notify(user.tenantId, approvers, {
      type: "APPROVAL_REQUEST",
      title: "Jadwal ulang perlu persetujuan",
      message: `"${booking.title}" dijadwalkan ulang, ${date} ${from}–${to}, ${room.name}.`,
      refType: "booking",
      refId: id,
    });
  }
  if (booking.organizerUserId !== user.userId) {
    await notify(user.tenantId, [booking.organizerUserId], {
      type: "BOOKING_RESCHEDULED",
      title: "Jadwal rapat berubah",
      message: `"${booking.title}": ${note}.`,
      refType: "booking",
      refId: id,
    });
  }
  await audit(user, {
    module: "booking",
    table: "meeting_booking",
    recordId: id,
    action: "RESCHEDULE",
    oldData: { start: booking.startAt, end: booking.endAt, roomId: booking.roomId, status: current },
    newData: { start, end, roomId, status: next },
  });

  revalidatePath("/", "layout");
  redirect(`/bookings/${id}`);
}

// ---------- Peserta ----------

export async function addParticipant(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const back = `/bookings/${id}`;
  const booking = Number.isInteger(id) ? await getBooking(user, id) : null;
  if (!booking) redirect("/");
  if (!canEditParticipants(user, { status: booking.status as BookingStatus, organizerMemberId: booking.organizerMemberId })) {
    redirect(withParam(back, "err", "Anda tidak dapat mengubah peserta."));
  }

  const memberId = num(fd, "memberId");
  if (Number.isInteger(memberId) && str(fd, "memberId") !== "") {
    const [m] = await db
      .select({ id: iamTenantMember.id, userId: iamTenantMember.userId, name: iamUser.fullName, email: iamUser.email })
      .from(iamTenantMember)
      .innerJoin(iamUser, eq(iamUser.id, iamTenantMember.userId))
      .where(
        and(eq(iamTenantMember.id, memberId), eq(iamTenantMember.tenantId, user.tenantId), eq(iamTenantMember.status, "ACTIVE")),
      );
    if (!m) redirect(withParam(back, "err", "Anggota tidak ditemukan."));
    const [dup] = await db
      .select({ id: meetingParticipant.id })
      .from(meetingParticipant)
      .where(and(eq(meetingParticipant.bookingId, id), eq(meetingParticipant.memberId, m.id)));
    if (dup) redirect(withParam(back, "err", "Peserta sudah ada."));
    await db.insert(meetingParticipant).values({
      tenantId: user.tenantId,
      bookingId: id,
      memberId: m.id,
      participantName: m.name,
      email: m.email,
      participantType: "INTERNAL",
      invitedAt: new Date().toISOString(),
    });
    await notify(user.tenantId, [m.userId], {
      type: "INVITATION",
      title: "Undangan rapat",
      message: `Anda diundang ke "${booking.title}".`,
      refType: "booking",
      refId: id,
    });
  } else {
    const name = str(fd, "name");
    const email = str(fd, "email");
    if (!name || name.length > 150) redirect(withParam(back, "err", "Nama peserta eksternal wajib diisi."));
    if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      redirect(withParam(back, "err", "Format email tidak valid."));
    }
    await db.insert(meetingParticipant).values({
      tenantId: user.tenantId,
      bookingId: id,
      participantName: name,
      email: email || null,
      participantType: "EXTERNAL",
      invitedAt: new Date().toISOString(),
    });
  }

  await audit(user, { module: "booking", table: "meeting_participant", recordId: id, action: "PARTICIPANT_ADD" });
  revalidatePath(back);
  redirect(back);
}

export async function removeParticipant(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const participantId = num(fd, "participantId");
  const back = `/bookings/${id}`;
  const booking = Number.isInteger(id) ? await getBooking(user, id) : null;
  if (!booking) redirect("/");
  if (!canEditParticipants(user, { status: booking.status as BookingStatus, organizerMemberId: booking.organizerMemberId })) {
    redirect(withParam(back, "err", "Anda tidak dapat mengubah peserta."));
  }
  if (Number.isInteger(participantId)) {
    await db
      .delete(meetingParticipant)
      .where(
        and(
          eq(meetingParticipant.id, participantId),
          eq(meetingParticipant.bookingId, id),
          eq(meetingParticipant.tenantId, user.tenantId),
        ),
      );
    await audit(user, { module: "booking", table: "meeting_participant", recordId: id, action: "PARTICIPANT_REMOVE", oldData: { participantId } });
  }
  revalidatePath(back);
  redirect(back);
}

// ---------- Check-in / check-out ----------

export async function checkIn(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const back = `/bookings/${id}`;
  const booking = Number.isInteger(id) ? await getBooking(user, id) : null;
  if (!booking) redirect("/");
  if (!canCheckIn(user, { status: booking.status as BookingStatus, organizerMemberId: booking.organizerMemberId })) {
    redirect(withParam(back, "err", "Anda tidak dapat check-in pada booking ini."));
  }
  const now = Date.now();
  if (now < parseTs(booking.startAt).getTime() - CHECKIN_EARLY_MS || now > parseTs(booking.endAt).getTime()) {
    redirect(withParam(back, "err", "Check-in hanya dibuka 15 menit sebelum rapat sampai rapat selesai."));
  }
  const open = rowsOf(
    await db.execute(sql`
      select 1 from meeting_checkin
      where booking_id = ${id} and tenant_id = ${user.tenantId} and member_id = ${user.memberId} and checkout_at is null
    `),
  );
  if (open.length === 0) {
    await db.execute(sql`
      insert into meeting_checkin (tenant_id, booking_id, member_id, checkin_type, source)
      values (${user.tenantId}, ${id}, ${user.memberId},
              ${booking.organizerMemberId === user.memberId ? "ORGANIZER" : "STAFF"}, 'WEB')
    `);
    await audit(user, { module: "booking", table: "meeting_checkin", recordId: id, action: "CHECKIN" });
  }
  revalidatePath(back);
  redirect(back);
}

export async function checkOut(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const back = `/bookings/${id}`;
  const booking = Number.isInteger(id) ? await getBooking(user, id) : null;
  if (!booking) redirect("/");
  await db.execute(sql`
    update meeting_checkin set checkout_at = now()
    where booking_id = ${id} and tenant_id = ${user.tenantId} and member_id = ${user.memberId} and checkout_at is null
  `);
  await audit(user, { module: "booking", table: "meeting_checkin", recordId: id, action: "CHECKOUT" });
  revalidatePath(back);
  redirect(back);
}

// ---------- Notifikasi ----------

export async function markNotificationsRead(fd: FormData) {
  const user = await requireUser();
  const id = str(fd, "id");
  if (id) {
    const n = Number(id);
    if (Number.isInteger(n)) {
      await db.execute(sql`
        update notification set is_read = true, read_at = now()
        where id = ${n} and user_id = ${user.userId} and tenant_id = ${user.tenantId}
      `);
    }
  } else {
    await db.execute(sql`
      update notification set is_read = true, read_at = now()
      where user_id = ${user.userId} and tenant_id = ${user.tenantId} and is_read = false
    `);
  }
  revalidatePath("/", "layout");
}
