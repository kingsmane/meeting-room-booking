// Menjalankan semua file db/migrations/*.sql berurutan. Semua file harus idempotent (IF NOT EXISTS).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const dir = join(import.meta.dirname, "..", "db", "migrations");
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const text = readFileSync(join(dir, f), "utf8");
  // neon http menjalankan satu statement per panggilan; pisahkan di titik koma akhir baris.
  for (const stmt of text.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^(--.*\n?)+$/.test(s))) {
    await sql.query(stmt);
  }
  console.log("OK", f);
}
