"use client";

import { useActionState, useEffect, useRef } from "react";

export type FormState = { error?: string; ok?: string };

export const fieldClass =
  "mt-1 w-full rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0d2a7a]";
export const labelClass = "block text-sm font-semibold text-slate-700";

// Pembungkus form untuk Server Action yang mengembalikan {error} / {ok}. Form dikosongkan setelah sukses.
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "space-y-3",
  resetOnSuccess = true,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {state.error && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.ok}
        </p>
      )}
      {children}
      <button
        disabled={pending}
        className="rounded-md bg-[#0d2a7a] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a2160] disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : submitLabel}
      </button>
    </form>
  );
}
