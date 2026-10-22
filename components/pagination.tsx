import Link from "next/link";
import { Icon } from "@/components/icons";
import { PAGE_SIZES } from "@/lib/pagination";

type Query = Record<string, string | undefined>;

function href(pathname: string, query: Query, overrides: Query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...query, ...overrides })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${pathname}?${s}` : pathname;
}

// Nomor halaman dengan elipsis: 1 … 4 5 [6] 7 8 … 20
function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold";

// `query` = parameter lain yang harus dipertahankan (pencarian, tanggal, halaman tabel lain).
export function Pagination({
  total,
  page,
  pages,
  size,
  pathname,
  query = {},
  pageKey = "page",
  sizeKey = "size",
}: {
  total: number;
  page: number;
  pages: number;
  size: number;
  pathname: string;
  query?: Query;
  pageKey?: string;
  sizeKey?: string;
}) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const go = (n: number) => href(pathname, { ...query, [sizeKey]: size === 10 ? undefined : String(size) }, { [pageKey]: n === 1 ? undefined : String(n) });

  return (
    <nav
      aria-label="Paging"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan <b className="text-slate-900">{from}–{to}</b> dari <b className="text-slate-900">{total}</b>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-slate-500">Per halaman</span>
          {PAGE_SIZES.map((s) => (
            <Link
              key={s}
              href={href(pathname, { ...query }, { [sizeKey]: s === 10 ? undefined : String(s), [pageKey]: undefined })}
              aria-current={s === size ? "true" : undefined}
              className={`${btn} ${s === size ? "bg-slate-900 text-white" : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {s}
            </Link>
          ))}
        </span>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={go(page - 1)} aria-label="Halaman sebelumnya" className={`${btn} ring-1 ring-slate-200 hover:bg-slate-50`}>
              <Icon name="chevronLeft" className="size-4" />
            </Link>
          ) : (
            <span className={`${btn} text-slate-300 ring-1 ring-slate-100`}>
              <Icon name="chevronLeft" className="size-4" />
            </span>
          )}
          {pageWindow(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={go(n)}
                aria-current={n === page ? "page" : undefined}
                className={`${btn} ${n === page ? "bg-[#0d2a7a] text-white" : "ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={go(page + 1)} aria-label="Halaman berikutnya" className={`${btn} ring-1 ring-slate-200 hover:bg-slate-50`}>
              <Icon name="chevronRight" className="size-4" />
            </Link>
          ) : (
            <span className={`${btn} text-slate-300 ring-1 ring-slate-100`}>
              <Icon name="chevronRight" className="size-4" />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
