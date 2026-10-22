import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { countPendingApprovals, countUnread } from "@/lib/data";
import { logout } from "@/app/login/actions";
import { AppShell, type NavItem } from "@/components/app-shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 p-8 text-slate-500">Memuat…</div>}>
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

  const items: NavItem[] = [{ href: "/", label: "Beranda", icon: "home", group: "Menu" }];
  if (can(user, "booking.create")) items.push({ href: "/book", label: "Booking Baru", icon: "plus", group: "Menu" });
  items.push({ href: "/notifications", label: "Notifikasi", icon: "bell", badge: unread, group: "Menu" });
  items.push({ href: "/account", label: "Akun Saya", icon: "user", group: "Menu" });

  const seesSchedule = can(user, "booking.manage") || approver || user.bookingScope !== "OWN";
  if (seesSchedule) items.push({ href: "/admin", label: "Jadwal Booking", icon: "calendar", badge: pending, group: "Administrasi" });
  if (can(user, "room.manage")) items.push({ href: "/admin/rooms", label: "Ruangan", icon: "building", group: "Administrasi" });
  if (can(user, "master.manage")) items.push({ href: "/admin/master", label: "Data Master", icon: "database", group: "Administrasi" });
  if (can(user, "user.manage")) items.push({ href: "/admin/users", label: "Pengguna", icon: "users", group: "Administrasi" });
  if (can(user, "settings.manage")) items.push({ href: "/admin/settings", label: "Pengaturan", icon: "cog", group: "Administrasi" });
  if (can(user, "audit.view")) items.push({ href: "/admin/audit", label: "Audit Log", icon: "shield", group: "Administrasi" });

  return (
    <AppShell
      items={items}
      tenantName={user.tenantName}
      user={{
        name: user.fullName,
        subtitle: [user.roleNames[0], user.departmentName].filter(Boolean).join(" · ") || user.username,
      }}
      unread={unread}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
