"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number; group: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || (href !== "/" && href !== "/admin" && pathname.startsWith(`${href}/`));

  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {groups.map((g) => (
        <div key={g} className="flex gap-1 md:flex-col">
          <p className="hidden px-3 pb-1 pt-3 text-[0.65rem] font-bold uppercase tracking-widest text-white/40 md:block">
            {g}
          </p>
          {items
            .filter((i) => i.group === g)
            .map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active(i.href) ? "page" : undefined}
                className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${
                  active(i.href) ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {i.label}
                {!!i.badge && (
                  <span className="rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-slate-900">
                    {i.badge}
                  </span>
                )}
              </Link>
            ))}
        </div>
      ))}
    </nav>
  );
}
