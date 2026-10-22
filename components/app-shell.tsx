"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; group: string };

type Props = {
  items: NavItem[];
  tenantName: string;
  user: { name: string; subtitle: string };
  unread: number;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
};

const LABELS: Record<string, string> = {
  book: "Booking Baru",
  bookings: "Booking",
  notifications: "Notifikasi",
  account: "Akun Saya",
  admin: "Administrasi",
  rooms: "Ruangan",
  master: "Data Master",
  users: "Pengguna",
  settings: "Pengaturan",
  audit: "Audit Log",
};

function breadcrumb(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return ["Beranda"];
  if (pathname === "/admin") return ["Administrasi", "Jadwal Booking"];
  return parts.map((p) => (/^\d+$/.test(p) ? "Detail" : (LABELS[p] ?? p)));
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function AppShell({ items, tenantName, user, unread, logoutAction, children }: Props) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Tutup drawer dan menu saat berpindah halaman (menyesuaikan state saat render, tanpa effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawer(false);
    setMenu(false);
  }

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const active = (href: string) =>
    pathname === href || (href !== "/" && href !== "/admin" && pathname.startsWith(`${href}/`));
  const groups = [...new Set(items.map((i) => i.group))];
  const crumbs = breadcrumb(pathname);

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-yellow-400 text-sm font-black text-slate-900">
          MR
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-white">Meeting Room</p>
          <p className="truncate text-xs text-slate-400">{tenantName}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menu utama">
        {groups.map((g) => (
          <div key={g}>
            <p className="px-3 pb-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">{g}</p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active(i.href) ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        active(i.href)
                          ? "bg-[#0d2a7a] text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active(i.href) && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-yellow-400" />}
                      <Icon name={i.icon} className="size-5 shrink-0" />
                      <span className="flex-1 truncate">{i.label}</span>
                      {!!i.badge && (
                        <span className="rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-slate-900">{i.badge}</span>
                      )}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
      <p className="shrink-0 border-t border-white/10 px-5 py-3 text-[0.7rem] text-slate-500">Meeting Room Booking</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Buka menu"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 truncate text-sm text-slate-500">
              <li className="hidden sm:block">
                <Link href="/" className="hover:text-slate-900">
                  Beranda
                </Link>
              </li>
              {crumbs
                .filter((c, i) => !(i === 0 && c === "Beranda"))
                .map((c, i, arr) => (
                  <li key={`${c}-${i}`} className="flex items-center gap-1.5">
                    <span className={`text-slate-300 ${i === 0 ? "hidden sm:inline" : ""}`}>/</span>
                    <span className={i === arr.length - 1 ? "font-semibold text-slate-900" : ""}>{c}</span>
                  </li>
                ))}
              {crumbs.length === 1 && crumbs[0] === "Beranda" && (
                <li className="font-semibold text-slate-900 sm:hidden">Beranda</li>
              )}
            </ol>
          </nav>

          <Link
            href="/notifications"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
          >
            <Icon name="bell" />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-bold leading-4 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#0d2a7a] text-xs font-bold text-white">
                {initials(user.name)}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-40 truncate text-sm font-semibold">{user.name}</span>
                <span className="block max-w-40 truncate text-xs text-slate-500">{user.subtitle}</span>
              </span>
              <Icon name="chevronDown" className="hidden size-4 text-slate-400 md:block" />
            </button>
            {/* Selalu ada di DOM (hanya disembunyikan) supaya form Keluar tetap dirender dari server. */}
            <div
              role="menu"
              hidden={!menu}
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.subtitle}</p>
              </div>
              <Link
                href="/account"
                role="menuitem"
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50"
              >
                <Icon name="user" className="size-4 text-slate-500" /> Akun saya
              </Link>
              <form action={logoutAction}>
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                >
                  <Icon name="logout" className="size-4" /> Keluar
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
