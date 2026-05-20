import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/predictions")({ component: Predictions });

function Predictions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis pronósticos</h1>
        <p className="text-muted-foreground mt-1">Registra tus predicciones antes del inicio del partido.</p>
      </div>
      <Tabs defaultValue="matches">
        <TabsList>
          <TabsTrigger value="matches">Partidos</TabsTrigger>
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
          <TabsTrigger value="scorer">Goleador</TabsTrigger>
        </TabsList>
        <TabsContent value="matches" className="mt-4"><MatchesTab /></TabsContent>
        <TabsContent value="bracket" className="mt-4"><BracketTab /></TabsContent>
        <TabsContent value="scorer" className="mt-4"><ScorerTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function MatchesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: matches = [] } = useQuery({
    queryKey: ["matches-pred"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, stage, group_name, kickoff, finished, home_score, away_score, home:home_team_id(id, name, code, flag_emoji), away:away_team_id(id, name, code, flag_emoji)")
        .order("kickoff");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: preds = [] } = useQuery({
    queryKey: ["my-match-preds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("match_predictions").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
  });

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

  if (matches.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">El administrador aún no ha cargado partidos.</Card>;

  return (
    <div className="space-y-3">
      {matches.map((m: any) => {
        const locked = m.finished || new Date(m.kickoff) <= new Date();
        const p = predMap.get(m.id);
        const choice = (val: "home" | "draw" | "away", label: string) => (
          <Button
            key={val}
            type="button"
            variant={p?.predicted_outcome === val ? "default" : "outline"}
            size="sm"
            disabled={locked}
            onClick={() => setPred(m.id, val)}
          >
            {label}
          </Button>
        );
        return (
          <Card key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {m.stage === "group" ? `Grupo ${m.group_name}` : m.stage.replace(/_/g, " ")} ·{" "}
                {new Date(m.kickoff).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <div className="font-medium mt-1">
                {m.home?.flag_emoji} {m.home?.name} <span className="text-muted-foreground">vs</span> {m.away?.flag_emoji} {m.away?.name}
              </div>
              {m.finished && (
                <div className="text-sm text-primary font-semibold mt-1">
                  Final: {m.home_score} - {m.away_score}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {choice("home", m.home?.code || "Local")}
              {choice("draw", "Empate")}
              {choice("away", m.away?.code || "Visitante")}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const BRACKET_CATS: { key: string; label: string; count: number; points: number }[] = [
  { key: "group_advance", label: "Avanzan de grupos", count: 24, points: 2 },
  { key: "round_of_16", label: "Avanzan a octavos", count: 16, points: 4 },
  { key: "quarter_final", label: "Avanzan a cuartos", count: 8, points: 8 },
  { key: "semi_final", label: "Avanzan a semifinal", count: 4, points: 12 },
  { key: "final", label: "Finalistas", count: 2, points: 20 },
  { key: "champion", label: "Campeón", count: 1, points: 30 },
];

function BracketTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await supabase.from("teams").select("*").order("group_name").order("name")).data ?? [],
  });
  const { data: preds = [] } = useQuery({
    queryKey: ["my-bracket", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("bracket_predictions").select("*").eq("user_id", user!.id)).data ?? [],
  });

  if (teams.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">El admin debe cargar los equipos primero.</Card>;

  const toggle = async (cat: string, teamId: string, max: number) => {
    if (!user) return;
    const existing = preds.find((p: any) => p.category === cat && p.team_id === teamId);
    if (existing) {
      const { error } = await supabase.from("bracket_predictions").delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const count = preds.filter((p: any) => p.category === cat).length;
      if (count >= max) return toast.error(`Máximo ${max} equipos en esta fase`);
      const { error } = await supabase
        .from("bracket_predictions")
        .insert({ user_id: user.id, category: cat, team_id: teamId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["my-bracket"] });
  };

  return (
    <div className="space-y-6">
      {BRACKET_CATS.map((cat) => {
        const selected = preds.filter((p: any) => p.category === cat.key);
        return (
          <Card key={cat.key} className="p-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold">{cat.label}</h3>
              <span className="text-xs text-muted-foreground">
                {selected.length}/{cat.count} · {cat.points} pts c/u
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {teams.map((t: any) => {
                const isSel = selected.some((s: any) => s.team_id === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(cat.key, t.id, cat.count)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      isSel
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted border-border"
                    }`}
                  >
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

function ScorerTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: current } = useQuery({
    queryKey: ["my-scorer", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("top_scorer_predictions").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  useEffect(() => setName(current?.player_name ?? ""), [current]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    const { error } = await supabase
      .from("top_scorer_predictions")
      .upsert({ user_id: user.id, player_name: name.trim(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Goleador guardado");
      qc.invalidateQueries({ queryKey: ["my-scorer"] });
    }
  };

  return (
    <Card className="p-5 max-w-md">
      <form onSubmit={save} className="space-y-3">
        <Label htmlFor="scorer">Tu pronóstico para goleador (15 pts)</Label>
        <Input id="scorer" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Lionel Messi" maxLength={120} />
        <Button type="submit">Guardar</Button>
      </form>
    </Card>
  );
}