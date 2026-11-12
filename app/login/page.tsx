import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4">
      <header className="flex flex-col gap-3 border-b-3 border-border pb-3">
        <Logo size="lg" />
        <p className="font-mono text-label text-muted uppercase">Acesso restrito</p>
      </header>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
