import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { changeOwnPassword } from "../admin/actions";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <Suspense fallback={<p className="text-slate-500">Memuat…</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <>
      <header>
        <h1 className="text-2xl font-black">Akun Saya</h1>
        <p className="text-slate-600">
          {user.fullName} · <span className="font-mono text-sm">{user.username}</span>
          {user.departmentName ? ` · ${user.departmentName}` : ""}
        </p>
      </header>
      <section className="rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Ganti password</h2>
        <ActionForm action={changeOwnPassword} submitLabel="Ganti password">
          <label className={labelClass}>
            Password saat ini
            <input name="current" type="password" required autoComplete="current-password" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Password baru
            <input name="next" type="password" required autoComplete="new-password" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Ulangi password baru
            <input name="confirm" type="password" required autoComplete="new-password" className={fieldClass} />
          </label>
          <p className="text-xs text-slate-500">Minimal 8 karakter, mengandung huruf dan angka.</p>
        </ActionForm>
      </section>
    </>
  );
}
