import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-7 md:px-10">
      <header className="flex items-end justify-between gap-4 border-b-3 border-border pb-3">
        <h1 className="font-display text-h1 font-extrabold">Meridian</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="inline-flex min-h-tap items-center border border-border px-4 font-mono text-[12px] font-medium uppercase hover:bg-foreground hover:text-background"
          >
            Sair
          </button>
        </form>
      </header>
      <Suspense fallback={<p className="font-mono text-label text-muted uppercase">Carregando sessão</p>}>
        <SessionInfo />
      </Suspense>
    </main>
  );
}

async function SessionInfo() {
  const user = await getCurrentUser();
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <span className="font-mono text-label text-muted uppercase">Sessão ativa</span>
      <span className="font-mono text-data">{user.email}</span>
      <span className="font-mono text-label text-muted uppercase">F0 · Fundação</span>
    </section>
  );
}
