// Helper tes end-to-end: klien yang meniru browser (cookie + submit form Server Action) dan akses DB langsung
// untuk memverifikasi hasilnya. Tidak ada dependensi tambahan.
import { neon } from "@neondatabase/serverless";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
export const sql = neon(process.env.DATABASE_URL);

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export class Browser {
  jar = new Map();

  async req(path, init = {}) {
    const headers = { ...(init.headers || {}) };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || value === "") this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return res;
  }

  async get(path) {
    const res = await this.req(path);
    return {
      status: res.status,
      location: res.headers.get("location"),
      html: res.status < 300 || res.status >= 400 ? await res.text() : "",
    };
  }

  // Cari <form> yang memuat semua potongan `needs`, isi field, lalu kirim seperti browser.
  // `as` = [name, value] untuk tombol submit bernama. Nilai bertipe array dikirim berulang (mis. checkbox).
  async submit(path, needs, fields = {}, { as } = {}) {
    const page = await this.get(path);
    if (page.status !== 200) return { stage: "get", ...page };
    const forms = [...page.html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]);
    const form = forms.find((f) => needs.every((n) => f.includes(n)));
    if (!form) return { stage: "noform", status: 0, html: page.html };
    return this.post(path, form, fields, as);
  }

  async post(path, formHtml, fields = {}, as) {
    const fd = new FormData();
    for (const m of formHtml.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = m[0].match(/name="([^"]*)"/)?.[1];
      const value = decode(m[0].match(/value="([^"]*)"/)?.[1] ?? "");
      if (name && !(name in fields)) fd.append(name, value);
    }
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
      else fd.append(k, String(v));
    }
    if (as) fd.append(as[0], as[1]);
    const res = await this.req(path, { method: "POST", body: fd, headers: { origin: BASE } });
    const html = res.status === 200 ? await res.text() : "";
    return {
      stage: "post",
      status: res.status,
      location: res.headers.get("location"),
      html,
      // Pesan error muncul di HTML atau (lewat useActionState) di payload RSC.
      alert:
        html.match(/role="alert"[^>]*>([^<]*)</)?.[1] ??
        html.match(/\[\{"error":"((?:[^"\\]|\\.)*)"\}/)?.[1],
    };
  }

  async login(username, password = "Demo@2026") {
    return this.submit("/login", ['name="username"'], { username, password, next: "/" });
  }
}

// ---- helper umum ----
export const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "") // React menyisipkan komentar di antara teks dan ekspresi; jangan jadikan spasi
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

export const day = (n) =>
  new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export const hm = (offsetMinutes) =>
  new Date(Date.now() + offsetMinutes * 60000).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });

export const minutesOfDayWib = () => {
  const [h, m] = hm(0).split(":").map(Number);
  return h * 60 + m;
};

export const one = async (q, ...params) => (await sql.query(q, params))[0];
export const rows = async (q, ...params) => sql.query(q, params);
export const idMap = async (q) => Object.fromEntries((await sql.query(q)).map((r) => [r.k, r.id]));

// Redirect dari Server Action membawa pesan di query string (spasi sebagai "+").
export const loc = (r) => (r.location ? decodeURIComponent(r.location.replace(/\+/g, " ")) : "");
// Status HTTP selalu 200 untuk halaman yang di-stream; penandanya ada di isi respons.
export const is404 = (r) => r.html.includes("NEXT_HTTP_ERROR_FALLBACK;404");
export const denied = (r) => r.html.includes("NEXT_REDIRECT;replace;/forbidden") || r.location === "/forbidden";

let pass = 0;
let fail = 0;
export function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log("  PASS", name);
  } else {
    fail++;
    console.log("  FAIL", name, extra ? `\n       ${String(extra).slice(0, 300)}` : "");
  }
}
export const skip = (name, why) => console.log("  SKIP", name, `(${why})`);
export const section = (title) => console.log(`== ${title}`);
export const summary = () => {
  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
};
