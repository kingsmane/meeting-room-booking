"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { iamTenantMember, iamUser, saasTenant } from "@/db/schema";
import { clientInfo, loginAudit, rowsOf } from "@/lib/audit";
import { verifyPassword } from "@/lib/password.mjs";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export type LoginState = { error?: string };

const MAX_FAILURES = 5; // per user dalam jendela waktu
const MAX_FAILURES_PER_IP = 30;
const WINDOW_MINUTES = 15;
const GENERIC = "Username atau password salah, atau akun terkunci sementara.";

// Hanya izinkan redirect ke path internal (mencegah open redirect).
function safeNext(v: string) {
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/";
}

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(String(fd.get("next") ?? "/"));

  if (!username || !password || username.length > 100 || password.length > 200) {
    return { error: "Username dan password wajib diisi." };
  }

  const [user] = await db
    .select({
      id: iamUser.id,
      status: iamUser.status,
      passwordHash: iamUser.passwordHash,
    })
    .from(iamUser)
    .where(sql`lower(${iamUser.username}) = lower(${username})`)
    .limit(1);

  const [member] = user
    ? await db
        .select({ tenantId: iamTenantMember.tenantId, status: iamTenantMember.status, tenantStatus: saasTenant.status })
        .from(iamTenantMember)
        .innerJoin(saasTenant, eq(saasTenant.id, iamTenantMember.tenantId))
        .where(eq(iamTenantMember.userId, user.id))
        .orderBy(iamTenantMember.id)
        .limit(1)
    : [];

  // Pembatasan percobaan: per user dan per IP.
  const { ip } = await clientInfo();
  const failures = rowsOf(
    await db.execute(sql`
      select
        count(*) filter (where user_id = ${user?.id ?? null}) as by_user,
        count(*) filter (where ${ip}::inet is not null and ip_address = ${ip}::inet) as by_ip
      from audit_login
      where success = false and login_at > now() - make_interval(mins => ${WINDOW_MINUTES})
    `),
  )[0];
  const locked =
    Number(failures?.by_user ?? 0) >= MAX_FAILURES || Number(failures?.by_ip ?? 0) >= MAX_FAILURES_PER_IP;

  // verifyPassword selalu dijalankan (juga untuk user yang tidak ada) agar waktu respons seragam.
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  const usable =
    !!user && !!member && user.status === "ACTIVE" && member.status === "ACTIVE" &&
    ["ACTIVE", "TRIAL"].includes(member.tenantStatus);

  if (locked || !passwordOk || !usable) {
    await loginAudit({
      userId: user?.id ?? null,
      tenantId: member?.tenantId ?? null,
      success: false,
      failureReason: locked ? "LOCKED" : !user ? "UNKNOWN_USER" : !passwordOk ? "BAD_PASSWORD" : "INACTIVE",
    });
    return { error: GENERIC };
  }

  await loginAudit({ userId: user.id, tenantId: member.tenantId, success: true });
  await db
    .update(iamUser)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(and(eq(iamUser.id, user.id)));
  await setSessionCookie(user.id);
  redirect(next);
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
