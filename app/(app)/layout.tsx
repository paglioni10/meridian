import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/shell/bottom-nav";
import { ContextSwitcher, ContextSwitcherFallback } from "@/components/shell/context-switcher";
import { Logo } from "@/components/shell/logo";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeSync } from "@/components/shell/theme-sync";
import { ToastProvider } from "@/components/ui/toast";
import { getActiveContext, getSettings } from "@/lib/settings";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <Link href="/" className="no-underline lg:hidden" aria-label="Meridian, visão geral">
              <Logo />
            </Link>
            <Suspense fallback={<ContextSwitcherFallback />}>
              <ActiveContext />
            </Suspense>
          </div>
          {children}
        </main>
        <BottomNav />
      </div>
      <Suspense fallback={null}>
        <SavedTheme />
      </Suspense>
    </ToastProvider>
  );
}

async function ActiveContext() {
  return <ContextSwitcher current={await getActiveContext()} />;
}

async function SavedTheme() {
  return <ThemeSync saved={(await getSettings()).theme} />;
}
