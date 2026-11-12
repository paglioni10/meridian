export type NavItem = { href: string; label: string; short: string; phase?: string };

export const NAV: NavItem[] = [
  { href: "/", label: "Visão geral", short: "Início" },
  { href: "/financas", label: "Finanças", short: "Finanças", phase: "F3" },
  { href: "/objetivos", label: "Objetivos", short: "Objetivos", phase: "F5" },
  { href: "/projetos", label: "Projetos", short: "Projetos", phase: "F6" },
  { href: "/freelance", label: "Freelance", short: "Freelance", phase: "F6" },
  { href: "/infra", label: "Servidores", short: "Servidores", phase: "F7" },
  { href: "/cursos", label: "Estudos", short: "Estudos", phase: "F2" },
];

export const BOTTOM_NAV: NavItem[] = [
  NAV[0],
  NAV[1],
  NAV[2],
  NAV[4],
  { href: "/mais", label: "Mais", short: "Mais" },
];

export const MORE_HREFS = ["/mais", "/projetos", "/infra", "/cursos", "/ajustes", "/dev"];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
