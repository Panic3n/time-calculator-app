"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { supabaseBrowser } from "@/lib/supabaseClient";

const baseLinks = [
  { href: "/", label: "Home" },
  { href: "/employees", label: "Employees" },
  { href: "/team", label: "Team" },
  { href: "/years", label: "Years" },
  { href: "/budgets", label: "Budgets" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [badge, setBadge] = useState<{ label: string; value: string } | null>(null);
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

        // Latest fiscal year
        const { data: fys } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label")
          .order("start_date", { ascending: false })
          .limit(1);
        const fy = (fys as any[])?.[0];
        if (!fy?.id) { setBadge(null); return; }
        const fyId = fy.id as string;
        // Included employees
        const resp = await fetch(`/api/admin/team-included?fiscal_year_id=${fyId}`, { cache: "no-store" });
        const json = await resp.json();
        const includedIds: string[] = (json?.rows || []).map((r: any) => String(r.employee_id));
        if (!includedIds.length) { setBadge({ label: fy.label, value: "--%" }); return; }
        // Sum month_entries
        const { data: rows } = await supabaseBrowser
          .from("month_entries")
          .select("employee_id, worked, billed")
          .eq("fiscal_year_id", fyId)
          .in("employee_id", includedIds);
        const sum = (rows as any[] || []).reduce((acc, r) => {
          acc.worked += Number(r.worked || 0);
          acc.billed += Number(r.billed || 0);
          return acc;
        }, { worked: 0, billed: 0 });
        const pct = sum.worked ? Math.round(((sum.billed / sum.worked) * 100) * 10) / 10 : 0;
        setBadge({ label: fy.label as string, value: `${pct}%` });
      } catch {
        setBadge(null);
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
          {[...baseLinks, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((l) => (
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
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-xs px-2 py-1 rounded-full border border-[var(--color-surface)] text-[var(--color-text)]/90">
              Team billed % {badge.value} <span className="opacity-60">({badge.label})</span>
            </span>
          )}
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
