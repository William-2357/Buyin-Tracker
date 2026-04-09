import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML = `
    <div style="font-family:monospace;padding:2rem;color:#f87171;background:#0f0f0f;min-height:100vh">
      <h2 style="color:#fbbf24">⚠ Missing Supabase credentials</h2>
      <p>Create a <strong>.env.local</strong> file in the project root:</p>
      <pre style="background:#1f1f1f;padding:1rem;border-radius:8px;margin-top:1rem">
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key</pre>
      <p style="margin-top:1rem;color:#9ca3af">Find these in your Supabase project → Settings → API (use the <strong>publishable</strong> key)</p>
      <p style="margin-top:0.5rem;color:#9ca3af">Then restart the dev server: <code style="color:#a78bfa">npm run dev</code></p>
    </div>
  `
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
