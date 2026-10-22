// Sesi berupa cookie bertanda tangan HMAC (stateless). Isi cookie hanya identitas dan masa berlaku;
// izin selalu dibaca ulang dari database di lib/auth.ts, jadi pencabutan hak akses langsung berlaku.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

export const SESSION_COOKIE = "mrb_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 jam

type Payload = { uid: number; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diatur (minimal 32 karakter).");
  return s;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSession(userId: number, now = Date.now()): string {
  const payload: Payload = { uid: userId, exp: Math.floor(now / 1000) + MAX_AGE_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): number | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!Number.isInteger(p.uid) || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p.uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number) {
  (await cookies()).set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionUserId(): Promise<number | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await connection(); // masa berlaku dibandingkan dengan jam sekarang: hanya valid saat request
  return decodeSession(token, Date.now());
}
