// Paging di sisi server: halaman dan ukuran dibaca dari query string, data diambil dengan LIMIT/OFFSET.
// Total baris diambil di query yang sama lewat window function `count(*) over()`, jadi tidak ada query hitung terpisah.
export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parsePaging(params: Params, opts: { pageKey?: string; sizeKey?: string } = {}) {
  const { pageKey = "page", sizeKey = "size" } = opts;
  const n = Math.floor(Number(first(params[pageKey])));
  // Tak hingga, NaN, nol, dan negatif dianggap tidak valid; batas atas menjaga OFFSET tetap wajar.
  const page = Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : 1;
  const rawSize = Number(first(params[sizeKey]));
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  return { page, size };
}

export function parseSearch(params: Params, key = "q"): string {
  return (first(params[key]) ?? "").trim().slice(0, 100);
}

// Pola ILIKE yang aman: karakter khusus pada input pengguna di-escape.
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

export type Page<T> = { rows: T[]; total: number; page: number; size: number; pages: number };

// `run` harus menyertakan `total` (count(*) over()) di setiap baris. Jika halaman yang diminta melebihi
// jumlah halaman (mis. data berkurang), otomatis mundur ke halaman terakhir.
export async function fetchPage<T extends { total: number }>(
  run: (limit: number, offset: number) => Promise<T[]>,
  page: number,
  size: number,
): Promise<Page<T>> {
  let current = page;
  let rows = await run(size, (current - 1) * size);
  if (rows.length === 0 && current > 1) {
    const probe = await run(1, 0);
    const total = probe[0]?.total ?? 0;
    current = Math.max(1, Math.ceil(total / size));
    rows = total ? await run(size, (current - 1) * size) : [];
  }
  const total = rows[0]?.total ?? 0;
  return { rows, total, page: current, size, pages: Math.max(1, Math.ceil(total / size)) };
}
