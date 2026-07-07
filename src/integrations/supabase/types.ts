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
      comment_message: {
        Row: {
          attachments: Json
          author_kind: Database["public"]["Enums"]["comment_author_kind"]
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          mentions: Json
          parent_message_id: string | null
          suggested_edit: Json | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          author_kind?: Database["public"]["Enums"]["comment_author_kind"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          mentions?: Json
          parent_message_id?: string | null
          suggested_edit?: Json | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          author_kind?: Database["public"]["Enums"]["comment_author_kind"]
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          mentions?: Json
          parent_message_id?: string | null
          suggested_edit?: Json | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_message_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "comment_message"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_message_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "comment_thread"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reaction: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reaction_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "comment_message"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_read_state: {
        Row: {
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          thread_id: string
          user_id?: string
        }
        Update: {
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_read_state_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "comment_thread"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_thread: {
        Row: {
          anchor_kind: Database["public"]["Enums"]["comment_anchor_kind"]
          anchor_ref: Json
          assignee_user_id: string | null
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          page_id: string | null
          priority: Database["public"]["Enums"]["comment_priority"]
          project_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["comment_status"]
          surface: Database["public"]["Enums"]["comment_surface"]
          updated_at: string
          version_label: string | null
          viewport: Json
          workspace_id: string
        }
        Insert: {
          anchor_kind?: Database["public"]["Enums"]["comment_anchor_kind"]
          anchor_ref?: Json
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_activity_at?: string
          page_id?: string | null
          priority?: Database["public"]["Enums"]["comment_priority"]
          project_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["comment_status"]
          surface?: Database["public"]["Enums"]["comment_surface"]
          updated_at?: string
          version_label?: string | null
          viewport?: Json
          workspace_id: string
        }
        Update: {
          anchor_kind?: Database["public"]["Enums"]["comment_anchor_kind"]
          anchor_ref?: Json
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_activity_at?: string
          page_id?: string | null
          priority?: Database["public"]["Enums"]["comment_priority"]
          project_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["comment_status"]
          surface?: Database["public"]["Enums"]["comment_surface"]
          updated_at?: string
          version_label?: string | null
          viewport?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_thread_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_thread_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      form: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_slug: string
          settings: Json
          slug: string
          status: string
          submit_action: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_slug: string
          settings?: Json
          slug: string
          status?: string
          submit_action?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_slug?: string
          settings?: Json
          slug?: string
          status?: string
          submit_action?: Json
          updated_at?: string
        }
        Relationships: []
      }
      form_field: {
        Row: {
          created_at: string
          form_id: string
          group_id: string | null
          help_text: string | null
          id: string
          kind: string
          label: string
          name: string
          options: Json
          placeholder: string | null
          position: number
          required: boolean
          validation: Json
          visibility: Json
        }
        Insert: {
          created_at?: string
          form_id: string
          group_id?: string | null
          help_text?: string | null
          id?: string
          kind: string
          label: string
          name: string
          options?: Json
          placeholder?: string | null
          position?: number
          required?: boolean
          validation?: Json
          visibility?: Json
        }
        Update: {
          created_at?: string
          form_id?: string
          group_id?: string | null
          help_text?: string | null
          id?: string
          kind?: string
          label?: string
          name?: string
          options?: Json
          placeholder?: string | null
          position?: number
          required?: boolean
          validation?: Json
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_field_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_field_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "form_field_group"
            referencedColumns: ["id"]
          },
        ]
      }
      form_field_group: {
        Row: {
          created_at: string
          form_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          label: string
          position?: number
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_field_group_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form"
            referencedColumns: ["id"]
          },
        ]
      }
      form_integration: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          form_id: string
          id: string
          kind: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          form_id: string
          id?: string
          kind: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          form_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_integration_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission: {
        Row: {
          data: Json
          form_id: string
          id: string
          ip_country: string | null
          source_page_id: string | null
          source_url: string | null
          spam_score: number
          status: string
          submitted_at: string
          user_agent: string | null
          utm: Json
        }
        Insert: {
          data?: Json
          form_id: string
          id?: string
          ip_country?: string | null
          source_page_id?: string | null
          source_url?: string | null
          spam_score?: number
          status?: string
          submitted_at?: string
          user_agent?: string | null
          utm?: Json
        }
        Update: {
          data?: Json
          form_id?: string
          id?: string
          ip_country?: string | null
          source_page_id?: string | null
          source_url?: string | null
          spam_score?: number
          status?: string
          submitted_at?: string
          user_agent?: string | null
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_note: {
        Row: {
          author: string | null
          body: string
          created_at: string
          id: string
          kind: string
          submission_id: string
        }
        Insert: {
          author?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: string
          submission_id: string
        }
        Update: {
          author?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_note_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submission"
            referencedColumns: ["id"]
          },
        ]
      }
      media_asset: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          favorite: boolean
          filename: string
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          optimized: boolean
          project_id: string
          size_bytes: number
          storage_path: string
          tags: string[]
          thumb_path: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          favorite?: boolean
          filename: string
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type: string
          optimized?: boolean
          project_id: string
          size_bytes?: number
          storage_path: string
          tags?: string[]
          thumb_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          favorite?: boolean
          filename?: string
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          optimized?: boolean
          project_id?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          thumb_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "media_folder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_asset_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folder: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          path: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          path: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folder_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_folder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folder_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
      page_form_usage: {
        Row: {
          block_id: string
          form_id: string
          page_id: string
          project_slug: string
        }
        Insert: {
          block_id: string
          form_id: string
          page_id: string
          project_slug: string
        }
        Update: {
          block_id?: string
          form_id?: string
          page_id?: string
          project_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_form_usage_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      project_member_access: {
        Row: {
          created_at: string
          id: string
          member_id: string
          project_slug: string
          role_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          project_slug: string
          role_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          project_slug?: string
          role_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_member_access_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_member"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_member_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workspace_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_member_access_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_integration: {
        Row: {
          config: Json
          connected_at: string | null
          created_at: string
          project_slug: string
          provider_id: string
          status: string
          updated_at: string
          workspace_slug: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          project_slug: string
          provider_id: string
          status?: string
          updated_at?: string
          workspace_slug: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          project_slug?: string
          provider_id?: string
          status?: string
          updated_at?: string
          workspace_slug?: string
        }
        Relationships: []
      }
      seo_keyword: {
        Row: {
          created_at: string
          difficulty: number | null
          id: string
          opportunity: string | null
          prev_rank: number | null
          project_slug: string
          rank: number | null
          term: string
          traffic: number | null
          trend: string | null
          updated_at: string
          workspace_slug: string
        }
        Insert: {
          created_at?: string
          difficulty?: number | null
          id?: string
          opportunity?: string | null
          prev_rank?: number | null
          project_slug: string
          rank?: number | null
          term: string
          traffic?: number | null
          trend?: string | null
          updated_at?: string
          workspace_slug: string
        }
        Update: {
          created_at?: string
          difficulty?: number | null
          id?: string
          opportunity?: string | null
          prev_rank?: number | null
          project_slug?: string
          rank?: number | null
          term?: string
          traffic?: number | null
          trend?: string | null
          updated_at?: string
          workspace_slug?: string
        }
        Relationships: []
      }
      seo_page: {
        Row: {
          aeo_breakdown: Json
          aeo_score: number | null
          ai_summary: string | null
          canonical: string | null
          created_at: string
          entities: Json
          faqs: Json
          id: string
          indexing: string
          key_takeaways: Json
          meta_description: string | null
          meta_title: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          page_id: string
          project_slug: string
          seo_score: number | null
          slug: string | null
          structured_data: string | null
          topics: Json
          twitter_image: string | null
          updated_at: string
          workspace_slug: string
        }
        Insert: {
          aeo_breakdown?: Json
          aeo_score?: number | null
          ai_summary?: string | null
          canonical?: string | null
          created_at?: string
          entities?: Json
          faqs?: Json
          id?: string
          indexing?: string
          key_takeaways?: Json
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_id: string
          project_slug: string
          seo_score?: number | null
          slug?: string | null
          structured_data?: string | null
          topics?: Json
          twitter_image?: string | null
          updated_at?: string
          workspace_slug: string
        }
        Update: {
          aeo_breakdown?: Json
          aeo_score?: number | null
          ai_summary?: string | null
          canonical?: string | null
          created_at?: string
          entities?: Json
          faqs?: Json
          id?: string
          indexing?: string
          key_takeaways?: Json
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          page_id?: string
          project_slug?: string
          seo_score?: number | null
          slug?: string | null
          structured_data?: string | null
          topics?: Json
          twitter_image?: string | null
          updated_at?: string
          workspace_slug?: string
        }
        Relationships: []
      }
      seo_page_version: {
        Row: {
          author_ref: string | null
          created_at: string
          id: string
          label: string | null
          page_id: string
          project_slug: string
          snapshot: Json
          version_num: number
          workspace_slug: string
        }
        Insert: {
          author_ref?: string | null
          created_at?: string
          id?: string
          label?: string | null
          page_id: string
          project_slug: string
          snapshot: Json
          version_num: number
          workspace_slug: string
        }
        Update: {
          author_ref?: string | null
          created_at?: string
          id?: string
          label?: string | null
          page_id?: string
          project_slug?: string
          snapshot?: Json
          version_num?: number
          workspace_slug?: string
        }
        Relationships: []
      }
      seo_project_settings: {
        Row: {
          created_at: string
          default_description: string | null
          default_og_image: string | null
          default_title: string | null
          default_twitter_handle: string | null
          ga_id: string | null
          plausible_domain: string | null
          project_slug: string
          robots_txt: string | null
          schema_jsonld: string | null
          updated_at: string
          workspace_slug: string
        }
        Insert: {
          created_at?: string
          default_description?: string | null
          default_og_image?: string | null
          default_title?: string | null
          default_twitter_handle?: string | null
          ga_id?: string | null
          plausible_domain?: string | null
          project_slug: string
          robots_txt?: string | null
          schema_jsonld?: string | null
          updated_at?: string
          workspace_slug: string
        }
        Update: {
          created_at?: string
          default_description?: string | null
          default_og_image?: string | null
          default_title?: string | null
          default_twitter_handle?: string | null
          ga_id?: string | null
          plausible_domain?: string | null
          project_slug?: string
          robots_txt?: string | null
          schema_jsonld?: string | null
          updated_at?: string
          workspace_slug?: string
        }
        Relationships: []
      }
      seo_redirect: {
        Row: {
          code: number
          created_at: string
          from_path: string
          id: string
          project_slug: string
          to_path: string
          updated_at: string
          workspace_slug: string
        }
        Insert: {
          code?: number
          created_at?: string
          from_path: string
          id?: string
          project_slug: string
          to_path: string
          updated_at?: string
          workspace_slug: string
        }
        Update: {
          code?: number
          created_at?: string
          from_path?: string
          id?: string
          project_slug?: string
          to_path?: string
          updated_at?: string
          workspace_slug?: string
        }
        Relationships: []
      }
      workspace: {
        Row: {
          accent_color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_user_ref: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_user_ref?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_user_ref?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_invitation: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by_user_ref: string | null
          project_slugs: string[]
          role_id: string | null
          status: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_user_ref?: string | null
          project_slugs?: string[]
          role_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_ref?: string | null
          project_slugs?: string[]
          role_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitation_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workspace_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invitation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_member: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          invited_at: string | null
          last_active_at: string | null
          name: string
          role_id: string | null
          status: string
          updated_at: string
          user_ref: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string | null
          last_active_at?: string | null
          name: string
          role_id?: string | null
          status?: string
          updated_at?: string
          user_ref: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string | null
          last_active_at?: string | null
          name?: string
          role_id?: string | null
          status?: string
          updated_at?: string
          user_ref?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workspace_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_member_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_role: {
        Row: {
          capabilities: Json
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          key: string
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          capabilities?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key: string
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          capabilities?: Json
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          key?: string
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_role_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_workspace_role: {
        Args: { _role_key: string; _user: string; _workspace: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      is_workspace_member_by_slug: {
        Args: { _slug: string; _user: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
    }
    Enums: {
      comment_anchor_kind: "page" | "block" | "field" | "selection" | "element"
      comment_author_kind: "user" | "ai" | "system"
      comment_priority: "none" | "low" | "medium" | "high" | "urgent"
      comment_status: "open" | "resolved"
      comment_surface:
        | "editor"
        | "preview"
        | "split"
        | "page"
        | "component"
        | "collection"
        | "media"
        | "seo"
        | "analytics"
        | "forms"
        | "settings"
        | "schema"
        | "navigation"
        | "template"
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
      comment_anchor_kind: ["page", "block", "field", "selection", "element"],
      comment_author_kind: ["user", "ai", "system"],
      comment_priority: ["none", "low", "medium", "high", "urgent"],
      comment_status: ["open", "resolved"],
      comment_surface: [
        "editor",
        "preview",
        "split",
        "page",
        "component",
        "collection",
        "media",
        "seo",
        "analytics",
        "forms",
        "settings",
        "schema",
        "navigation",
        "template",
      ],
    },
  },
} as const
