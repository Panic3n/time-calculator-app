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

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-xl font-semibold mb-2">Employees</h1>
        <Card>
          <CardHeader>
            <CardTitle>Add Employee</CardTitle>
            <CardDescription>Add a new employee (name and optional role)</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onAdd)} noValidate>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Jane Doe" {...register("name")} />
                {errors.name && (
                  <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" placeholder="Consultant" {...register("role")} />
              </div>
              <div>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding..." : "Add"}</Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <Separator />

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employees.map((e) => (
              <Card key={e.id} className="hover:shadow transition">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {editing[e.id] ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                        <div>
                          <Label>Name</Label>
                          <Input
                            value={editValues[e.id]?.name ?? e.name}
                            onChange={(ev) => setEditValues((s) => ({ ...s, [e.id]: { ...(s[e.id] || { role: e.role ?? "" }), name: ev.target.value } }))}
                          />
                        </div>
                        <div>
                          <Label>Role</Label>
                          <Input
                            value={editValues[e.id]?.role ?? e.role ?? ""}
                            onChange={(ev) => setEditValues((s) => ({ ...s, [e.id]: { ...(s[e.id] || { name: e.name }), role: ev.target.value } }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <span>{e.name}</span>
                        <span className="text-xs text-slate-500">{e.role ?? "—"}</span>
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>Created {new Date(e.created_at).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {editing[e.id] ? (
                    <>
                      <Button onClick={() => saveEdit(e.id)}>Save</Button>
                      <Button variant="outline" onClick={() => cancelEdit(e.id)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => router.push(`/employees/${e.id}`)}>Open</Button>
                      <Button variant="secondary" onClick={() => startEdit(e)}>Edit</Button>
                      <Button variant="destructive" onClick={() => onDelete(e.id)} disabled={!!deleting[e.id]}>
                        {deleting[e.id] ? "Deleting..." : "Delete"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
