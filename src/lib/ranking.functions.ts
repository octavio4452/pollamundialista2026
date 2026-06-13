import { createServerFn } from "@tanstack/react-start";

export const getPublicRanking = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_scores")
    .select("*")
    .order("total_points", { ascending: false });
  if (error) throw error;
  return (data ?? []) as {
    user_id: string;
    full_name: string;
    match_points: number;
    bracket_points: number;
    scorer_points: number;
    total_points: number;
  }[];
});
