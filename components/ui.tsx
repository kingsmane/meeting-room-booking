// Komponen tata letak bersama untuk halaman dalam aplikasi (template admin).
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// Kartu dengan judul dan toolbar opsional. `flush` = isi (tabel) menempel ke tepi kartu.
export function Card({
  title,
  toolbar,
  children,
  flush,
  className = "",
}: {
  title?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(title || toolbar) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
          {toolbar}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

const TONES = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
} as const;

export function StatCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  icon: IconName;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon name={icon} className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-slate-900">{value}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// Form pencarian berbasis GET (tanpa JavaScript). `keep` = parameter lain yang dipertahankan.
export function SearchBar({
  q,
  placeholder,
  keep = {},
  resetHref,
}: {
  q: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
  resetHref: string;
}) {
  return (
    <form className="flex items-center gap-2" role="search">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="relative">
        <span className="sr-only">Cari</span>
        <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={placeholder}
          className="h-9 w-56 rounded-lg bg-slate-50 pl-8 pr-3 text-sm ring-1 ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]"
        />
      </label>
      <button className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">Cari</button>
      {q && (
        <Link href={resetHref} className="text-sm font-semibold text-slate-500 hover:underline">
          Reset
        </Link>
      )}
    </form>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-slate-500">
        {children}
      </td>
    </tr>
  );
}

export const th = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
