"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type FiscalYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  available_hours: number | null;
};

function makeDates(startYear: number) {
  const start_date = new Date(Date.UTC(startYear, 8, 1)); // Sept 1
  const end_date = new Date(Date.UTC(startYear + 1, 7, 31)); // Aug 31
  const label = `${startYear}/${startYear + 1}`;
  return { label, start_date: start_date.toISOString().slice(0, 10), end_date: end_date.toISOString().slice(0, 10) };
}

export default function YearsPage() {
  const router = useRouter();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [startYear, setStartYear] = useState<number>(new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label, start_date, end_date, available_hours")
          .order("start_date", { ascending: false });
        if (error) throw error;
        setYears(data as any);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load fiscal years");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const createYear = async () => {
    setCreating(true);
    try {
      const { label, start_date, end_date } = makeDates(startYear);
      const { data, error } = await supabaseBrowser
        .from("fiscal_years")
        .insert({ label, start_date, end_date, available_hours: 0 })
        .select("id, label, start_date, end_date, available_hours")
        .single();
      if (error) throw error;
      setYears((list) => [data as any, ...list]);
    } catch (e: any) {
      alert(e?.message ?? "Failed to create fiscal year");
    } finally {
      setCreating(false);
    }
  };

  const saveAvailable = async (id: string, hours: number) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const { error } = await supabaseBrowser
        .from("fiscal_years")
        .update({ available_hours: hours })
        .eq("id", id);
      if (error) throw error;
      setYears((list) => list.map((y) => (y.id === id ? { ...y, available_hours: hours } : y)));
    } catch (e: any) {
      alert(e?.message ?? "Failed to save available hours");
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Fiscal years moved</CardTitle>
          <CardDescription>
            Management of fiscal years now lives in the Admin area.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-text)]/80">
            Go to <strong>Admin 2 Fiscal years</strong> to create, edit and set available hours
            for each fiscal year.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => router.push("/admin")}>Go to Admin</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
