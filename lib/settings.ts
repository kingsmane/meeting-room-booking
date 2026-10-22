// Pengaturan tenant (saas_tenant_setting.settings, jsonb): pengumuman, parameter layar TV, token layar.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { saasTenant, saasTenantSetting } from "@/db/schema";

export type DisplaySettings = {
  soonMinutes: number;
  pageSize: number;
  rotateSeconds: number;
  refreshSeconds: number;
};

export type TenantSettings = {
  announcements: string[];
  display: DisplaySettings;
  displayToken: string | null;
};

export const DISPLAY_DEFAULTS: DisplaySettings = {
  soonMinutes: 30,
  pageSize: 8,
  rotateSeconds: 12,
  refreshSeconds: 60,
};

export const DISPLAY_LIMITS = {
  soonMinutes: [5, 180],
  pageSize: [3, 12],
  rotateSeconds: [5, 120],
  refreshSeconds: [15, 600],
} as const;

const clamp = (v: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export function normalizeSettings(raw: unknown): TenantSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const d = (s.display ?? {}) as Record<string, unknown>;
  return {
    announcements: Array.isArray(s.announcements)
      ? s.announcements.filter((a): a is string => typeof a === "string" && a.trim() !== "")
      : [],
    display: {
      soonMinutes: clamp(d.soonMinutes, DISPLAY_LIMITS.soonMinutes, DISPLAY_DEFAULTS.soonMinutes),
      pageSize: clamp(d.pageSize, DISPLAY_LIMITS.pageSize, DISPLAY_DEFAULTS.pageSize),
      rotateSeconds: clamp(d.rotateSeconds, DISPLAY_LIMITS.rotateSeconds, DISPLAY_DEFAULTS.rotateSeconds),
      refreshSeconds: clamp(d.refreshSeconds, DISPLAY_LIMITS.refreshSeconds, DISPLAY_DEFAULTS.refreshSeconds),
    },
    displayToken: typeof s.displayToken === "string" && s.displayToken ? s.displayToken : null,
  };
}

export async function getSettings(tenantId: number): Promise<TenantSettings> {
  const [row] = await db
    .select({ settings: saasTenantSetting.settings })
    .from(saasTenantSetting)
    .where(eq(saasTenantSetting.tenantId, tenantId))
    .limit(1);
  return normalizeSettings(row?.settings);
}

// Menggabungkan perubahan ke jsonb yang ada (bukan menimpa), supaya kunci lain tidak hilang.
export async function patchSettings(tenantId: number, patch: Record<string, unknown>) {
  await db.execute(sql`
    insert into saas_tenant_setting (tenant_id, settings)
    values (${tenantId}, ${JSON.stringify(patch)}::jsonb)
    on conflict (tenant_id) do update
      set settings = saas_tenant_setting.settings || excluded.settings, updated_at = now()
  `);
}

export function newDisplayToken() {
  return randomBytes(18).toString("base64url");
}

// Layar TV tidak punya login; aksesnya dijaga token per tenant di URL.
export async function resolveDisplayTenant(tenantCode: string, key: string | undefined) {
  const [tenant] = await db
    .select({ id: saasTenant.id, name: saasTenant.tenantName, status: saasTenant.status })
    .from(saasTenant)
    .where(eq(saasTenant.tenantCode, tenantCode))
    .limit(1);
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) return null;

  const settings = await getSettings(tenant.id);
  if (!settings.displayToken || !key) return null;
  const a = Buffer.from(settings.displayToken);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { tenantId: tenant.id, tenantName: tenant.name, settings };
}
