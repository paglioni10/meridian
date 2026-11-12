"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV, MORE_HREFS, isActive } from "./nav";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="tabbar">
      {BOTTOM_NAV.map((item) => {
        const active =
          item.href === "/mais"
            ? MORE_HREFS.some((href) => isActive(pathname, href))
            : isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="group tabbar-item no-underline"
          >
            <span
              aria-hidden
              className="h-0.5 w-6 bg-current opacity-0 group-aria-[current=page]:opacity-100"
            />
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
