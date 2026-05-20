import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminExists, bootstrapAdmin } from "@/lib/bootstrap.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const checkFn = useServerFn(adminExists);
  const createFn = useServerFn(bootstrapAdmin);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["admin-exists"], queryFn: () => checkFn() });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: { email, password, fullName } });
      toast.success("Administrador creado. Ya puedes iniciar sesión.");
      navigate({ to: "/login", replace: true });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">…</div>;

  if (data?.exists) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="p-8 max-w-md text-center space-y-3">
          <ShieldCheck className="size-10 mx-auto text-primary" />
          <h1 className="text-xl font-bold">Configuración completa</h1>
          <p className="text-sm text-muted-foreground">
            Ya existe un administrador. Inicia sesión normalmente.
          </p>
          <Button onClick={() => navigate({ to: "/login" })}>Ir a login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">Configuración inicial</h1>
        <p className="text-sm text-muted-foreground mb-5">Crea la primera cuenta de administrador.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Contraseña (mín 6)</Label><Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creando…" : "Crear administrador"}</Button>
        </form>
      </Card>
    </div>
  );
}