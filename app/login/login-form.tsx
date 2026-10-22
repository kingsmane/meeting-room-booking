"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const field =
  "mt-1 w-full rounded-md bg-white px-3 py-2.5 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      )}
      <label className="block text-sm font-semibold text-slate-700">
        Username
        <input name="username" autoComplete="username" autoFocus required className={field} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      <button
        disabled={pending}
        className="w-full rounded-md bg-[#0d2a7a] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0a2160] disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
