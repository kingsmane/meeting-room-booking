// Tes unit untuk lib/pagination.ts (paging, pencarian aman, dan fallback ke halaman terakhir).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, fetchPage, likePattern, parsePaging, parseSearch } from "../../lib/pagination.ts";

test("parsePaging: nilai default", () => {
  assert.deepEqual(parsePaging({}), { page: 1, size: DEFAULT_PAGE_SIZE });
});

test("parsePaging: halaman valid dibaca, yang tidak valid menjadi 1", () => {
  assert.equal(parsePaging({ page: "3" }).page, 3);
  for (const bad of ["abc", "0", "-4", "", "1e999", "NaN", undefined]) {
    assert.equal(parsePaging({ page: bad }).page, 1, String(bad));
  }
  assert.equal(parsePaging({ page: "2.9" }).page, 2, "pecahan dibulatkan ke bawah");
  assert.equal(parsePaging({ page: ["4", "9"] }).page, 4, "parameter ganda: ambil yang pertama");
});

test("parsePaging: halaman dibatasi supaya OFFSET tidak meluap", () => {
  assert.ok(parsePaging({ page: "999999999999" }).page <= 100000);
});

test("parsePaging: ukuran hanya boleh dari daftar yang diizinkan", () => {
  for (const s of PAGE_SIZES) assert.equal(parsePaging({ size: String(s) }).size, s);
  for (const bad of ["7", "0", "-1", "1000", "999999", "abc", ""]) {
    assert.equal(parsePaging({ size: bad }).size, DEFAULT_PAGE_SIZE, bad);
  }
});

test("parsePaging: kunci parameter dapat diubah (dua tabel pada satu halaman)", () => {
  const r = parsePaging({ lpage: "5", page: "2", size: "25" }, { pageKey: "lpage" });
  assert.deepEqual(r, { page: 5, size: 25 });
});

test("parseSearch: dipangkas dan dibatasi panjangnya", () => {
  assert.equal(parseSearch({ q: "  halo  " }), "halo");
  assert.equal(parseSearch({}), "");
  assert.equal(parseSearch({ q: "x".repeat(500) }).length, 100);
  assert.equal(parseSearch({ q: ["a", "b"] }), "a");
});

test("likePattern: karakter khusus ILIKE di-escape", () => {
  assert.equal(likePattern("abc"), "%abc%");
  assert.equal(likePattern("50%"), "%50\\%%");
  assert.equal(likePattern("a_b"), "%a\\_b%");
  assert.equal(likePattern("a\\b"), "%a\\\\b%");
  assert.equal(likePattern("%"), "%\\%%", "satu % tidak boleh menjadi wildcard");
});

// Simulasi sumber data: `total` ikut di setiap baris seperti count(*) over().
const source = (n) => async (limit, offset) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, total: n })).slice(offset, offset + limit);

test("fetchPage: halaman tengah dan terakhir", async () => {
  const mid = await fetchPage(source(24), 2, 10);
  assert.deepEqual([mid.rows[0].id, mid.rows.at(-1).id, mid.total, mid.pages, mid.page], [11, 20, 24, 3, 2]);
  const last = await fetchPage(source(24), 3, 10);
  assert.equal(last.rows.length, 4);
});

test("fetchPage: jumlah baris pas kelipatan ukuran halaman", async () => {
  const r = await fetchPage(source(20), 2, 10);
  assert.deepEqual([r.rows.length, r.pages, r.total], [10, 2, 20]);
});

test("fetchPage: halaman di luar jangkauan mundur ke halaman terakhir", async () => {
  const r = await fetchPage(source(24), 99, 10);
  assert.equal(r.page, 3);
  assert.deepEqual([r.rows[0].id, r.rows.length], [21, 4]);
});

test("fetchPage: data kosong tidak error dan tetap 1 halaman", async () => {
  const r = await fetchPage(source(0), 1, 10);
  assert.deepEqual([r.rows.length, r.total, r.pages, r.page], [0, 0, 1, 1]);
  const beyond = await fetchPage(source(0), 5, 10);
  assert.deepEqual([beyond.rows.length, beyond.total, beyond.page], [0, 0, 1]);
});

test("fetchPage: tanpa baris ganda atau hilang di seluruh halaman", async () => {
  const seen = [];
  for (let p = 1; p <= 4; p++) seen.push(...(await fetchPage(source(37), p, 10)).rows.map((r) => r.id));
  assert.equal(seen.length, 37);
  assert.equal(new Set(seen).size, 37);
});
