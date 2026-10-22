// Hash password dengan scrypt bawaan Node (tanpa dependensi). Format: scrypt$N$salt$hash (base64url).
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const KEYLEN = 32;

/** @param {string} password @param {Buffer} salt @param {number} n @returns {Promise<Buffer>} */
function derive(password, salt, n) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** @param {string} password */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

// Hash palsu untuk menyamakan waktu respons saat username tidak ditemukan.
const DUMMY = await hashPassword("tidak-dipakai");

/** @param {string} password @param {string | null | undefined} stored */
export async function verifyPassword(password, stored) {
  const parts = (stored || DUMMY).split("$");
  const valid = parts.length === 4 && parts[0] === "scrypt";
  const [, n, salt, hash] = valid ? parts : DUMMY.split("$");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n));
  const expected = Buffer.from(hash, "base64url");
  return valid && Boolean(stored) && key.length === expected.length && timingSafeEqual(key, expected);
}
