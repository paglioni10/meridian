"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle", message: "" };

const URL_ERRORS: Record<string, string> = {
  denied: "Este e-mail não tem acesso ao Meridian.",
  link: "Link inválido ou expirado. Peça um novo.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(requestMagicLink, initial);
  const urlError = state.status === "idle" ? URL_ERRORS[params.get("error") ?? ""] : undefined;
  const message = state.message || urlError || "";
  const isError = state.status === "error" || Boolean(urlError);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <label className="flex flex-col gap-1">
        <span className="font-mono text-label text-muted uppercase">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="voce@exemplo.com"
          className="min-h-tap w-full border-0 border-b border-border bg-transparent px-3 font-mono text-[16px] text-foreground placeholder:text-muted focus:border-b-3 focus:border-secondary focus:outline-none md:text-data"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-tap items-center justify-center border border-border bg-primary px-4 font-mono text-[12px] font-medium text-primary-foreground uppercase transition-colors hover:border-danger hover:bg-danger hover:text-accent disabled:pointer-events-none disabled:opacity-40"
      >
        {pending ? "Enviando" : "Enviar link de acesso"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 font-mono text-label uppercase ${isError ? "text-danger" : "text-muted"}`}
      >
        {message}
      </p>
    </form>
  );
}
