export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bracket_predictions: {
        Row: {
          category: Database["public"]["Enums"]["bracket_category"]
          created_at: string
          id: string
          points_awarded: number
          team_id: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["bracket_category"]
          created_at?: string
          id?: string
          points_awarded?: number
          team_id: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["bracket_category"]
          created_at?: string
          id?: string
          points_awarded?: number
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_predictions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_results: {
        Row: {
          category: Database["public"]["Enums"]["bracket_category"]
          created_at: string
          id: string
          team_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["bracket_category"]
          created_at?: string
          id?: string
          team_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["bracket_category"]
          created_at?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          points_awarded: number
          predicted_outcome: Database["public"]["Enums"]["match_outcome"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          points_awarded?: number
          predicted_outcome: Database["public"]["Enums"]["match_outcome"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          points_awarded?: number
          predicted_outcome?: Database["public"]["Enums"]["match_outcome"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          created_at: string
          finished: boolean
          group_name: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff: string
          stage: Database["public"]["Enums"]["match_stage"]
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          finished?: boolean
          group_name?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff: string
          stage?: Database["public"]["Enums"]["match_stage"]
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          created_at?: string
          finished?: boolean
          group_name?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff?: string
          stage?: Database["public"]["Enums"]["match_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          predictions_locked_at: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          predictions_locked_at?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          predictions_locked_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          code: string
          created_at: string
          flag_emoji: string | null
          group_name: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          flag_emoji?: string | null
          group_name: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          flag_emoji?: string | null
          group_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      top_scorer_predictions: {
        Row: {
          created_at: string
          player_name: string
          points_awarded: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          player_name: string
          points_awarded?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          player_name?: string
          points_awarded?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournament_settings: {
        Row: {
          actual_top_scorer: string | null
          id: number
          updated_at: string
        }
        Insert: {
          actual_top_scorer?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          actual_top_scorer?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_scores: {
        Row: {
          bracket_points: number | null
          full_name: string | null
          match_points: number | null
          scorer_points: number | null
          total_points: number | null
          user_id: string | null
        }
        Insert: {
          bracket_points?: never
          full_name?: string | null
          match_points?: never
          scorer_points?: never
          total_points?: never
          user_id?: string | null
        }
        Update: {
          bracket_points?: never
          full_name?: string | null
          match_points?: never
          scorer_points?: never
          total_points?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bracket_points: {
        Args: { _cat: Database["public"]["Enums"]["bracket_category"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      predictions_locked: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      bracket_category:
        | "group_advance"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "final"
        | "champion"
      match_outcome: "home" | "draw" | "away"
      match_stage:
        | "group"
        | "round_of_32"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "final"
        | "third_place"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      bracket_category: [
        "group_advance",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "final",
        "champion",
      ],
      match_outcome: ["home", "draw", "away"],
      match_stage: [
        "group",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "final",
        "third_place",
      ],
    },
  },
} as const
