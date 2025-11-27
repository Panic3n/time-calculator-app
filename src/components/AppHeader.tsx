"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { supabaseBrowser } from "@/lib/supabaseClient";

const baseLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/team", label: "Team" },
  { href: "/team-goals", label: "Team goals" },
];

const employeeLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/team-goals", label: "Team goals" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        // Session and admin
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const uid = sess?.session?.user?.id;
        setEmail(sess?.session?.user?.email || "");
        if (uid) {
          const { data: prof } = await supabaseBrowser
            .from("app_profiles")
            .select("is_admin")
            .eq("user_id", uid)
            .single();
          setIsAdmin(Boolean(prof?.is_admin));
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    };
    load();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-surface)] bg-[var(--color-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[var(--color-primary)]" />
          <span className="font-semibold">Time Calculator</span>
        </div>
        <nav className="flex items-center gap-1">
          {email ? (
            isAdmin ? (
              [...baseLinks, { href: "/admin", label: "Admin" }].map((l) => (
                <Button
                  key={l.href}
                  variant={pathname === l.href ? "default" : "ghost"}
                  className={clsx("h-8 px-3", pathname === l.href ? "" : "text-[var(--color-text)]/80")}
                  onClick={() => router.push(l.href)}
                >
                  {l.label}
                </Button>
              ))
            ) : (
              employeeLinks.map((l) => (
                <Button
                  key={l.href}
                  variant={pathname === l.href ? "default" : "ghost"}
                  className={clsx("h-8 px-3", pathname === l.href ? "" : "text-[var(--color-text)]/80")}
                  onClick={() => router.push(l.href)}
                >
                  {l.label}
                </Button>
              ))
            )
          ) : (
            baseLinks.map((l) => (
              <Button
                key={l.href}
                variant={pathname === l.href ? "default" : "ghost"}
                className={clsx("h-8 px-3", pathname === l.href ? "" : "text-[var(--color-text)]/80")}
                onClick={() => router.push(l.href)}
              >
                {l.label}
              </Button>
            ))
          )}
        </nav>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {email ? (
              <>
                <span className="text-xs text-[var(--color-text)]/70">{email}</span>
                <Button variant="ghost" className="h-8 px-2" onClick={async ()=>{ await supabaseBrowser.auth.signOut(); router.refresh(); }}>Sign out</Button>
              </>
            ) : (
              <Button className="h-8 px-2" onClick={()=> router.push("/auth")}>Sign in</Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
