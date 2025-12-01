"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BudgetsPage() {
  const router = useRouter();

  // This page is deprecated; budgets are managed in Admin.
  // Redirect to /admin so users manage budgets from the CMS.
  useEffect(() => {
    router.push("/admin");
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <p className="text-sm text-[var(--color-text)]/80">Redirecting to Admin…</p>
    </div>
  );
}
