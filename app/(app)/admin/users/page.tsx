import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { listDepartments, listRoles, listUsers } from "@/lib/data";
import { parseTs, TZ } from "@/lib/booking";
import { ActionForm, fieldClass, labelClass } from "@/components/action-form";
import { changeUserRole, createUser, resetPassword, setMemberActive } from "../actions";

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Pengguna</h1>
        <p className="text-slate-600">Kelola akun, peran, dan akses anggota tenant.</p>
      </header>
      <Suspense fallback={<p className="text-slate-500">Memuat pengguna…</p>}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const user = await requirePermission("user.manage");
  const params = await searchParams;
  const err = Array.isArray(params.err) ? params.err[0] : params.err;
  const [users, roles, departments] = await Promise.all([
    listUsers(user.tenantId),
    listRoles(user.tenantId),
    listDepartments(user.tenantId),
  ]);

  return (
    <>
      {err && (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {err}
        </p>
      )}

      <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Departemen</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const self = u.memberId === user.memberId;
              const active = u.memberStatus === "ACTIVE";
              return (
                <tr key={u.memberId} className={`align-top ${active ? "" : "bg-slate-50 text-slate-500"}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {u.fullName}
                      {self && <span className="ml-2 rounded bg-yellow-200 px-1.5 text-[0.65rem] font-bold text-slate-900">ANDA</span>}
                    </p>
                    <p className="font-mono text-xs text-slate-500">{u.username}</p>
                    {u.lastLoginAt && (
                      <p className="text-xs text-slate-400">
                        Login terakhir{" "}
                        {parseTs(u.lastLoginAt).toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </p>
                    )}
                    {!u.hasPassword && <p className="text-xs font-semibold text-amber-700">Belum punya password</p>}
                  </td>
                  <td className="px-4 py-3">
                    {u.department ?? "-"}
                    <p className="text-xs text-slate-500">{u.jobTitle ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <form action={changeUserRole} className="flex gap-1.5">
                      <input type="hidden" name="memberId" value={u.memberId} />
                      <select
                        name="roleId"
                        defaultValue={u.roles[0]?.roleId}
                        disabled={self}
                        className="rounded-md bg-white px-2 py-1.5 text-xs ring-1 ring-slate-300 disabled:opacity-50"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {!self && (
                        <button className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold ring-1 ring-slate-300 hover:bg-slate-100">
                          Ubah
                        </button>
                      )}
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                    >
                      {active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="space-y-2 px-4 py-3">
                    {!self && (
                      <form action={setMemberActive}>
                        <input type="hidden" name="memberId" value={u.memberId} />
                        <input type="hidden" name="active" value={active ? "false" : "true"} />
                        <button className="text-xs font-semibold text-[#0d2a7a] hover:underline">
                          {active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                    )}
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600">Reset password</summary>
                      <ActionForm action={resetPassword} submitLabel="Ganti" className="mt-2 flex flex-wrap items-start gap-2">
                        <input type="hidden" name="memberId" value={u.memberId} />
                        <input
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Password baru"
                          required
                          className="rounded-md bg-white px-2 py-1.5 text-xs ring-1 ring-slate-300"
                        />
                      </ActionForm>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="max-w-2xl rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-3 text-lg font-black">Tambah Pengguna</h2>
        <ActionForm action={createUser} submitLabel="Buat pengguna">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Nama lengkap
              <input name="fullName" required maxLength={150} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Username
              <input name="username" required maxLength={50} autoComplete="off" className={fieldClass} />
            </label>
            <label className={labelClass}>
              Email
              <input name="email" type="email" maxLength={150} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Password awal
              <input name="password" type="password" required autoComplete="new-password" className={fieldClass} />
            </label>
            <label className={labelClass}>
              Departemen
              <select name="departmentId" defaultValue="" className={fieldClass}>
                <option value="">—</option>
                {departments
                  .filter((d) => d.isActive)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Jabatan
              <input name="jobTitle" maxLength={100} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Kode karyawan
              <input name="employeeCode" maxLength={50} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Peran
              <select name="roleId" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Pilih peran
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-slate-500">Password minimal 8 karakter dan mengandung huruf serta angka.</p>
        </ActionForm>
      </section>
    </>
  );
}
