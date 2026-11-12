import type { Metadata } from "next";
import { Suspense } from "react";
import { ContextSwitcher, ContextSwitcherFallback } from "@/components/shell/context-switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { PageHead, Section } from "@/components/ui/display";
import { getCurrentUser } from "@/lib/auth";
import { TIMEZONES, getActiveContext, getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Ajustes" />
      <div className="panels-grid">
        <Section title="Aparência">
          <p className="text-muted">Tema salvo na sua conta e aplicado em todos os aparelhos.</p>
          <ThemeToggle className="w-full sm:w-auto" />
        </Section>
        <Section title="Contexto">
          <p className="text-muted">Filtra todos os módulos por Pessoal, Trabalho ou Freelance.</p>
          <Suspense fallback={<ContextSwitcherFallback />}>
            <CurrentContext />
          </Suspense>
        </Section>
        <Section title="Preferências" wide>
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Preferences />
          </Suspense>
        </Section>
        <Section title="Conta">
          <Suspense fallback={<p className="label">Carregando</p>}>
            <Account />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

async function CurrentContext() {
  return <ContextSwitcher current={await getActiveContext()} />;
}

async function Preferences() {
  const settings = await getSettings();
  return (
    <SettingsForm
      timezones={TIMEZONES}
      defaults={{
        obsidian_vault: settings.obsidian_vault,
        safe_base_months: settings.safe_base_months,
        timezone: settings.timezone,
      }}
    />
  );
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-4">
      <div className="row">
        <span className="label">E-mail</span>
        <span>{user.email}</span>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-danger">
          Sair
        </button>
      </form>
    </div>
  );
}
