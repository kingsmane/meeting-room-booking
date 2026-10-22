// Tes unit untuk logika murni di lib/booking.ts (tanpa server dan database).
// Dijalankan dengan: node --experimental-strip-types --test tests/unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RELEASES_SLOT,
  TRANSITIONS,
  addDays,
  allowedTransitions,
  canCheckIn,
  canEditParticipants,
  canReschedule,
  isDateString,
  isTimeString,
  parseTs,
  toTimestamptz,
} from "../../lib/booking.ts";

const actor = (perms, memberId = 1) => ({ permissions: new Set(perms), memberId });
const booking = (status, organizerMemberId = 2) => ({ status, organizerMemberId });

test("status akhir tidak punya transisi keluar", () => {
  for (const s of ["REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"]) {
    assert.deepEqual(TRANSITIONS[s], [], s);
  }
});

test("setiap transisi mengarah ke status yang dikenal", () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    for (const to of tos) assert.ok(to in TRANSITIONS, `${from} -> ${to}`);
  }
});

test("hanya REJECTED, CANCELLED, NO_SHOW yang melepas slot", () => {
  assert.deepEqual([...RELEASES_SLOT].sort(), ["CANCELLED", "NO_SHOW", "REJECTED"]);
});

test("karyawan tanpa izin hanya boleh membatalkan miliknya sendiri", () => {
  const emp = actor(["booking.create"], 5);
  assert.deepEqual(allowedTransitions(emp, booking("APPROVED", 5)), ["CANCELLED"]);
  assert.deepEqual(allowedTransitions(emp, booking("PENDING", 5)), ["CANCELLED"]);
  assert.deepEqual(allowedTransitions(emp, booking("APPROVED", 9)), [], "milik orang lain");
});

test("pemilik tidak dapat membatalkan booking yang sudah berstatus akhir", () => {
  const emp = actor(["booking.create"], 5);
  for (const s of ["COMPLETED", "NO_SHOW", "CANCELLED", "REJECTED"]) {
    assert.deepEqual(allowedTransitions(emp, booking(s, 5)), [], s);
  }
});

test("approver dapat menyetujui/menolak pengajuan orang lain", () => {
  const ap = actor(["booking.approve"], 1);
  assert.deepEqual(allowedTransitions(ap, booking("PENDING", 2)).sort(), ["APPROVED", "REJECTED"]);
});

test("pemisahan tugas: approver tidak dapat menyetujui/menolak pengajuannya sendiri", () => {
  const ap = actor(["booking.approve"], 1);
  const own = allowedTransitions(ap, booking("PENDING", 1));
  assert.ok(!own.includes("APPROVED") && !own.includes("REJECTED"), JSON.stringify(own));
  assert.deepEqual(own, ["CANCELLED"], "tetap boleh membatalkan miliknya sendiri");
});

test("pemegang booking.manage boleh menyetujui miliknya sendiri", () => {
  const admin = actor(["booking.approve", "booking.manage"], 1);
  assert.ok(allowedTransitions(admin, booking("PENDING", 1)).includes("APPROVED"));
});

test("approver tanpa booking.manage tidak dapat menunda, menyelesaikan, atau membatalkan milik orang lain", () => {
  const ap = actor(["booking.approve"], 1);
  assert.deepEqual(allowedTransitions(ap, booking("APPROVED", 2)), []);
});

test("booking.manage dapat semua transisi yang sah dari APPROVED", () => {
  const mgr = actor(["booking.manage"], 1);
  assert.deepEqual(
    allowedTransitions(mgr, booking("APPROVED", 2)).sort(),
    ["CANCELLED", "COMPLETED", "NO_SHOW", "POSTPONED"],
  );
});

test("persetujuan hanya mungkin dari PENDING atau POSTPONED (POSTPONED -> APPROVED butuh manage)", () => {
  const ap = actor(["booking.approve"], 1);
  assert.ok(!allowedTransitions(ap, booking("POSTPONED", 2)).includes("APPROVED"));
  const mgr = actor(["booking.manage"], 1);
  assert.ok(allowedTransitions(mgr, booking("POSTPONED", 2)).includes("APPROVED"));
});

test("jadwal ulang: pemilik atau manage, hanya pada status aktif", () => {
  assert.equal(canReschedule(actor([], 5), booking("APPROVED", 5)), true);
  assert.equal(canReschedule(actor([], 5), booking("APPROVED", 6)), false);
  assert.equal(canReschedule(actor(["booking.manage"], 5), booking("POSTPONED", 6)), true);
  assert.equal(canReschedule(actor(["booking.manage"], 5), booking("CANCELLED", 6)), false);
  assert.equal(canReschedule(actor(["booking.manage"], 5), booking("COMPLETED", 6)), false);
});

test("check-in hanya untuk APPROVED oleh pemilik atau manage", () => {
  assert.equal(canCheckIn(actor([], 5), booking("APPROVED", 5)), true);
  assert.equal(canCheckIn(actor([], 5), booking("PENDING", 5)), false);
  assert.equal(canCheckIn(actor([], 5), booking("APPROVED", 6)), false);
  assert.equal(canCheckIn(actor(["booking.manage"], 5), booking("APPROVED", 6)), true);
});

test("peserta tidak dapat diubah pada booking berstatus akhir", () => {
  assert.equal(canEditParticipants(actor([], 5), booking("APPROVED", 5)), true);
  assert.equal(canEditParticipants(actor([], 5), booking("CANCELLED", 5)), false);
  assert.equal(canEditParticipants(actor(["booking.manage"], 5), booking("COMPLETED", 6)), false);
});

test("validasi tanggal dan jam", () => {
  assert.equal(isDateString("2026-10-22"), true);
  for (const bad of ["2026-13-01", "22-10-2026", "2026-10-2", "", undefined, null, "2026-02-30x"]) {
    assert.equal(isDateString(bad), false, String(bad));
  }
  for (const ok of ["00:00", "09:05", "23:59"]) assert.equal(isTimeString(ok), true, ok);
  for (const bad of ["24:00", "9:00", "12:60", "", undefined, "12:00:00"]) assert.equal(isTimeString(bad), false, String(bad));
});

test("toTimestamptz memakai offset WIB tetap", () => {
  assert.equal(toTimestamptz("2026-10-22", "09:30"), "2026-10-22T09:30:00+07:00");
  assert.equal(new Date(toTimestamptz("2026-10-22", "00:00")).toISOString(), "2026-10-21T17:00:00.000Z");
});

test("addDays menghitung menurut tanggal WIB, termasuk batas bulan dan tahun", () => {
  assert.equal(addDays("2026-10-22", 1), "2026-10-23");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-10-22", 7), "2026-10-29");
});

test("parseTs membaca format timestamptz Postgres", () => {
  assert.equal(parseTs("2026-10-22 02:00:00+00").toISOString(), "2026-10-22T02:00:00.000Z");
  assert.equal(parseTs("2026-10-22 09:00:00+07").toISOString(), "2026-10-22T02:00:00.000Z");
  assert.equal(parseTs("2026-10-22 02:00:00.123456+00").getUTCMilliseconds(), 123);
});
