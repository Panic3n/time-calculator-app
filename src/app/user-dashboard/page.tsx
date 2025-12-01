"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UserDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const uid = sess?.session?.user?.id;
        const userEmail = sess?.session?.user?.email || "";

        if (!uid) {
          router.push("/auth");
          return;
        }

        setEmail(userEmail);

        // Check if user is admin
        const { data: prof } = await supabaseBrowser
          .from("app_profiles")
          .select("is_admin")
          .eq("user_id", uid)
          .single();

        const adminStatus = Boolean(prof?.is_admin);
        setIsAdmin(adminStatus);

        // If already admin, redirect to admin page
        if (adminStatus) {
          router.push("/admin");
          return;
        }
      } catch (e) {
        console.error("Load error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text)]/70">Setting up your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Welcome</h1>
          <p className="text-[var(--color-text)]/70 mt-2">
            You are logged in as <span className="font-semibold">{email}</span>
          </p>
        </div>

        <div className="grid gap-6">
          {/* Regular User Options */}
          <Card>
            <CardHeader>
              <CardTitle>User Access</CardTitle>
              <CardDescription>Regular user features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/team")}
              >
                View Team
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/team-goals")}
              >
                View Team Goals
              </Button>
            </CardContent>
          </Card>

          {/* Admin Login Option */}
          <Card className="border-2 border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5">
            <CardHeader>
              <CardTitle className="text-[var(--color-primary)]">Admin Access</CardTitle>
              <CardDescription>
                Have an admin password? Access the admin panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => router.push("/admin-login")}
              >
                Login as Admin
              </Button>
              <p className="text-xs text-[var(--color-text)]/60 mt-3">
                You must enter the admin password to access the admin panel. This keeps admin features separate from regular user access.
              </p>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-500/10"
            onClick={async () => {
              await supabaseBrowser.auth.signOut();
              router.push("/auth");
              router.refresh();
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
