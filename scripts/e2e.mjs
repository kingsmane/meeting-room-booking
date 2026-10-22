// Runner tes end-to-end. Menjalankan tests/e2e/*.mjs terhadap server yang sudah berjalan.
//   npm run build && npm start        (terminal lain, port 3100: `npx next start -p 3100`)
//   npm run test:e2e -- --yes
//
// PERINGATAN: runner menghapus dan mengisi ulang seluruh data tenant DEMO di database pada DATABASE_URL,
// dan membuat data uji di dalamnya. Jangan diarahkan ke database yang berisi data tenant DEMO yang penting.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const root = join(import.meta.dirname, "..");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const sql = neon(process.env.DATABASE_URL);

if (!process.argv.includes("--yes")) {
  const host = new URL(process.env.DATABASE_URL).host;
  console.error(
    `Tes E2E akan MENGHAPUS dan mengisi ulang tenant DEMO di database ${host}.\n` +
      `Jalankan lagi dengan: npm run test:e2e -- --yes`,
  );
  process.exit(2);
}

try {
  await fetch(`${BASE}/login`, { redirect: "manual" });
} catch {
  console.error(`Server tidak dapat dijangkau di ${BASE}.\nJalankan dulu: npm run build && npx next start -p 3100`);
  process.exit(2);
}

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("exit", (code) => resolve(code ?? 1));
  });

// User buatan tes yang keanggotaannya sudah terhapus oleh reseed tidak boleh tersisa (username unik global).
async function removeOrphanUsers() {
  const orphans = await sql`
    select id from iam_user u
    where username not like ${"demo.%"} and not exists (select 1 from iam_tenant_member m where m.user_id = u.id)`;
  for (const u of orphans) {
    await sql`delete from audit_login where user_id = ${u.id}`;
    await sql`delete from iam_user where id = ${u.id}`;
  }
}

const reseed = async () => {
  const code = await run(["scripts/seed.mjs", "--reset"]);
  if (code !== 0) {
    console.error("Seed gagal; tes dibatalkan.");
    process.exit(2);
  }
  // Setelah reseed: penghapusan tenant membuat user buatan tes tanpa keanggotaan (yatim), dan username-nya unik global.
  await removeOrphanUsers();
};

const suites = readdirSync(join(root, "tests", "e2e"))
  .filter((f) => /^\d+-.*\.mjs$/.test(f))
  .sort();

const results = [];
for (const suite of suites) {
  console.log(`\n######## ${suite}`);
  await reseed();
  results.push([suite, await run([join("tests", "e2e", suite)])]);
}
await reseed(); // tinggalkan database dalam kondisi seed bersih

console.log("\n######## Ringkasan");
for (const [suite, code] of results) console.log(`  ${code === 0 ? "LULUS " : "GAGAL "} ${suite}`);
process.exit(results.every(([, c]) => c === 0) ? 0 : 1);
