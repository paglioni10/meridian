import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/ui/display";

export const metadata: Metadata = { title: "Mais" };

const LINKS = [
  { href: "/projetos", label: "Projetos" },
  { href: "/infra", label: "Servidores" },
  { href: "/cursos", label: "Estudos" },
  { href: "/ajustes", label: "Ajustes" },
];

export default function MorePage() {
  return (
    <>
      <PageHead title="Mais" />
      <nav aria-label="Outras seções" className="flex flex-col">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-tap items-center justify-between border-b border-border-soft font-mono text-data text-foreground no-underline hover:text-danger"
          >
            {link.label}
            <span aria-hidden>→</span>
          </Link>
        ))}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex min-h-tap w-full cursor-pointer items-center justify-between border-b border-border-soft font-mono text-data text-danger"
          >
            Sair
          </button>
        </form>
      </nav>
    </>
  );
}
