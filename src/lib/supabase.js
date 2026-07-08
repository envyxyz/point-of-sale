import { createClient } from '@supabase/supabase-js'

// These are the project URL + publishable (anon) key. Both are designed to
// ship in frontend code; all real protection comes from RLS policies in
// supabase_setup.sql. On Vercel/Netlify you can override via env vars:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mhnpiupimkcmrougfabb.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_XI-0J6-I4VXb5yP5PLfTJA_zgANrVmR'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Build a public URL for a product image stored in the product-images bucket.
export function productImageUrl(imagePath) {
  if (!imagePath) return null
  const { data } = supabase.storage.from('product-images').getPublicUrl(imagePath)
  return data?.publicUrl || null
}
