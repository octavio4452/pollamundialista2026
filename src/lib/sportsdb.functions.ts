import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// API-Football vía RapidAPI — cobertura completa del Mundial 2026 y Liga BetPlay.
const RAPID_HOST = "api-football-v1.p.rapidapi.com";
const API_BASE = `https://${RAPID_HOST}/v3`;
const COLOMBIA_LEAGUE_ID = 239; // Primera A — Colombia
const WORLD_CUP_LEAGUE_ID = 1;  // FIFA World Cup
const WC_SEASON = 2026;

function apiHeaders() {
  const key = process.env.RAPIDAPI_FOOTBALL_KEY;
  if (!key) throw new Error("RAPIDAPI_FOOTBALL_KEY no está configurado");
  return { "X-RapidAPI-Key": key, "X-RapidAPI-Host": RAPID_HOST };
}

type ApiFixture = {
  fixture: { id: number; date: string; timestamp: number; status: { short: string; long: string } };
  league: { id: number; name: string; round: string; season: number };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
};

async function fetchFixtures(params: Record<string, string | number>): Promise<ApiFixture[]> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${API_BASE}/fixtures?${qs}`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`API-Football respondió ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return (json?.response ?? []) as ApiFixture[];
}

function mapFixture(f: ApiFixture) {
  const finished = ["FT", "AET", "PEN"].includes(f.fixture.status.short);
  return {
    id: String(f.fixture.id),
    date: f.fixture.date.slice(0, 10),
    time: f.fixture.date.slice(11, 16),
    home: f.teams.home.name,
    away: f.teams.away.name,
    homeBadge: f.teams.home.logo,
    awayBadge: f.teams.away.logo,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    finished,
  };
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("No autorizado: se requiere rol admin");
}

export const getColombianMatches = createServerFn({ method: "GET" }).handler(async () => {
  // Buscamos la temporada vigente probando años recientes hasta encontrar fixtures.
  const candidateSeasons = [new Date().getUTCFullYear(), new Date().getUTCFullYear() - 1];
  try {
    let past: ApiFixture[] = [];
    let next: ApiFixture[] = [];
    let usedSeason: number | null = null;
    for (const season of candidateSeasons) {
      const [p, n] = await Promise.all([
        fetchFixtures({ league: COLOMBIA_LEAGUE_ID, season, last: 10 }),
        fetchFixtures({ league: COLOMBIA_LEAGUE_ID, season, next: 10 }),
      ]);
      if (p.length || n.length) { past = p; next = n; usedSeason = season; break; }
    }
    return {
      league: `Liga BetPlay — Primera A${usedSeason ? ` (${usedSeason})` : ""}`,
      past: past.map(mapFixture),
      upcoming: next.map(mapFixture),
      error: null as string | null,
    };
  } catch (e: any) {
    return { league: "Liga BetPlay — Primera A", past: [], upcoming: [], error: e?.message ?? "error" };
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

function stageFromRound(label: string): "group" | "round_of_16" | "quarter_final" | "semi_final" | "final" | "third_place" {
  const l = label.toLowerCase();
  if (l.includes("3rd") || l.includes("third")) return "third_place";
  if (l.includes("semi")) return "semi_final";
  if (l.includes("quarter")) return "quarter_final";
  if (l.includes("round of 16") || l.includes("16")) return "round_of_16";
  if (l.includes("group")) return "group";
  if (l.includes("final")) return "final";
  return "group";
}

function groupNameFromRound(label: string): string | null {
  // Ej: "Group Stage - 1", "Group A - 1"
  const m = label.match(/group\s+([a-l])/i);
  return m ? m[1].toUpperCase() : null;
}

export const importWorldCupFixture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const events = await fetchFixtures({ league: WORLD_CUP_LEAGUE_ID, season: WC_SEASON });
    if (!events.length) {
      return { imported: 0, skipped: 0, notMatched: [], message: "API-Football no devolvió fixtures del Mundial 2026 todavía." };
    }
    const { data: teams } = await supabaseAdmin.from("teams").select("id,name");
    const teamList = teams ?? [];
    const { data: existing } = await supabaseAdmin.from("matches").select("home_team_id,away_team_id,kickoff");
    const seen = new Set((existing ?? []).map((m: any) => `${m.home_team_id}|${m.away_team_id}|${(m.kickoff || "").slice(0, 10)}`));
    let imported = 0, skipped = 0;
    const notMatched: string[] = [];
    const toInsert: any[] = [];
    for (const e of events) {
      const h = teamLookup(e.teams.home.name, teamList);
      const a = teamLookup(e.teams.away.name, teamList);
      if (!h || !a) { notMatched.push(`${e.teams.home.name} vs ${e.teams.away.name}`); continue; }
      const kickoff = new Date(e.fixture.date).toISOString();
      const key = `${h.id}|${a.id}|${kickoff.slice(0, 10)}`;
      if (seen.has(key)) { skipped++; continue; }
      toInsert.push({
        stage: stageFromRound(e.league.round),
        group_name: groupNameFromRound(e.league.round),
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
    const events = await fetchFixtures({ league: WORLD_CUP_LEAGUE_ID, season: WC_SEASON, status: "FT-AET-PEN" });
    if (!events.length) return { updated: 0, notMatched: [], message: "Aún no hay resultados finalizados del Mundial 2026." };
    const { data: teams } = await supabaseAdmin.from("teams").select("id,name");
    const { data: matches } = await supabaseAdmin.from("matches").select("id,home_team_id,away_team_id,kickoff,finished");
    const teamList = teams ?? [];
    const matchList = matches ?? [];
    let updated = 0;
    const notMatched: string[] = [];
    for (const e of events) {
      const hs = e.goals.home;
      const as = e.goals.away;
      if (hs == null || as == null) continue;
      const h = teamLookup(e.teams.home.name, teamList);
      const a = teamLookup(e.teams.away.name, teamList);
      if (!h || !a) { notMatched.push(`${e.teams.home.name} vs ${e.teams.away.name}`); continue; }
      const dateStr = e.fixture.date.slice(0, 10);
      const m = matchList.find((m: any) =>
        m.home_team_id === h.id && m.away_team_id === a.id &&
        (m.kickoff || "").slice(0, 10) === dateStr,
      ) || matchList.find((m: any) => m.home_team_id === h.id && m.away_team_id === a.id);
      if (!m) { notMatched.push(`${e.teams.home.name} vs ${e.teams.away.name} (no agendado)`); continue; }
      const { error } = await supabaseAdmin.from("matches")
        .update({ home_score: hs, away_score: as, finished: true }).eq("id", m.id);
      if (!error) updated++;
    }
    return { updated, notMatched, message: null as string | null };
  });