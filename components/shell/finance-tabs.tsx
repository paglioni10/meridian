"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/financas/ganhos", label: "Ganhos" },
  { href: "/financas/despesas", label: "Despesas" },
  { href: "/financas/importar", label: "Importar" },
  { href: "/financas/categorias", label: "Categorias" },
];

export function FinanceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de finanças" className="flex flex-wrap gap-x-4 gap-y-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname.startsWith(tab.href) ? "page" : undefined}
          className="font-mono text-label text-muted uppercase no-underline hover:text-danger aria-[current=page]:text-danger"
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
