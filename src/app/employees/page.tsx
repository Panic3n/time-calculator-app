"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type Employee = { id: string; name: string; role: string | null; created_at: string };

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, { name: string; role: string }>>({});

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("employees")
          .select("id, name, role, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setEmployees(data as Employee[]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load employees");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onAdd = async (values: FormValues) => {
    try {
      const { data, error } = await supabaseBrowser
        .from("employees")
        .insert({ name: values.name, role: values.role ?? null })
        .select("id, name, role, created_at")
        .single();
      if (error) throw error;
      setEmployees((list) => [data as Employee, ...list]);
      reset({ name: "", role: "" });
    } catch (e: any) {
      alert(e?.message ?? "Failed to add employee");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this employee? This will remove their time entries.")) return;
    setDeleting((s) => ({ ...s, [id]: true }));
    try {
      const { error } = await supabaseBrowser.from("employees").delete().eq("id", id);
      if (error) throw error;
      setEmployees((list) => list.filter((e) => e.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    } finally {
      setDeleting((s) => ({ ...s, [id]: false }));
    }
  };

  const startEdit = (e: Employee) => {
    setEditing((s) => ({ ...s, [e.id]: true }));
    setEditValues((s) => ({ ...s, [e.id]: { name: e.name, role: e.role ?? "" } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((s) => ({ ...s, [id]: false }));
    setEditValues((s) => {
      const { [id]: _, ...rest } = s;
      return rest;
    });
  };

  const saveEdit = async (id: string) => {
    const vals = editValues[id];
    if (!vals) return;
    try {
      const { data, error } = await supabaseBrowser
        .from("employees")
        .update({ name: vals.name, role: vals.role || null })
        .eq("id", id)
        .select("id, name, role, created_at")
        .single();
      if (error) throw error;
      setEmployees((list) => list.map((e) => (e.id === id ? (data as Employee) : e)));
      setEditing((s) => ({ ...s, [id]: false }));
    } catch (e: any) {
      alert(e?.message ?? "Failed to save changes");
    }
  };

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
