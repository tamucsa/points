export interface GoogleUser {
  id: string
  email: string
  user_metadata: {
    full_name: string
    avatar_url: string
    given_name?: string
    family_name?: string
  }
}