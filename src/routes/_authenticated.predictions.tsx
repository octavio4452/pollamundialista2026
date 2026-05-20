import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Lock, Send, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/predictions")({ component: Predictions });

const BRACKET_CATS: { key: string; label: string; count: number; points: number }[] = [
  { key: "group_advance", label: "Avanzan de grupos", count: 24, points: 2 },
  { key: "round_of_16", label: "Avanzan a octavos", count: 16, points: 4 },
  { key: "quarter_final", label: "Avanzan a cuartos", count: 8, points: 8 },
  { key: "semi_final", label: "Avanzan a semifinal", count: 4, points: 12 },
  { key: "final", label: "Finalistas", count: 2, points: 20 },
  { key: "champion", label: "Campeón", count: 1, points: 30 },
];

function Predictions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-lock", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("predictions_locked_at").eq("id", user!.id).maybeSingle()).data,
  });
  const locked = !!profile?.predictions_locked_at;

  const { data: matches = [] } = useQuery({
    queryKey: ["matches-pred"],
    queryFn: async () =>
      (
        await supabase
          .from("matches")
          .select(
            "id, stage, group_name, kickoff, finished, home_score, away_score, home:home_team_id(id, name, code, flag_emoji), away:away_team_id(id, name, code, flag_emoji)",
          )
          .order("kickoff")
      ).data ?? [],
  });
  const { data: matchPreds = [] } = useQuery({
    queryKey: ["my-match-preds", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("match_predictions").select("*").eq("user_id", user!.id)).data ?? [],
  });
  const { data: bracketPreds = [] } = useQuery({
    queryKey: ["my-bracket", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("bracket_predictions").select("*").eq("user_id", user!.id)).data ?? [],
  });
  const { data: scorer } = useQuery({
    queryKey: ["my-scorer", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("top_scorer_predictions").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  const validation = useMemo(() => {
    const missingMatches = matches.filter((m: any) => !matchPreds.some((p: any) => p.match_id === m.id)).length;
    const bracketMissing = BRACKET_CATS.map((c) => ({
      label: c.label,
      need: c.count,
      have: bracketPreds.filter((p: any) => p.category === c.key).length,
    })).filter((b) => b.have !== b.need);
    const scorerMissing = !scorer?.player_name?.trim();
    const ok = missingMatches === 0 && bracketMissing.length === 0 && !scorerMissing;
    return { ok, missingMatches, bracketMissing, scorerMissing };
  }, [matches, matchPreds, bracketPreds, scorer]);

  const finalize = async (): Promise<void> => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ predictions_locked_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pronósticos enviados de forma definitiva");
    qc.invalidateQueries({ queryKey: ["profile-lock"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mis pronósticos</h1>
          <p className="text-muted-foreground mt-1">
            {locked
              ? "Tus pronósticos fueron enviados. Ya no se pueden modificar."
              : "Registra tus predicciones antes del inicio del partido."}
          </p>
        </div>
        {locked ? (
          <Badge className="gap-1 elevation-1" variant="secondary">
            <Lock className="size-3.5" />
            Enviado el {new Date(profile!.predictions_locked_at!).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
          </Badge>
        ) : (
          <FinalizeButton validation={validation} onConfirm={finalize} />
        )}
      </div>
      {!locked && !validation.ok && (
        <Card className="p-4 elevation-1 border-amber-500/30 bg-amber-500/5">
          <div className="text-sm font-medium mb-2">Te faltan pronósticos por completar:</div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            {validation.missingMatches > 0 && <li>{validation.missingMatches} partido(s) sin pronóstico</li>}
            {validation.bracketMissing.map((b) => (
              <li key={b.label}>
                {b.label}: {b.have}/{b.need}
              </li>
            ))}
            {validation.scorerMissing && <li>Goleador del torneo</li>}
          </ul>
        </Card>
      )}
      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">Partidos</TabsTrigger>
          <TabsTrigger value="bracket">Llaves</TabsTrigger>
          <TabsTrigger value="scorer">Goleador</TabsTrigger>
        </TabsList>
        <TabsContent value="matches" className="mt-4">
          <MatchesTab matches={matches} preds={matchPreds} locked={locked} />
        </TabsContent>
        <TabsContent value="bracket" className="mt-4">
          <BracketTab preds={bracketPreds} locked={locked} />
        </TabsContent>
        <TabsContent value="scorer" className="mt-4">
          <ScorerTab scorer={scorer} locked={locked} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinalizeButton({
  validation,
  onConfirm,
}: {
  validation: { ok: boolean };
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="lg" className="elevation-2 gap-2" disabled={!validation.ok}>
          <Send className="size-4" />
          Envío final de pronósticos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmar envío definitivo?</AlertDialogTitle>
          <AlertDialogDescription>
            Una vez enviados, tus pronósticos quedarán bloqueados y no podrás modificarlos.
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()}>
            <CheckCircle2 className="size-4 mr-1" /> Sí, enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MatchesTab({ matches, preds, locked }: { matches: any[]; preds: any[]; locked: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const predMap = new Map(preds.map((p: any) => [p.match_id, p]));

  const setPred = async (matchId: string, outcome: "home" | "draw" | "away") => {
    if (!user) return;
    const existing = predMap.get(matchId);
    const op = existing
      ? supabase.from("match_predictions").update({ predicted_outcome: outcome, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : supabase.from("match_predictions").insert({ user_id: user.id, match_id: matchId, predicted_outcome: outcome });
    const { error } = await op;
    if (error) toast.error(error.message);
    else {
      toast.success("Pronóstico guardado");
      qc.invalidateQueries({ queryKey: ["my-match-preds"] });
    }
  };

  const groupedMatches = useMemo(() => {
    const groups: Record<string, { label: string; items: any[] }> = {};
    for (const m of matches) {
      const isGroup = m.stage === "group";
      const key = isGroup ? `group-${m.group_name}` : m.stage;
      const label = isGroup ? `Grupo ${m.group_name}` : m.stage.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a.startsWith("group-") && b.startsWith("group-")) return a.localeCompare(b);
      if (a.startsWith("group-")) return -1;
      if (b.startsWith("group-")) return 1;
      const order = ["round_of_16", "quarter_final", "semi_final", "final"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [matches]);

  if (matches.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">El administrador aún no ha cargado partidos.</Card>;

  return (
    <div className="space-y-6">
      {groupedMatches.map(([key, { label, items }]) => {
        const completed = items.filter((m: any) => predMap.has(m.id)).length;
        return (
          <Card key={key} className="elevation-1 overflow-hidden">
            <div className="bg-primary/10 px-4 py-3 flex items-center justify-between border-b border-border">
              <h3 className="font-semibold text-sm uppercase tracking-wide">{label}</h3>
              <Badge variant="outline" className="text-xs">
                {completed}/{items.length} pronosticados
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {items.map((m: any) => {
                const matchLocked = locked || m.finished || new Date(m.kickoff) <= new Date();
                const p = predMap.get(m.id);
                const choice = (val: "home" | "draw" | "away", labelBtn: string) => {
                  const selected = p?.predicted_outcome === val;
                  if (locked && !selected) return null;
                  return (
                    <Button
                      key={val}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      disabled={matchLocked}
                      onClick={() => setPred(m.id, val)}
                    >
                      {labelBtn}
                    </Button>
                  );
                };
                return (
                  <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.kickoff).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                      <div className="font-medium mt-1 truncate">
                        {m.home?.flag_emoji} {m.home?.name} <span className="text-muted-foreground mx-1">vs</span> {m.away?.flag_emoji} {m.away?.name}
                      </div>
                      {m.finished && (
                        <div className="text-sm text-primary font-semibold mt-1">
                          Final: {m.home_score} - {m.away_score}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {locked && !p && (
                        <span className="text-xs text-muted-foreground italic">Sin pronóstico</span>
                      )}
                      {choice("home", m.home?.code || "Local")}
                      {choice("draw", "Empate")}
                      {choice("away", m.away?.code || "Visitante")}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function BracketTab({ preds, locked }: { preds: any[]; locked: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("group_name").order("name")).data ?? [],
  });

  if (teams.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">El admin debe cargar los equipos primero.</Card>;

  const toggle = async (cat: string, teamId: string, max: number) => {
    if (!user || locked) return;
    const existing = preds.find((p: any) => p.category === cat && p.team_id === teamId);
    if (existing) {
      const { error } = await supabase.from("bracket_predictions").delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const count = preds.filter((p: any) => p.category === cat).length;
      if (count >= max) return toast.error(`Máximo ${max} equipos en esta fase`);
      const { error } = await supabase
        .from("bracket_predictions")
        .insert({ user_id: user.id, category: cat as any, team_id: teamId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["my-bracket"] });
  };

  return (
    <div className="space-y-6">
      {BRACKET_CATS.map((cat) => {
        const selected = preds.filter((p: any) => p.category === cat.key);
        const visibleTeams = locked
          ? teams.filter((t: any) => selected.some((s: any) => s.team_id === t.id))
          : teams;
        return (
          <Card key={cat.key} className="p-5 elevation-1">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold">{cat.label}</h3>
              <span className="text-xs text-muted-foreground">
                {selected.length}/{cat.count} · {cat.points} pts c/u
              </span>
            </div>
            {locked && visibleTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No seleccionaste equipos en esta fase.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visibleTeams.map((t: any) => {
                  const isSel = selected.some((s: any) => s.team_id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={locked}
                      onClick={() => toggle(cat.key, t.id, cat.count)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        isSel
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted border-border"
                      } ${locked ? "cursor-default" : ""}`}
                    >
                      {t.flag_emoji} {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ScorerTab({ scorer, locked }: { scorer: any; locked: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => setName(scorer?.player_name ?? ""), [scorer]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || locked) return;
    const { error } = await supabase
      .from("top_scorer_predictions")
      .upsert({ user_id: user.id, player_name: name.trim(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Goleador guardado");
      qc.invalidateQueries({ queryKey: ["my-scorer"] });
    }
  };

  if (locked) {
    return (
      <Card className="p-5 elevation-1 max-w-md">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Tu goleador</div>
        <div className="text-lg font-semibold">{scorer?.player_name || "—"}</div>
      </Card>
    );
  }

  return (
    <Card className="p-5 elevation-1 max-w-md">
      <form onSubmit={save} className="space-y-3">
        <Label htmlFor="scorer">Tu pronóstico para goleador (15 pts)</Label>
        <Input id="scorer" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Lionel Messi" maxLength={120} />
        <Button type="submit">Guardar</Button>
      </form>
    </Card>
  );
}