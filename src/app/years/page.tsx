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
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-[var(--color-bg)] border-b border-[var(--color-surface)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Fiscal Years</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push("/")}>Home</Button>
            <Button variant="ghost" onClick={() => router.push("/employees")}>Employees</Button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Fiscal Year</CardTitle>
            <CardDescription>Define a Sept–Aug fiscal year and its available working hours</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-1">
              <Label htmlFor="start">Start Year</Label>
              <Input id="start" type="number" value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-2 text-sm text-slate-600">
              <p>
                This will create <strong>{startYear}/{startYear + 1}</strong> with dates
                Sept 1 {startYear} to Aug 31 {startYear + 1}.
              </p>
            </div>
            <div>
              <Button onClick={createYear} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
        ) : (
          <div className="space-y-4">
            {years.map((y) => (
              <Card key={y.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{y.label}</span>
                    <span className="text-xs text-slate-500">{new Date(y.start_date).toLocaleDateString()} – {new Date(y.end_date).toLocaleDateString()}</span>
                  </CardTitle>
                  <CardDescription>Set available working hours for attendance calculations</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                    <Label htmlFor={`avail-${y.id}`}>Available hours</Label>
                    <Input id={`avail-${y.id}`} inputMode="decimal" defaultValue={y.available_hours ?? 0}
                      onBlur={(ev) => saveAvailable(y.id, Number(ev.target.value) || 0)}
                    />
                  </div>
                  <div className="text-sm text-slate-500">
                    Attendance on employee pages will be Worked / Available.
                  </div>
                  <div>
                    <Button onClick={() => saveAvailable(y.id, Number((document.getElementById(`avail-${y.id}`) as HTMLInputElement)?.value) || 0)} disabled={!!saving[y.id]}>
                      {saving[y.id] ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
