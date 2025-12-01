"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const uid = sess?.session?.user?.id;
        const userEmail = sess?.session?.user?.email || "";
        
        if (!uid) {
          // Not logged in, redirect to auth
          router.push("/auth");
          return;
        }

        setEmail(userEmail);
        setIsLoggedIn(true);

        // Check if already admin
        const { data: prof } = await supabaseBrowser
          .from("app_profiles")
          .select("is_admin")
          .eq("user_id", uid)
          .single();

        if (prof?.is_admin) {
          // Already admin, redirect to admin page
          router.push("/admin");
        }
      } catch (e) {
        console.error("Session check error:", e);
        router.push("/auth");
      }
    };

    checkSession();
  }, [router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: sess } = await supabaseBrowser.auth.getSession();
      const uid = sess?.session?.user?.id;

      if (!uid) {
        throw new Error("Not logged in");
      }

      // Verify admin password (hardcoded for now, can be made configurable)
      const adminSecret = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
      
      if (adminPassword !== adminSecret) {
        throw new Error("Invalid admin password");
      }

      // Set user as admin in database
      const { error: updateErr } = await supabaseBrowser
        .from("app_profiles")
        .update({ is_admin: true })
        .eq("user_id", uid);

      if (updateErr) throw updateErr;

      // Redirect to admin page
      router.push("/admin");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text)]/70">Checking your session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>
            You are logged in as <span className="font-semibold text-[var(--color-text)]">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-password">Admin Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !adminPassword}
            >
              {loading ? "Verifying..." : "Access Admin Panel"}
            </Button>

            <div className="pt-4 border-t border-[var(--color-text)]/10">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={async () => {
                  await supabaseBrowser.auth.signOut();
                  router.push("/auth");
                  router.refresh();
                }}
              >
                Sign out and return to login
              </Button>
            </div>
          </form>

          <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-xs text-blue-600">
              <strong>Note:</strong> You must be logged in as a regular user first. Enter the admin password to access the admin panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
