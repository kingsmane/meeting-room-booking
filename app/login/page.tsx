import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1931] p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-7 shadow-xl">
        <p className="text-xs font-bold tracking-widest text-[#0d2a7a]">MEETING ROOM BOOKING</p>
        <h1 className="mb-5 text-2xl font-black text-slate-900">Masuk</h1>
        <Suspense fallback={<p className="text-sm text-slate-500">Memuat…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  // Sudah login: langsung ke beranda.
  if (await getCurrentUser()) redirect("/");
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <LoginForm next={next} />;
}
