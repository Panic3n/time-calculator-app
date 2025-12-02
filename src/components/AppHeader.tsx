"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { supabaseBrowser } from "@/lib/supabaseClient";

const baseLinks: { href: string; label: string }[] = [];

const adminLinks = [
  { href: "/", label: "News hub" },
  { href: "/dashboard", label: "Agent profile" },
  { href: "/quests", label: "Quests" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/team-goals", label: "Team goals" },
  { href: "/team", label: "Team" },
  { href: "/admin", label: "Admin" },
];

const employeeLinks = [
  { href: "/", label: "News hub" },
  { href: "/dashboard", label: "Agent profile" },
  { href: "/quests", label: "Quests" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/team-goals", label: "Team goals" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange(() => {
      load();
      router.refresh();
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleNav = (href: string) => {
    router.push(href);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-surface)] bg-[var(--color-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="QuestIT Logo" width={32} height={32} className="rounded-lg" />
          <span className="font-semibold">QuestIT</span>
        </div>
        <nav className="flex items-center gap-1">
          {!loading && (email ? (
            isAdmin ? (
              adminLinks.map((l) => (
                <Button
                  key={l.href}
                  variant={pathname === l.href ? "default" : "ghost"}
                  className={clsx("h-8 px-3", pathname === l.href ? "" : "text-[var(--color-text)]/80")}
                  onClick={() => handleNav(l.href)}
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
                  onClick={() => handleNav(l.href)}
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
                onClick={() => handleNav(l.href)}
              >
                {l.label}
              </Button>
            ))
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {!loading && (email ? (
              <>
                <span className="text-xs text-[var(--color-text)]/70">{email}</span>
                {!isAdmin && (
                  <Button 
                    variant="outline" 
                    className="h-8 px-2 text-xs" 
                    onClick={()=> handleNav("/admin-login")}
                  >
                    Admin
                  </Button>
                )}
                <Button variant="ghost" className="h-8 px-2" onClick={async ()=>{ 
                  setLoading(true);
                  await supabaseBrowser.auth.signOut(); 
                  setEmail("");
                  setIsAdmin(false);
                  router.push("/auth");
                  router.refresh();
                  setLoading(false);
                }}>Sign out</Button>
              </>
            ) : (
              <Button className="h-8 px-2" onClick={()=> handleNav("/auth")}>Sign in</Button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
