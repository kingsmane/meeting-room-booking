// Audit log, audit login, dan notifikasi. Dipanggil dari Server Action setelah operasi berhasil.
import { isIP } from "node:net";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";

type Actor = { tenantId: number; userId: number; username: string };

export async function clientInfo() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "";
  return {
    ip: isIP(forwarded) ? forwarded : null,
    userAgent: (h.get("user-agent") ?? "").slice(0, 500) || null,
  };
}

// Kegagalan menulis audit tidak boleh menggagalkan operasi yang sudah berhasil, tapi dicatat ke log server.
export async function audit(
  actor: Actor,
  e: {
    module: string;
    table: string;
    recordId?: number | null;
    action: string;
    oldData?: unknown;
    newData?: unknown;
  },
) {
  try {
    const { ip, userAgent } = await clientInfo();
    await db.execute(sql`
      insert into audit_log (tenant_id, user_id, actor_nik, module, table_name, record_id, action,
                             old_data, new_data, ip_address, user_agent, request_id)
      values (${actor.tenantId}, ${actor.userId}, ${actor.username}, ${e.module}, ${e.table},
              ${e.recordId ?? null}, ${e.action},
              ${e.oldData === undefined ? null : JSON.stringify(e.oldData)}::jsonb,
              ${e.newData === undefined ? null : JSON.stringify(e.newData)}::jsonb,
              ${ip}::inet, ${userAgent}, gen_random_uuid())
    `);
  } catch (err) {
    console.error("audit gagal ditulis", err);
  }
}

export async function loginAudit(e: {
  userId: number | null;
  tenantId: number | null;
  success: boolean;
  failureReason?: string;
}) {
  try {
    const { ip, userAgent } = await clientInfo();
    await db.execute(sql`
      insert into audit_login (user_id, tenant_id, ip_address, user_agent, platform, success, failure_reason)
      values (${e.userId}, ${e.tenantId}, ${ip}::inet, ${userAgent}, 'WEB', ${e.success}, ${e.failureReason ?? null})
    `);
  } catch (err) {
    console.error("audit login gagal ditulis", err);
  }
}

export async function notify(
  tenantId: number,
  userIds: number[],
  n: { type: string; title: string; message: string; refType?: string; refId?: number },
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  try {
    for (const userId of unique) {
      await db.execute(sql`
        insert into notification (tenant_id, user_id, notification_type, title, message, reference_type, reference_id)
        values (${tenantId}, ${userId}, ${n.type}, ${n.title}, ${n.message}, ${n.refType ?? null}, ${n.refId ?? null})
      `);
    }
  } catch (err) {
    console.error("notifikasi gagal ditulis", err);
  }
}

// User yang berhak menyetujui booking (punya izin booking.approve lewat peran aktif).
export async function approverUserIds(tenantId: number): Promise<number[]> {
  const res = await db.execute(sql`
    select distinct m.user_id as id
    from iam_tenant_member m
    join iam_member_role mr on mr.member_id = m.id
    join iam_role r on r.id = mr.role_id and r.is_active
    join iam_role_permission rp on rp.role_id = r.id
    join iam_permission p on p.id = rp.permission_id and p.permission_code = 'booking.approve'
    join iam_user u on u.id = m.user_id and u.status = 'ACTIVE'
    where m.tenant_id = ${tenantId} and m.status = 'ACTIVE'
  `);
  return rowsOf(res).map((r) => Number(r.id));
}

export function rowsOf(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  return (res as { rows?: Record<string, unknown>[] }).rows ?? [];
}
