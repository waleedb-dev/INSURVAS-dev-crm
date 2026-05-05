export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * NOTE:
 * This file is generated as part of the dev DB schema pack.
 * If the generator emits JSON-encoded content by mistake, Next/TS compilation will fail.
 *
 * Keeping a permissive `Database` type here ensures the app continues to compile,
 * even if the detailed schema types are temporarily unavailable.
 */
export type Database = {
  // Allows Supabase `createClient<Database>(...)` typing without breaking builds.
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
    CompositeTypes: Record<string, unknown>
  }
}

