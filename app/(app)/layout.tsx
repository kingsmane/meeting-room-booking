import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { countPendingApprovals, countUnread } from "@/lib/data";
import { logout } from "@/app/login/actions";
import { NavLinks, type NavItem } from "@/components/nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-slate-500">Memuat…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const approver = can(user, "booking.approve");
  const [unread, pending] = await Promise.all([
    countUnread(user),
    approver ? countPendingApprovals(user) : Promise.resolve(0),
  ]);

  const items: NavItem[] = [{ href: "/", label: "Beranda", group: "Menu" }];
  if (can(user, "booking.create")) items.push({ href: "/book", label: "Booking Baru", group: "Menu" });
  items.push({ href: "/notifications", label: "Notifikasi", badge: unread, group: "Menu" });
  items.push({ href: "/account", label: "Akun Saya", group: "Menu" });

  const seesSchedule = can(user, "booking.manage") || approver || user.bookingScope !== "OWN";
  if (seesSchedule) items.push({ href: "/admin", label: "Jadwal Booking", badge: pending, group: "Administrasi" });
  if (can(user, "room.manage")) items.push({ href: "/admin/rooms", label: "Ruangan", group: "Administrasi" });
  if (can(user, "master.manage")) items.push({ href: "/admin/master", label: "Data Master", group: "Administrasi" });
  if (can(user, "user.manage")) items.push({ href: "/admin/users", label: "Pengguna", group: "Administrasi" });
  if (can(user, "settings.manage")) items.push({ href: "/admin/settings", label: "Pengaturan", group: "Administrasi" });
  if (can(user, "audit.view")) items.push({ href: "/admin/audit", label: "Audit Log", group: "Administrasi" });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="bg-[#0d2a7a] text-white md:flex md:min-h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="px-5 py-4">
          <p className="text-xs font-bold tracking-widest text-yellow-400">{user.tenantName.toUpperCase()}</p>
          <p className="text-lg font-black leading-tight">Meeting Room Booking</p>
        </div>
        <NavLinks items={items} />
        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 md:block">
          <p className="truncate text-sm font-bold">{user.fullName}</p>
          <p className="truncate text-xs text-white/60">{user.departmentName ?? user.username}</p>
          <form action={logout} className="mt-2">
            <button className="text-xs font-semibold text-yellow-300 hover:underline">Keluar</button>
          </form>
        </div>
        <form action={logout} className="flex items-center justify-between border-t border-white/10 px-5 py-2 md:hidden">
          <span className="truncate text-xs">{user.fullName}</span>
          <button className="text-xs font-semibold text-yellow-300">Keluar</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
