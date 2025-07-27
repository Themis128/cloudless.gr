// Database types for Prisma
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: number
          project_name: string
          slug: string
          overview: string
          description: string
          isFavorite: boolean
          live_url: string
          github_url: string
          status: string
          category: string
          featured: boolean
          completionDate: string
          createdAt: Date
          updatedAt: Date
          images: Json
        }
        Insert: {
          id?: number
          project_name: string
          slug: string
          overview: string
          description: string
          isFavorite?: boolean
          live_url: string
          github_url: string
          status?: string
          category: string
          featured?: boolean
          completionDate: string
          createdAt?: Date
          updatedAt?: Date
          images?: Json
        }
        Update: {
          id?: number
          project_name?: string
          slug?: string
          overview?: string
          description?: string
          isFavorite?: boolean
          live_url?: string
          github_url?: string
          status?: string
          category?: string
          featured?: boolean
          completionDate?: string
          createdAt?: Date
          updatedAt?: Date
          images?: Json
        }
      }
      project_tags: {
        Row: {
          id: number
          name: string
          color: string | null
          createdAt: Date
          updatedAt: Date
          primary: boolean
        }
        Insert: {
          id?: number
          name: string
          color?: string | null
          createdAt?: Date
          updatedAt?: Date
          primary?: boolean
        }
        Update: {
          id?: number
          name?: string
          color?: string | null
          createdAt?: Date
          updatedAt?: Date
          primary?: boolean
        }
      }
    }
  }
}
