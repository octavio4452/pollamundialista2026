import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRanking } from "@/lib/ranking.functions";
import { Card } from "@/components/ui/card";
import { Trophy, Medal, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const fetchRanking = useServerFn(getPublicRanking);
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["user_scores"],
    queryFn: () => fetchRanking(),
  });

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="size-5 text-accent" />;
    if (i === 1) return <Medal className="size-5 text-muted-foreground" />;
    if (i === 2) return <Award className="size-5 text-muted-foreground/70" />;
    return <span className="text-sm text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tabla de posiciones</h1>
        <p className="text-muted-foreground mt-1">Puntos acumulados de cada participante.</p>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-3 px-4 w-12">#</th>
                <th className="text-left py-3 px-4">Participante</th>
                <th className="text-right py-3 px-4">Partidos</th>
                <th className="text-right py-3 px-4">Llaves</th>
                <th className="text-right py-3 px-4">Goleador</th>
                <th className="text-right py-3 px-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Cargando…</td></tr>
              ) : scores.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sin participantes aún.</td></tr>
              ) : (
                scores.map((s: any, i: number) => (
                  <tr key={s.user_id} className="border-t hover:bg-muted/30">
                    <td className="py-3 px-4">{rankIcon(i)}</td>
                    <td className="py-3 px-4 font-medium">{s.full_name}</td>
                    <td className="py-3 px-4 text-right">{s.match_points}</td>
                    <td className="py-3 px-4 text-right">{s.bracket_points}</td>
                    <td className="py-3 px-4 text-right">{s.scorer_points}</td>
                    <td className="py-3 px-4 text-right font-bold text-primary">{s.total_points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Reglas de puntuación</h2>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• <b className="text-foreground">1 pt</b> — acertar resultado (gana, empate) en fase de grupos</li>
          <li>• <b className="text-foreground">2 pts c/u</b> — equipos que avanzan por grupos</li>
          <li>• <b className="text-foreground">4 pts c/u</b> — equipos que llegan a octavos</li>
          <li>• <b className="text-foreground">8 pts c/u</b> — equipos que llegan a cuartos</li>
          <li>• <b className="text-foreground">12 pts c/u</b> — equipos que llegan a semifinal</li>
          <li>• <b className="text-foreground">20 pts c/u</b> — finalistas</li>
          <li>• <b className="text-foreground">30 pts</b> — campeón</li>
          <li>• <b className="text-foreground">15 pts</b> — goleador del torneo</li>
        </ul>
      </Card>
    </div>
  );
}