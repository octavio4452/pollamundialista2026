import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createUser, deleteUser, toggleAdmin } from "@/lib/admin.functions";
import { importWorldCupFixture, syncWorldCupResults } from "@/lib/sportsdb.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ShieldCheck, ShieldOff, RefreshCw, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

function Admin() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel de administrador</h1>
        <p className="text-muted-foreground mt-1">Gestiona usuarios, equipos, partidos y resultados.</p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="teams">Equipos</TabsTrigger>
          <TabsTrigger value="matches">Partidos</TabsTrigger>
          <TabsTrigger value="bracket">Bracket oficial</TabsTrigger>
          <TabsTrigger value="scorer">Goleador oficial</TabsTrigger>
          <TabsTrigger value="sync">Sincronizar Mundial</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
        <TabsContent value="teams" className="mt-4"><TeamsPanel /></TabsContent>
        <TabsContent value="matches" className="mt-4"><MatchesPanel /></TabsContent>
        <TabsContent value="bracket" className="mt-4"><BracketPanel /></TabsContent>
        <TabsContent value="scorer" className="mt-4"><ScorerPanel /></TabsContent>
        <TabsContent value="sync" className="mt-4"><SyncPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const createFn = useServerFn(createUser);
  const deleteFn = useServerFn(deleteUser);
  const toggleFn = useServerFn(toggleAdmin);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      const roleSet = new Set((roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles.data ?? []).map((p) => ({ ...p, isAdmin: roleSet.has(p.id) }));
    },
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createFn({ data: { email, password, fullName, makeAdmin } });
      toast.success("Usuario creado");
      setEmail(""); setPassword(""); setFullName(""); setMakeAdmin(false);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Crear usuario</h3>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Contraseña</Label><Input required type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={makeAdmin} onCheckedChange={(v) => setMakeAdmin(!!v)} /> Hacer administrador
          </label>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Creando…" : "Crear usuario"}</Button>
        </form>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left p-3">Nombre</th><th className="text-left p-3">Rol</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3">{u.isAdmin ? <span className="text-primary">Admin</span> : "Usuario"}</td>
                <td className="p-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { await toggleFn({ data: { userId: u.id, makeAdmin: !u.isAdmin } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
                    catch (e: any) { toast.error(e.message); }
                  }}>
                    {u.isAdmin ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (!confirm("¿Eliminar este usuario?")) return;
                    try { await deleteFn({ data: { userId: u.id } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
                    catch (e: any) { toast.error(e.message); }
                  }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TeamsPanel() {
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("group_name").order("name")).data ?? [],
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [group, setGroup] = useState("A");
  const [flag, setFlag] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("teams").insert({ name, code: code.toUpperCase(), group_name: group, flag_emoji: flag || null });
    if (error) toast.error(error.message);
    else { toast.success("Equipo agregado"); setName(""); setCode(""); setFlag(""); qc.invalidateQueries({ queryKey: ["teams"] }); }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar equipo?")) return;
    await supabase.from("teams").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["teams"] });
  };

  const groups = "ABCDEFGHIJKL".split("");
  const grouped = teams.reduce((acc: Record<string, any[]>, t: any) => {
    (acc[t.group_name] ||= []).push(t); return acc;
  }, {});

  return (
    <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Agregar equipo</h3>
        <form onSubmit={add} className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Código (3 letras)</Label><Input required maxLength={3} value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Bandera (emoji opcional)</Label><Input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇦🇷" /></div>
          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{groups.map((g) => <SelectItem key={g} value={g}>Grupo {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">Agregar</Button>
        </form>
      </Card>
      <div className="space-y-3">
        {Object.keys(grouped).sort().map((g) => (
          <Card key={g} className="p-4">
            <h4 className="font-semibold mb-2">Grupo {g}</h4>
            <div className="flex flex-wrap gap-2">
              {grouped[g].map((t: any) => (
                <span key={t.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm">
                  {t.flag_emoji} {t.name} <span className="text-xs text-muted-foreground">({t.code})</span>
                  <button onClick={() => del(t.id)} className="text-destructive hover:opacity-70"><Trash2 className="size-3.5" /></button>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const STAGES = [
  { v: "group", l: "Grupos" },
  { v: "round_of_32", l: "Dieciseisavos" },
  { v: "round_of_16", l: "Octavos" },
  { v: "quarter_final", l: "Cuartos" },
  { v: "semi_final", l: "Semifinal" },
  { v: "final", l: "Final" },
  { v: "third_place", l: "3er lugar" },
];

function MatchesPanel() {
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("name")).data ?? [],
  });
  const { data: matches = [] } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => (await supabase.from("matches").select("*, home:home_team_id(name, code), away:away_team_id(name, code)").order("kickoff")).data ?? [],
  });

  const [stage, setStage] = useState("group");
  const [groupName, setGroupName] = useState("A");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!home || !away || home === away) return toast.error("Selecciona dos equipos distintos");
    const { error } = await supabase.from("matches").insert({
      stage: stage as any, group_name: stage === "group" ? groupName : null,
      home_team_id: home, away_team_id: away, kickoff: new Date(kickoff).toISOString(),
    });
    if (error) toast.error(error.message);
    else { toast.success("Partido creado"); qc.invalidateQueries({ queryKey: ["admin-matches"] }); }
  };

  const saveResult = async (id: string, h: number, a: number) => {
    const { error } = await supabase.from("matches").update({ home_score: h, away_score: a, finished: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Resultado guardado, puntos recalculados"); qc.invalidateQueries({ queryKey: ["admin-matches"] }); }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar partido?")) return;
    await supabase.from("matches").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Crear partido</h3>
        <form onSubmit={create} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label>Fase</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {stage === "group" && (
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value.toUpperCase())} maxLength={2} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Select value={home} onValueChange={setHome}>
              <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.flag_emoji} {t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Visitante</Label>
            <Select value={away} onValueChange={setAway}>
              <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
              <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.flag_emoji} {t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha y hora</Label>
            <Input type="datetime-local" required value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
          </div>
          <div className="lg:col-span-5"><Button type="submit">Crear partido</Button></div>
        </form>
      </Card>

      <div className="space-y-2">
        {matches.map((m: any) => <MatchRow key={m.id} match={m} onSave={saveResult} onDelete={del} />)}
        {matches.length === 0 && <Card className="p-8 text-center text-muted-foreground">No hay partidos.</Card>}
      </div>
    </div>
  );
}

function MatchRow({ match, onSave, onDelete }: { match: any; onSave: (id: string, h: number, a: number) => void; onDelete: (id: string) => void }) {
  const [h, setH] = useState<string>(match.home_score?.toString() ?? "");
  const [a, setA] = useState<string>(match.away_score?.toString() ?? "");
  return (
    <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground uppercase">
          {match.stage === "group" ? `Grupo ${match.group_name}` : match.stage} ·{" "}
          {new Date(match.kickoff).toLocaleString("es")}
        </div>
        <div className="font-medium mt-0.5">{match.home?.name} vs {match.away?.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} className="w-16" value={h} onChange={(e) => setH(e.target.value)} />
        <span>-</span>
        <Input type="number" min={0} className="w-16" value={a} onChange={(e) => setA(e.target.value)} />
        <Button size="sm" onClick={() => onSave(match.id, parseInt(h), parseInt(a))} disabled={h === "" || a === ""}>
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(match.id)}><Trash2 className="size-4 text-destructive" /></Button>
      </div>
    </Card>
  );
}

const BR_CATS = [
  { k: "group_advance", l: "Avanzan de grupos", n: 24 },
  { k: "round_of_16", l: "Octavos", n: 16 },
  { k: "quarter_final", l: "Cuartos", n: 8 },
  { k: "semi_final", l: "Semifinal", n: 4 },
  { k: "final", l: "Finalistas", n: 2 },
  { k: "champion", l: "Campeón", n: 1 },
];

function BracketPanel() {
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("name")).data ?? [],
  });
  const { data: results = [] } = useQuery({
    queryKey: ["bracket-results"],
    queryFn: async () => (await supabase.from("bracket_results").select("*")).data ?? [],
  });

  const toggle = async (cat: string, teamId: string, max: number) => {
    const existing = results.find((r: any) => r.category === cat && r.team_id === teamId);
    if (existing) {
      await supabase.from("bracket_results").delete().eq("id", existing.id);
    } else {
      const count = results.filter((r: any) => r.category === cat).length;
      if (count >= max) return toast.error(`Máximo ${max}`);
      await supabase.from("bracket_results").insert({ category: cat as any, team_id: teamId });
    }
    qc.invalidateQueries({ queryKey: ["bracket-results"] });
    qc.invalidateQueries({ queryKey: ["user_scores"] });
    toast.success("Bracket actualizado, puntos recalculados");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Marca los equipos que efectivamente avanzaron a cada fase. Los puntos se recalculan automáticamente.</p>
      {BR_CATS.map((cat) => {
        const sel = results.filter((r: any) => r.category === cat.k);
        return (
          <Card key={cat.k} className="p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold">{cat.l}</h3>
              <span className="text-xs text-muted-foreground">{sel.length}/{cat.n}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {teams.map((t: any) => {
                const isSel = sel.some((r: any) => r.team_id === t.id);
                return (
                  <button key={t.id} onClick={() => toggle(cat.k, t.id, cat.n)}
                    className={`px-3 py-1.5 rounded-md text-sm border ${isSel ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
                    {t.flag_emoji} {t.name}
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ScorerPanel() {
  const qc = useQueryClient();
  const { data: s } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("tournament_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  useEffect(() => setName(s?.actual_top_scorer ?? ""), [s]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tournament_settings").update({ actual_top_scorer: name.trim() || null, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message);
    else { toast.success("Goleador oficial actualizado"); qc.invalidateQueries({ queryKey: ["settings"] }); qc.invalidateQueries({ queryKey: ["user_scores"] }); }
  };

  return (
    <Card className="p-5 max-w-md">
      <form onSubmit={save} className="space-y-3">
        <Label>Goleador oficial del torneo</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
        <p className="text-xs text-muted-foreground">Al guardar se asignan 15 pts a los usuarios que acertaron (sin importar mayúsculas o espacios).</p>
        <Button type="submit">Guardar</Button>
      </form>
    </Card>
  );
}