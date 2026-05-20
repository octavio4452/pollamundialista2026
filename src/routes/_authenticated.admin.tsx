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
import { Trash2, ShieldCheck, ShieldOff, RefreshCw, Download, Unlock, Lock } from "lucide-react";
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
          <TabsTrigger value="bracket">Llaves oficiales</TabsTrigger>
          <TabsTrigger value="scorer">Goleador oficial</TabsTrigger>
          <TabsTrigger value="sync">Sincronizar Mundial</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersPanel /></TabsContent>
        <TabsContent value="teams" className="mt-4"><TeamsPanel /></TabsContent>
        <TabsContent value="matches" className="mt-4"><MatchesPanel /></TabsContent>
        <TabsContent value="bracket" className="mt-4"><BracketPanel /></TabsContent>
        <TabsContent value="scorer" className="mt-4"><ScorerPanel /></TabsContent>
        <TabsContent value="sync" className="mt-4"><SyncPanel /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsPanel /></TabsContent>
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
            <tr><th className="text-left p-3">Nombre</th><th className="text-left p-3">Rol</th><th className="text-left p-3">Pronósticos</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3">{u.isAdmin ? <span className="text-primary">Admin</span> : "Usuario"}</td>
                <td className="p-3">
                  {u.predictions_locked_at
                    ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Lock className="size-3" /> Bloqueados</span>
                    : <span className="text-xs text-muted-foreground">Abiertos</span>}
                </td>
                <td className="p-3 flex justify-end gap-2">
                  {u.predictions_locked_at && (
                    <Button variant="outline" size="sm" title="Desbloquear envío de pronósticos" onClick={async () => {
                      if (!confirm(`¿Desbloquear los pronósticos de ${u.full_name}? Podrá editarlos y volver a enviarlos.`)) return;
                      const { error } = await supabase.from("profiles").update({ predictions_locked_at: null }).eq("id", u.id);
                      if (error) toast.error(error.message);
                      else { toast.success("Pronósticos desbloqueados"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
                    }}>
                      <Unlock className="size-4" />
                    </Button>
                  )}
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

  const clearResult = async (id: string) => {
    if (!confirm("¿Borrar el resultado de este partido? Los puntos asignados se recalcularán a 0.")) return;
    const { error } = await supabase.from("matches").update({ home_score: null, away_score: null, finished: false }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Resultado borrado, puntos recalculados"); qc.invalidateQueries({ queryKey: ["admin-matches"] }); }
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
        {matches.map((m: any) => <MatchRow key={m.id} match={m} onSave={saveResult} onClear={clearResult} onDelete={del} />)}
        {matches.length === 0 && <Card className="p-8 text-center text-muted-foreground">No hay partidos.</Card>}
      </div>
    </div>
  );
}

function MatchRow({ match, onSave, onClear, onDelete }: { match: any; onSave: (id: string, h: number, a: number) => void; onClear: (id: string) => void; onDelete: (id: string) => void }) {
  const [h, setH] = useState<string>(match.home_score?.toString() ?? "");
  const [a, setA] = useState<string>(match.away_score?.toString() ?? "");
  useEffect(() => {
    setH(match.home_score?.toString() ?? "");
    setA(match.away_score?.toString() ?? "");
  }, [match.home_score, match.away_score]);
  return (
    <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground uppercase flex items-center gap-2">
          <span>
            {match.stage === "group" ? `Grupo ${match.group_name}` : match.stage} ·{" "}
            {new Date(match.kickoff).toLocaleString("es")}
          </span>
          {match.finished && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
              FINALIZADO
            </span>
          )}
        </div>
        <div className="font-medium mt-0.5">{match.home?.name} vs {match.away?.name}</div>
      </div>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} className="w-16" value={h} onChange={(e) => setH(e.target.value)} />
        <span>-</span>
        <Input type="number" min={0} className="w-16" value={a} onChange={(e) => setA(e.target.value)} />
        <Button size="sm" onClick={() => onSave(match.id, parseInt(h), parseInt(a))} disabled={h === "" || a === ""}>
          {match.finished ? "Actualizar" : "Guardar"}
        </Button>
        {match.finished && (
          <Button size="sm" variant="outline" onClick={() => onClear(match.id)} title="Borrar resultado y recalcular puntos">
            Borrar resultado
          </Button>
        )}
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
    toast.success("Llaves actualizadas, puntos recalculados");
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

function SyncPanel() {
  const qc = useQueryClient();
  const importFn = useServerFn(importWorldCupFixture);
  const syncFn = useServerFn(syncWorldCupResults);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastImport, setLastImport] = useState<any>(null);
  const [lastSync, setLastSync] = useState<any>(null);

  const doImport = async () => {
    setImporting(true);
    try {
      const r = await importFn();
      setLastImport(r);
      toast.success(`Importados ${r.imported}, omitidos ${r.skipped}`);
      qc.invalidateQueries({ queryKey: ["admin-matches"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setImporting(false); }
  };
  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncFn();
      setLastSync(r);
      toast.success(`Resultados actualizados: ${r.updated}`);
      qc.invalidateQueries({ queryKey: ["admin-matches"] });
      qc.invalidateQueries({ queryKey: ["user_scores"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2"><Download className="size-4 text-primary" /><h3 className="font-semibold">Importar fixture</h3></div>
        <p className="text-sm text-muted-foreground">
          Trae los próximos partidos del Mundial 2026 desde TheSportsDB. Los partidos ya cargados (mismo emparejamiento y fecha) se omiten.
        </p>
        <Button onClick={doImport} disabled={importing}>{importing ? "Importando…" : "Importar próximos partidos"}</Button>
        {lastImport && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <div>Importados: <b>{lastImport.imported}</b> · Omitidos: <b>{lastImport.skipped}</b></div>
            {lastImport.message && <div className="mt-1">{lastImport.message}</div>}
            {lastImport.notMatched?.length > 0 && (
              <details className="mt-1"><summary>Sin coincidir ({lastImport.notMatched.length})</summary>
                <ul className="mt-1 list-disc pl-4">{lastImport.notMatched.map((n: string) => <li key={n}>{n}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </Card>
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2"><RefreshCw className="size-4 text-primary" /><h3 className="font-semibold">Sincronizar resultados</h3></div>
        <p className="text-sm text-muted-foreground">
          Actualiza los marcadores finales de los partidos ya jugados. Al guardarse, los triggers recalculan automáticamente los puntos de cada usuario.
        </p>
        <Button onClick={doSync} disabled={syncing}>{syncing ? "Sincronizando…" : "Sincronizar resultados"}</Button>
        {lastSync && (
          <div className="text-xs text-muted-foreground border-t pt-3">
            <div>Partidos actualizados: <b>{lastSync.updated}</b></div>
            {lastSync.message && <div className="mt-1">{lastSync.message}</div>}
            {lastSync.notMatched?.length > 0 && (
              <details className="mt-1"><summary>Sin coincidir ({lastSync.notMatched.length})</summary>
                <ul className="mt-1 list-disc pl-4">{lastSync.notMatched.map((n: string) => <li key={n}>{n}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </Card>
      <Card className="p-5 md:col-span-2 bg-muted/30 text-sm text-muted-foreground">
        <b className="text-foreground">Nota:</b> usamos el plan gratuito de TheSportsDB (clave pública <code>3</code>), que sólo expone los próximos y los últimos 15 días de cada liga. Antes del kickoff del Mundial los endpoints pueden devolver vacío; durante el torneo se irán poblando automáticamente.
      </Card>
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  final: "Final",
  third_place: "3er lugar",
};
const OUTCOME_LABEL: Record<string, string> = { home: "Local", draw: "Empate", away: "Visitante" };
const CAT_LABEL: Record<string, string> = {
  group_advance: "Avanzan de grupos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  final: "Finalistas",
  champion: "Campeón",
};

function ReportsPanel() {
  const [busy, setBusy] = useState(false);

  const { data: lockedUsers = [] } = useQuery({
    queryKey: ["admin-locked-users"],
    queryFn: async () =>
      (await supabase
        .from("profiles")
        .select("id, full_name, predictions_locked_at")
        .not("predictions_locked_at", "is", null)
        .order("predictions_locked_at", { ascending: true })).data ?? [],
  });

  const generate = async () => {
    setBusy(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const ids = lockedUsers.map((u: any) => u.id);
      if (ids.length === 0) {
        toast.error("Aún no hay pronósticos finales enviados");
        return;
      }

      const [teamsRes, matchesRes, mpRes, bpRes, tsRes] = await Promise.all([
        supabase.from("teams").select("id, name, code, flag_emoji, group_name"),
        supabase.from("matches").select("id, stage, group_name, kickoff, home_team_id, away_team_id").order("kickoff"),
        supabase.from("match_predictions").select("user_id, match_id, predicted_outcome").in("user_id", ids),
        supabase.from("bracket_predictions").select("user_id, category, team_id").in("user_id", ids),
        supabase.from("top_scorer_predictions").select("user_id, player_name").in("user_id", ids),
      ]);

      const teams = new Map((teamsRes.data ?? []).map((t: any) => [t.id, t]));
      const matches = matchesRes.data ?? [];
      const matchById = new Map(matches.map((m: any) => [m.id, m]));

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const generatedAt = new Date();
      const fmt = (d: Date | string | null) =>
        d ? new Date(d).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" }) : "—";

      doc.setFontSize(18);
      doc.text("Reporte de pronósticos finales", 40, 50);
      doc.setFontSize(10);
      doc.text(`Generado: ${fmt(generatedAt)}`, 40, 68);
      doc.text(`Participantes con envío final: ${lockedUsers.length}`, 40, 82);

      lockedUsers.forEach((u: any, idx: number) => {
        doc.addPage();

        doc.setFontSize(14);
        doc.text(u.full_name ?? "Usuario", 40, 50);
        doc.setFontSize(10);
        doc.text(`Enviado: ${fmt(u.predictions_locked_at)}`, 40, 66);
        doc.text(`Reporte generado: ${fmt(generatedAt)}`, 40, 80);

        // Matches
        const userMatches = (mpRes.data ?? []).filter((p: any) => p.user_id === u.id);
        const matchRows = userMatches
          .map((p: any) => {
            const m = matchById.get(p.match_id);
            if (!m) return null;
            const home: any = teams.get(m.home_team_id);
            const away: any = teams.get(m.away_team_id);
            return [
              m.stage === "group" ? `Grupo ${m.group_name}` : STAGE_LABEL[m.stage] ?? m.stage,
              fmt(m.kickoff),
              `${home?.flag_emoji ?? ""} ${home?.name ?? "?"} vs ${away?.flag_emoji ?? ""} ${away?.name ?? "?"}`,
              OUTCOME_LABEL[p.predicted_outcome] ?? p.predicted_outcome,
            ];
          })
          .filter(Boolean) as any[];

        autoTable(doc, {
          startY: 100,
          head: [["Fase", "Fecha", "Partido", "Pronóstico"]],
          body: matchRows,
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [40, 40, 40] },
          didDrawPage: () => {
            doc.setFontSize(8);
            doc.text(
              `${u.full_name} · pág. ${doc.getNumberOfPages()}`,
              40,
              doc.internal.pageSize.getHeight() - 20
            );
          },
        });

        // Bracket
        const userBracket = (bpRes.data ?? []).filter((p: any) => p.user_id === u.id);
        const bracketRows = Object.keys(CAT_LABEL).map((cat) => {
          const picks = userBracket
            .filter((b: any) => b.category === cat)
            .map((b: any) => {
              const t: any = teams.get(b.team_id);
              return `${t?.flag_emoji ?? ""} ${t?.name ?? "?"}`;
            })
            .join(", ");
          return [CAT_LABEL[cat], picks || "—"];
        });

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 16,
          head: [["Llaves", "Equipos"]],
          body: bracketRows,
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [40, 40, 40] },
        });

        // Top scorer
        const ts = (tsRes.data ?? []).find((s: any) => s.user_id === u.id);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 16,
          head: [["Goleador", ""]],
          body: [["Pronóstico", ts?.player_name ?? "—"]],
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [40, 40, 40] },
        });
      });

      doc.save(`pronosticos-${generatedAt.toISOString().slice(0, 10)}.pdf`);
      toast.success("Reporte generado");
    } catch (e: any) {
      toast.error(e.message ?? "Error generando el reporte");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="size-4 text-primary" />
          <h3 className="font-semibold">Pronósticos finales en PDF</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Genera un informe con los pronósticos enviados por cada participante. Incluye la fecha de envío
          de cada usuario y la fecha de generación del reporte.
        </p>
        <div className="text-sm">
          Participantes con envío final: <b>{lockedUsers.length}</b>
        </div>
        <Button onClick={generate} disabled={busy || lockedUsers.length === 0}>
          {busy ? "Generando…" : "Descargar PDF"}
        </Button>
      </Card>
      {lockedUsers.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Participante</th>
                <th className="text-left p-3">Enviado el</th>
              </tr>
            </thead>
            <tbody>
              {lockedUsers.map((u: any) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.full_name}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(u.predictions_locked_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}