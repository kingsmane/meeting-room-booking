// Tes unit untuk lib/password.mjs dan lib/permissions.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../../lib/password.mjs";
import { PERMISSION_DEFS, ROLE_DEFS, SCOPE_RANK } from "../../lib/permissions.mjs";

test("hash password: format scrypt, garam acak, bukan teks asli", async () => {
  const a = await hashPassword("Rahasia123");
  const b = await hashPassword("Rahasia123");
  assert.match(a, /^scrypt\$\d+\$[\w-]+\$[\w-]+$/);
  assert.notEqual(a, b, "garam harus berbeda");
  assert.ok(!a.includes("Rahasia123"));
});

test("verifyPassword: benar, salah, dan hash kosong/rusak", async () => {
  const h = await hashPassword("Rahasia123");
  assert.equal(await verifyPassword("Rahasia123", h), true);
  assert.equal(await verifyPassword("rahasia123", h), false);
  assert.equal(await verifyPassword("", h), false);
  assert.equal(await verifyPassword("Rahasia123", null), false);
  assert.equal(await verifyPassword("Rahasia123", undefined), false);
  assert.equal(await verifyPassword("Rahasia123", "bukan-hash"), false);
  assert.equal(await verifyPassword("Rahasia123", "scrypt$16384$xx$yy"), false);
});

test("peran hanya memakai izin yang terdaftar", () => {
  const known = new Set(PERMISSION_DEFS.map((p) => p.code));
  assert.equal(known.size, PERMISSION_DEFS.length, "kode izin harus unik");
  for (const role of ROLE_DEFS) {
    for (const code of Object.keys(role.permissions)) assert.ok(known.has(code), `${role.code}: ${code}`);
  }
});

test("scope hanya dipakai pada booking.view dan nilainya valid", () => {
  for (const role of ROLE_DEFS) {
    for (const [code, scope] of Object.entries(role.permissions)) {
      if (scope === null) continue;
      assert.equal(code, "booking.view", `${role.code} memberi scope pada ${code}`);
      assert.ok(scope in SCOPE_RANK, `${role.code}: ${scope}`);
    }
  }
});

test("TENANT_ADMIN memegang semua izin", () => {
  const admin = ROLE_DEFS.find((r) => r.code === "TENANT_ADMIN");
  assert.deepEqual(Object.keys(admin.permissions).sort(), PERMISSION_DEFS.map((p) => p.code).sort());
});

test("karyawan tidak memegang izin administratif", () => {
  const emp = ROLE_DEFS.find((r) => r.code === "EMPLOYEE");
  for (const forbidden of ["booking.approve", "booking.manage", "room.manage", "master.manage", "user.manage", "settings.manage", "audit.view"]) {
    assert.ok(!(forbidden in emp.permissions), forbidden);
  }
  assert.equal(emp.permissions["booking.view"], "OWN");
});

test("urutan scope: OWN < DEPARTMENT < ALL", () => {
  assert.ok(SCOPE_RANK.OWN < SCOPE_RANK.DEPARTMENT && SCOPE_RANK.DEPARTMENT < SCOPE_RANK.ALL);
});
