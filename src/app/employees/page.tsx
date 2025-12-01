"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeesPage() {
  const router = useRouter();

  // This index page is deprecated; employee cards are opened directly from Admin.
  // Redirect to /admin so users manage employees from the CMS.
  useEffect(() => {
    router.push("/admin");
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <p className="text-sm text-[var(--color-text)]/80">Redirecting to Admin…</p>
    </div>
  );
}
