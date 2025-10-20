"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/employees", label: "Employees" },
  { href: "/team", label: "Team" },
  { href: "/years", label: "Years" },
  { href: "/budgets", label: "Budgets" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-surface)] bg-[var(--color-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[var(--color-primary)]" />
          <span className="font-semibold">Time Calculator</span>
        </div>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Button
              key={l.href}
              variant={pathname === l.href ? "default" : "ghost"}
              className={clsx("h-8 px-3", pathname === l.href ? "" : "text-[var(--color-text)]/80")}
              onClick={() => router.push(l.href)}
            >
              {l.label}
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
