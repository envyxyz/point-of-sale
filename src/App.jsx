import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { PageLoad } from './components/ui'
import Shell from './components/Shell'
import Login from './screens/Login'
import POS from './screens/POS'
import Inventory from './screens/Inventory'
import Analytics from './screens/Analytics'
import Users from './screens/Users'
import { supabase } from './lib/supabase'

// Shown when an authenticated auth.user has no matching employees row
// (edge case: created outside the invite flow / trigger not yet run).
function NoRecord() {
  const { session, signOut } = useAuth()
  return (
    <div className="auth">
      <div className="auth__brand">
        <div><span className="tag">Moon Ladder House</span><h1 style={{ marginTop: 18 }}>Almost there</h1></div>
        <p>Your login exists but hasn't been linked to an employee profile yet.</p>
      </div>
      <div className="auth__form-wrap">
        <div className="auth__form">
          <h2>No employee profile</h2>
          <p>
            You're signed in as <b>{session?.user?.email}</b>, but there's no
            employee record for this account. Ask an administrator to invite you,
            or if you're setting up the system, create your profile row and set it
            to <b>admin</b> in Supabase.
          </p>
          <div className="alert alert--info" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
{`-- Run in Supabase SQL editor:
insert into public.employees (id, full_name, role,
  can_view_inventory, can_edit_inventory, can_view_ledger)
values ('${session?.user?.id || 'YOUR-AUTH-UID'}',
  'Your Name', 'admin', true, true, true)
on conflict (id) do update set role='admin';`}
          </div>
          <button className="btn btn--ghost btn--block" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  )
}

function Gate() {
  const { session, employee, loading, isAdmin, isManager, can } = useAuth()

  if (loading) return <PageLoad label="Starting up…" />
  if (!session) return <Login />
  if (!employee) return <NoRecord />

  // If the account is disabled, block access.
  if (!employee.is_active) {
    return (
      <div className="auth">
        <div className="auth__brand"><div><span className="tag">Moon Ladder House</span><h1 style={{ marginTop: 18 }}>Access disabled</h1></div><p>Your account has been deactivated.</p></div>
        <div className="auth__form-wrap"><div className="auth__form">
          <h2>Account disabled</h2>
          <p>This account has been deactivated by an administrator. Contact them to restore access.</p>
          <button className="btn btn--ghost btn--block" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div></div>
      </div>
    )
  }

  // Default landing per role: staff to POS, admins to analytics.
  const home = isAdmin ? '/analytics' : '/pos'

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/pos" element={<POS />} />
        {can.viewInventory && <Route path="/inventory" element={<Inventory />} />}
        {(isAdmin || isManager) && <Route path="/analytics" element={<Analytics />} />}
        {isAdmin && <Route path="/users" element={<Users />} />}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
