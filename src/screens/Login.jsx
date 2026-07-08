import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    // On success, AuthContext's onAuthStateChange takes over routing.
  }

  return (
    <div className="auth">
      <div className="auth__brand">
        <div>
          <span className="tag">Moon Ladder House</span>
          <h1 style={{ marginTop: 18 }}>Point of Sale &amp; Inventory</h1>
        </div>
        <p>
          Batch-level cost pricing, image-tap selling, and branch analytics —
          built to replace the old Shopify register.
        </p>
      </div>

      <div className="auth__form-wrap">
        <form className="auth__form" onSubmit={submit}>
          <h2>Sign in</h2>
          <p>Use the credentials from your administrator.</p>

          {err && <div className="alert alert--err">{err}</div>}

          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn--amber btn--block btn--lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
