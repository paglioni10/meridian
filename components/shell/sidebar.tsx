"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { NAV, isActive } from "./nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="no-underline" aria-label="Meridian, visão geral">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="flex flex-col gap-1">
        {NAV.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="nav-item no-underline"
          >
            <span className="w-5 text-muted">{String(i + 1).padStart(2, "0")}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
        <Link
          href="/ajustes"
          aria-current={isActive(pathname, "/ajustes") ? "page" : undefined}
          className="nav-item no-underline"
        >
          Ajustes
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className="nav-item w-full cursor-pointer text-muted">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
