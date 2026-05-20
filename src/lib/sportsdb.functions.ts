import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SPORTSDB_KEY = "3";
const SPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const COLOMBIA_LEAGUE_ID = "4497"; // Colombia Categoría Primera A
const WORLD_CUP_LEAGUE_ID = "4429"; // FIFA World Cup

type SportsDbEvent = {
  idEvent: string;
  dateEvent: string;
  strTime?: string | null;
  strTimestamp?: string | null;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  strStatus?: string | null;
  strLeague?: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("No autorizado: se requiere rol admin");
}

function mapEvent(e: SportsDbEvent) {
  const hs = e.intHomeScore != null ? Number(e.intHomeScore) : null;
  const as = e.intAwayScore != null ? Number(e.intAwayScore) : null;
  return {
    id: e.idEvent,
    date: e.dateEvent,
    time: e.strTime ?? null,
    home: e.strHomeTeam,
    away: e.strAwayTeam,
    homeBadge: e.strHomeTeamBadge ?? null,
    awayBadge: e.strAwayTeamBadge ?? null,
    homeScore: Number.isFinite(hs as number) ? hs : null,
    awayScore: Number.isFinite(as as number) ? as : null,
    finished: hs != null && as != null,
  };
}

export const getColombianMatches = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [pastRes, nextRes] = await Promise.all([
      fetch(`${SPORTSDB_BASE}/eventspastleague.php?id=${COLOMBIA_LEAGUE_ID}`),
      fetch(`${SPORTSDB_BASE}/eventsnextleague.php?id=${COLOMBIA_LEAGUE_ID}`),
    ]);
    const past = pastRes.ok ? ((await pastRes.json())?.events as SportsDbEvent[] | null) ?? [] : [];
    const next = nextRes.ok ? ((await nextRes.json())?.events as SportsDbEvent[] | null) ?? [] : [];
    return {
      league: "Liga Colombiana — Categoría Primera A",
      past: past.map(mapEvent),
      upcoming: next.map(mapEvent),
      error: null as string | null,
    };
  } catch (e: any) {
    return { league: "Liga Colombiana", past: [], upcoming: [], error: e?.message ?? "error" };
  }
});

// Normalize names so EN (TheSportsDB) matches our ES team names
const NAME_ALIASES: Record<string, string> = {
  "united states": "estados unidos",
  "usa": "estados unidos",
  "england": "inglaterra",
  "mexico": "méxico",
  "canada": "canadá",
  "ecuador": "ecuador",
  "uzbekistan": "uzbekistán",
  "senegal": "senegal",
  "qatar": "catar",
  "argentina": "argentina",
  "croatia": "croacia",
  "ivory coast": "costa de marfil",
  "cote d'ivoire": "costa de marfil",
  "new zealand": "nueva zelanda",
  "france": "francia",
  "netherlands": "países bajos",
  "holland": "países bajos",
  "australia": "australia",
  "cape verde": "cabo verde",
  "spain": "españa",
  "switzerland": "suiza",
  "egypt": "egipto",
  "jordan": "jordania",
  "brazil": "brasil",
  "belgium": "bélgica",
  "morocco": "marruecos",
  "panama": "panamá",
  "germany": "alemania",
  "portugal": "portugal",
  "japan": "japón",
  "south africa": "sudáfrica",
  "italy": "italia",
  "uruguay": "uruguay",
  "south korea": "corea del sur",
  "korea republic": "corea del sur",
  "tunisia": "túnez",
  "colombia": "colombia",
  "denmark": "dinamarca",
  "iran": "irán",
  "ir iran": "irán",
  "ghana": "ghana",
  "hungary": "hungría",
  "austria": "austria",
  "saudi arabia": "arabia saudita",
  "curacao": "curazao",
  "curaçao": "curazao",
  "norway": "noruega",
  "poland": "polonia",
  "algeria": "argelia",
  "jamaica": "jamaica",
  "turkey": "turquía",
  "türkiye": "turquía",
  "scotland": "escocia",
  "nigeria": "nigeria",
  "paraguay": "paraguay",
};

function normalize(s: string) {
  return (s || "").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function teamLookup(name: string, teams: Array<{ id: string; name: string }>) {
  const target = normalize(NAME_ALIASES[normalize(name)] ?? name);
  return teams.find((t) => normalize(t.name) === target);
}

function stageFromName(label: string): "group" | "round_of_16" | "quarter_final" | "semi_final" | "final" | "third_place" {
  const l = label.toLowerCase();
  if (l.includes("final") && !l.includes("semi") && !l.includes("quarter") && !l.includes("third") && !l.includes("3rd")) return "final";
  if (l.includes("third") || l.includes("3rd")) return "third_place";
  if (l.includes("semi")) return "semi_final";
  if (l.includes("quarter")) return "quarter_final";
  if (l.includes("round of 16") || l.includes("16")) return "round_of_16";
  return "group";
}

export const importWorldCupFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await fetch(`${SPORTSDB_BASE}/eventsnextleague.php?id=${WORLD_CUP_LEAGUE_ID}`);
    if (!res.ok) throw new Error(`TheSportsDB respondió ${res.status}`);
    const json = await res.json();
    const events: SportsDbEvent[] = json?.events ?? [];
    if (!events.length) {
      return { imported: 0, skipped: 0, notMatched: [], message: "TheSportsDB no devolvió próximos partidos del Mundial (la cuenta gratis sólo expone los próximos 15 días)." };
    }
    const { data: teams } = await supabaseAdmin.from("teams").select("id,name");
    const teamList = teams ?? [];
    const { data: existing } = await supabaseAdmin.from("matches").select("home_team_id,away_team_id,kickoff");
    const seen = new Set((existing ?? []).map((m: any) => `${m.home_team_id}|${m.away_team_id}|${(m.kickoff || "").slice(0, 10)}`));
    let imported = 0, skipped = 0;
    const notMatched: string[] = [];
    const toInsert: any[] = [];
    for (const e of events) {
      const h = teamLookup(e.strHomeTeam, teamList);
      const a = teamLookup(e.strAwayTeam, teamList);
      if (!h || !a) { notMatched.push(`${e.strHomeTeam} vs ${e.strAwayTeam}`); continue; }
      const kickoff = e.strTimestamp ? new Date(e.strTimestamp).toISOString() : new Date(`${e.dateEvent}T${e.strTime || "12:00:00"}Z`).toISOString();
      const key = `${h.id}|${a.id}|${kickoff.slice(0, 10)}`;
      if (seen.has(key)) { skipped++; continue; }
      toInsert.push({
        stage: stageFromName(e.strEvent),
        group_name: null,
        home_team_id: h.id, away_team_id: a.id, kickoff,
      });
      imported++;
    }
    if (toInsert.length) await supabaseAdmin.from("matches").insert(toInsert);
    return { imported, skipped, notMatched, message: null as string | null };
  });

export const syncWorldCupResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const res = await fetch(`${SPORTSDB_BASE}/eventspastleague.php?id=${WORLD_CUP_LEAGUE_ID}`);
    if (!res.ok) throw new Error(`TheSportsDB respondió ${res.status}`);
    const json = await res.json();
    const events: SportsDbEvent[] = json?.events ?? [];
    if (!events.length) return { updated: 0, notMatched: [], message: "TheSportsDB aún no tiene resultados pasados del Mundial." };
    const { data: teams } = await supabaseAdmin.from("teams").select("id,name");
    const { data: matches } = await supabaseAdmin.from("matches").select("id,home_team_id,away_team_id,kickoff,finished");
    const teamList = teams ?? [];
    const matchList = matches ?? [];
    let updated = 0;
    const notMatched: string[] = [];
    for (const e of events) {
      const hs = e.intHomeScore != null ? Number(e.intHomeScore) : null;
      const as = e.intAwayScore != null ? Number(e.intAwayScore) : null;
      if (hs == null || as == null) continue;
      const h = teamLookup(e.strHomeTeam, teamList);
      const a = teamLookup(e.strAwayTeam, teamList);
      if (!h || !a) { notMatched.push(`${e.strHomeTeam} vs ${e.strAwayTeam}`); continue; }
      const m = matchList.find((m: any) =>
        m.home_team_id === h.id && m.away_team_id === a.id &&
        (m.kickoff || "").slice(0, 10) === e.dateEvent,
      ) || matchList.find((m: any) => m.home_team_id === h.id && m.away_team_id === a.id);
      if (!m) { notMatched.push(`${e.strHomeTeam} vs ${e.strAwayTeam} (no agendado)`); continue; }
      const { error } = await supabaseAdmin.from("matches")
        .update({ home_score: hs, away_score: as, finished: true }).eq("id", m.id);
      if (!error) updated++;
    }
    return { updated, notMatched, message: null as string | null };
  });