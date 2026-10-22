// Definisi izin dan peran. Dipakai bersama oleh aplikasi dan scripts/seed.mjs
// supaya data di database dan pemeriksaan di kode tidak pernah berbeda.

/** @type {{ code: string, name: string, module: string }[]} */
export const PERMISSION_DEFS = [
  { code: "booking.view", name: "Melihat booking", module: "booking" },
  { code: "booking.create", name: "Membuat booking", module: "booking" },
  { code: "booking.approve", name: "Menyetujui / menolak booking", module: "booking" },
  { code: "booking.manage", name: "Mengelola semua booking (batal, tunda, jadwal ulang, check-in)", module: "booking" },
  { code: "room.manage", name: "Mengelola ruangan dan blokir ruangan", module: "room" },
  { code: "master.manage", name: "Mengelola data master (departemen, tipe rapat, fasilitas)", module: "master" },
  { code: "user.manage", name: "Mengelola pengguna dan peran", module: "user" },
  { code: "settings.manage", name: "Mengelola pengaturan dan layar TV", module: "settings" },
  { code: "audit.view", name: "Melihat audit log", module: "audit" },
];

/**
 * scope hanya berlaku untuk booking.view: OWN (milik sendiri), DEPARTMENT (satu departemen), ALL.
 * @type {{ code: string, name: string, description: string, permissions: Record<string, string | null> }[]}
 */
export const ROLE_DEFS = [
  {
    code: "TENANT_ADMIN",
    name: "Administrator",
    description: "Akses penuh ke seluruh fitur tenant.",
    permissions: {
      "booking.view": "ALL",
      "booking.create": null,
      "booking.approve": null,
      "booking.manage": null,
      "room.manage": null,
      "master.manage": null,
      "user.manage": null,
      "settings.manage": null,
      "audit.view": null,
    },
  },
  {
    code: "GA_STAFF",
    name: "Staf GA",
    description: "Mengelola operasional booking, ruangan, dan data master.",
    permissions: {
      "booking.view": "ALL",
      "booking.create": null,
      "booking.approve": null,
      "booking.manage": null,
      "room.manage": null,
      "master.manage": null,
    },
  },
  {
    code: "APPROVER",
    name: "Approver",
    description: "Menyetujui atau menolak pengajuan booking.",
    permissions: { "booking.view": "ALL", "booking.create": null, "booking.approve": null },
  },
  {
    code: "DEPT_HEAD",
    name: "Kepala Departemen",
    description: "Melihat booking departemennya dan menyetujui pengajuan.",
    permissions: { "booking.view": "DEPARTMENT", "booking.create": null, "booking.approve": null },
  },
  {
    code: "EMPLOYEE",
    name: "Karyawan",
    description: "Membuat booking dan melihat booking miliknya.",
    permissions: { "booking.view": "OWN", "booking.create": null },
  },
];

export const SCOPE_RANK = { OWN: 1, DEPARTMENT: 2, ALL: 3 };
