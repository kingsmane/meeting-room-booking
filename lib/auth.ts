// Data Access Layer untuk autentikasi dan otorisasi. Semua halaman dan Server Action memanggil
// requireUser / requirePermission di sini; proxy.ts hanya pengecekan awal, bukan batas keamanan.
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  iamMemberRole,
  iamPermission,
  iamRole,
  iamRolePermission,
  iamRoleScope,
  iamTenantMember,
  iamUser,
  orgDepartment,
  saasTenant,
} from "@/db/schema";
import { readSessionUserId } from "@/lib/session";
import { SCOPE_RANK } from "@/lib/permissions.mjs";

export type BookingScope = "ALL" | "DEPARTMENT" | "OWN";

export type SessionUser = {
  userId: number;
  memberId: number;
  tenantId: number;
  tenantName: string;
  tenantCode: string;
  fullName: string;
  username: string;
  departmentId: number | null;
  departmentName: string | null;
  permissions: Set<string>;
  roleNames: string[];
  bookingScope: BookingScope;
};

// Dibungkus cache() supaya satu request hanya membaca database sekali.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const [row] = await db
    .select({
      userId: iamUser.id,
      username: iamUser.username,
      fullName: iamUser.fullName,
      userStatus: iamUser.status,
      memberId: iamTenantMember.id,
      memberStatus: iamTenantMember.status,
      departmentId: iamTenantMember.departmentId,
      departmentName: orgDepartment.departmentName,
      tenantId: saasTenant.id,
      tenantName: saasTenant.tenantName,
      tenantCode: saasTenant.tenantCode,
      tenantStatus: saasTenant.status,
    })
    .from(iamUser)
    .innerJoin(iamTenantMember, eq(iamTenantMember.userId, iamUser.id))
    .innerJoin(saasTenant, eq(saasTenant.id, iamTenantMember.tenantId))
    .leftJoin(orgDepartment, eq(orgDepartment.id, iamTenantMember.departmentId))
    .where(eq(iamUser.id, userId))
    .orderBy(asc(iamTenantMember.id))
    .limit(1);

  if (
    !row ||
    row.userStatus !== "ACTIVE" ||
    row.memberStatus !== "ACTIVE" ||
    !["ACTIVE", "TRIAL"].includes(row.tenantStatus)
  ) {
    return null;
  }

  const grants = await db
    .select({ code: iamPermission.permissionCode, scope: iamRoleScope.scopeType, roleName: iamRole.roleName })
    .from(iamMemberRole)
    .innerJoin(iamRole, eq(iamRole.id, iamMemberRole.roleId))
    .innerJoin(iamRolePermission, eq(iamRolePermission.roleId, iamRole.id))
    .innerJoin(iamPermission, eq(iamPermission.id, iamRolePermission.permissionId))
    .leftJoin(
      iamRoleScope,
      and(eq(iamRoleScope.roleId, iamRole.id), eq(iamRoleScope.permissionId, iamPermission.id)),
    )
    .where(
      and(
        eq(iamMemberRole.memberId, row.memberId),
        eq(iamRole.isActive, true),
        or(isNull(iamRole.tenantId), eq(iamRole.tenantId, row.tenantId)),
      ),
    );

  const permissions = new Set(grants.map((g) => g.code));
  const roleNames = [...new Set(grants.map((g) => g.roleName))];
  // Scope terluas di antara semua peran yang dimiliki untuk booking.view.
  let bookingScope: BookingScope = "OWN";
  let best = 0;
  for (const g of grants) {
    if (g.code !== "booking.view") continue;
    const scope = (g.scope ?? "ALL") as BookingScope;
    const rank = SCOPE_RANK[scope] ?? 0;
    if (rank > best) {
      best = rank;
      bookingScope = scope;
    }
  }

  return {
    userId: row.userId,
    memberId: row.memberId,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantCode: row.tenantCode,
    fullName: row.fullName,
    username: row.username,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    permissions,
    roleNames,
    bookingScope,
  };
});

export function can(user: SessionUser, code: string) {
  return user.permissions.has(code);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Untuk halaman dan Server Action: pastikan login dan punya salah satu izin yang disebut.
export async function requirePermission(...codes: string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!codes.some((c) => can(user, c))) redirect("/forbidden");
  return user;
}
