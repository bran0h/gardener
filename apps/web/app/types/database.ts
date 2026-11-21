import type { CareLog, Plant, PushSubscriptionRow } from './plant'

/**
 * The slice of the shared Supabase schema this app touches.
 * Hand-written instead of generated: the project holds many other apps' tables.
 */
export type Database = {
  public: {
    Tables: {
      gardener_plants: {
        Row: Plant
        Insert: Partial<Plant> & Pick<Plant, 'name'>
        Update: Partial<Plant>
        Relationships: []
      }
      gardener_care_logs: {
        Row: CareLog
        Insert: Partial<CareLog> & Pick<CareLog, 'plant_id' | 'kind'>
        Update: Partial<CareLog>
        Relationships: [
          {
            foreignKeyName: 'gardener_care_logs_plant_id_fkey'
            columns: ['plant_id']
            isOneToOne: false
            referencedRelation: 'gardener_plants'
            referencedColumns: ['id']
          }
        ]
      }
      gardener_push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>
          & Partial<Pick<PushSubscriptionRow, 'remind_hour' | 'timezone' | 'user_agent'>>
        Update: Partial<Pick<PushSubscriptionRow, 'p256dh' | 'auth' | 'remind_hour' | 'timezone' | 'user_agent'>>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: {
        Args: { role_name: string }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
