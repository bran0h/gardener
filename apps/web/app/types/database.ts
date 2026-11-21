import type {
  CareLog, HomeInvite, HomeMemberRow, HomePerson, HomeRow, InvitePreview, Plant, PushSubscriptionRow
} from './plant'

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
      gardener_homes: {
        Row: HomeRow
        Insert: never
        Update: Pick<HomeRow, 'name'>
        Relationships: []
      }
      gardener_home_members: {
        Row: HomeMemberRow
        Insert: never
        Update: Pick<HomeMemberRow, 'role'>
        Relationships: []
      }
      gardener_home_invites: {
        Row: HomeInvite
        Insert: Pick<HomeInvite, 'home_id'>
        Update: never
        Relationships: []
      }
      gardener_push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>
          & Partial<Pick<PushSubscriptionRow, 'remind_hour' | 'timezone' | 'locale' | 'user_agent'>>
        Update: Partial<Pick<PushSubscriptionRow, 'p256dh' | 'auth' | 'remind_hour' | 'timezone' | 'locale' | 'user_agent'>>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: {
        Args: { role_name: string }
        Returns: boolean
      }
      gardener_ensure_home: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      gardener_create_home: {
        Args: { home_name: string }
        Returns: HomeRow
      }
      gardener_home_people: {
        Args: { home: string }
        Returns: HomePerson[]
      }
      gardener_invite_preview: {
        Args: { invite_token: string }
        Returns: InvitePreview[]
      }
      gardener_accept_invite: {
        Args: { invite_token: string }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
