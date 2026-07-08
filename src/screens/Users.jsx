import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmtDate } from '../lib/format'
import { Icon, Toast, Modal, PageLoad, Empty, RoleBadge } from '../components/ui'

const PERMS = [
  { key: 'can_view_inventory', label: 'View inventory', hint: 'See products, batches, stock' },
  { key: 'can_edit_inventory', label: 'Edit inventory', hint: 'Add/edit products, batches, images' },
  { key: 'can_view_ledger', label: 'View ledger', hint: 'See vendors and transactions' },
]

export default function Users() {
  const { employee: me } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [branches, setBranches] = useState([])
  const [toast, setToast] = useState(null)
  const [editModal, setEditModal] = useState(null)   // employee row
  const [createModal, setCreateModal] = useState(false)

  const load = useCallback(async () => {
    const { data: emps } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: true })
    setRows(emps || [])
    const { data: brs } = await supabase.from('branches').select('*').order('name')
    setBranches(brs || [])
  }, [])

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false) })()
  }, [load])

  const branchName = (id) => branches.find((b) => b.id === id)?.name || '—'

  if (loading) return <PageLoad label="Loading users…" />

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__left">
          <span className="muted">{rows.length} users</span>
          {branches.length === 0 && (
            <span className="alert alert--warn" style={{ margin: 0, padding: '5px 10px' }}>
              No branches exist yet — create one below before assigning staff.
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--ghost" onClick={() => setCreateModal('branch')}>
            <Icon.plus style={{ width: 16, height: 16 }} /> Add branch
          </button>
          <button className="btn btn--amber" onClick={() => setCreateModal('user')}>
            <Icon.plus style={{ width: 16, height: 16 }} /> Invite user
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="card__pad"><Empty title="No users">Invite your first user to begin.</Empty></div></div>
      ) : (
        <div className="card"><div className="card__pad" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Permissions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const flags = PERMS.filter((p) => r[p.key]).map((p) => p.label.replace('View ', 'V:').replace('Edit ', 'E:'))
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.full_name}</div>
                      {r.id === me?.id && <span className="muted" style={{ fontSize: 12 }}>you</span>}
                    </td>
                    <td><RoleBadge role={r.role} /></td>
                    <td>{r.role === 'admin' ? <span className="muted">All branches</span> : branchName(r.branch_id)}</td>
                    <td>
                      {r.role === 'admin'
                        ? <span className="muted" style={{ fontSize: 13 }}>Full access</span>
                        : flags.length
                          ? <span className="mono" style={{ fontSize: 12 }}>{flags.join('  ')}</span>
                          : <span className="muted" style={{ fontSize: 13 }}>Sell only</span>}
                    </td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge--on' : 'badge--off'}`}>
                        {r.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="right">
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditModal(r)}>
                        <Icon.edit style={{ width: 14, height: 14 }} /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div></div>
      )}

      {editModal && (
        <EditUserModal
          row={editModal}
          branches={branches}
          isSelf={editModal.id === me?.id}
          onClose={() => setEditModal(null)}
          onSaved={async (msg) => { setEditModal(null); setToast({ kind: 'ok', msg }); await load() }}
          onError={(msg) => setToast({ kind: 'err', msg })}
        />
      )}

      {createModal === 'user' && (
        <CreateUserModal
          branches={branches}
          onClose={() => setCreateModal(false)}
          onSaved={async (msg) => { setCreateModal(false); setToast({ kind: 'ok', msg, ms: 5000 }); await load() }}
          onError={(msg) => setToast({ kind: 'err', msg })}
        />
      )}

      {createModal === 'branch' && (
        <CreateBranchModal
          onClose={() => setCreateModal(false)}
          onSaved={async (msg) => { setCreateModal(false); setToast({ kind: 'ok', msg }); await load() }}
          onError={(msg) => setToast({ kind: 'err', msg })}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}

// ---- Edit user (role, branch, flags, active) --------------------------
function EditUserModal({ row, branches, isSelf, onClose, onSaved, onError }) {
  const [role, setRole] = useState(row.role)
  const [branchId, setBranchId] = useState(row.branch_id || '')
  const [flags, setFlags] = useState({
    can_view_inventory: row.can_view_inventory,
    can_edit_inventory: row.can_edit_inventory,
    can_view_ledger: row.can_view_ledger,
  })
  const [isActive, setIsActive] = useState(row.is_active)
  const [busy, setBusy] = useState(false)

  const needsBranch = role === 'manager' || role === 'salesman'

  async function save(e) {
    e.preventDefault()
    if (needsBranch && !branchId) { onError('Managers and salesmen must have a branch.'); return }
    setBusy(true)
    try {
      const payload = {
        role,
        branch_id: role === 'admin' ? (branchId || null) : branchId,
        ...flags,
        is_active: isActive,
      }
      const { error } = await supabase.from('employees').update(payload).eq('id', row.id)
      if (error) throw error
      onSaved('User updated')
    } catch (err) {
      onError(err.message || 'Could not update user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Edit — ${row.full_name}`} onClose={onClose}>
      <form onSubmit={save}>
        {isSelf && (
          <div className="alert alert--warn">
            You're editing your own account. Removing your admin role or disabling
            yourself will lock you out.
          </div>
        )}
        <div className="row">
          <div className="field">
            <label>Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="salesman">Salesman</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label>Branch {needsBranch && <span style={{ color: 'var(--loss)' }}>*</span>}</label>
            <select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{role === 'admin' ? 'All branches' : 'Select branch…'}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '8px 0 4px' }}>
          Permissions
        </label>
        {role === 'admin' ? (
          <p className="muted" style={{ fontSize: 13.5 }}>Admins have full access to everything; individual flags don't apply.</p>
        ) : (
          PERMS.map((p) => (
            <div className="checkline" key={p.key}>
              <input
                id={`f-${p.key}`}
                type="checkbox"
                checked={flags[p.key]}
                onChange={(e) => setFlags((f) => ({ ...f, [p.key]: e.target.checked }))}
              />
              <label htmlFor={`f-${p.key}`}>{p.label}</label>
              <span className="hint">{p.hint}</span>
            </div>
          ))
        )}

        <hr className="rung rung--muted" style={{ margin: '14px 0' }} />

        <div className="checkline">
          <input id="active-e" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <label htmlFor="active-e">Active — can sign in and act</label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn--ghost btn--block" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--amber btn--block" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Create user ------------------------------------------------------
// With only the publishable/anon key we can't call the Auth admin invite API.
// Instead we sign the user up (email + password) on a throwaway client so the
// current admin's session is not replaced, passing role/branch/flags as user
// metadata. The DB trigger handle_new_user() reads that metadata to create the
// matching employees row. The admin shares the credentials with the new user.
function CreateUserModal({ branches, onClose, onSaved, onError }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('salesman')
  const [branchId, setBranchId] = useState('')
  const [flags, setFlags] = useState({ can_view_inventory: false, can_edit_inventory: false, can_view_ledger: false })
  const [busy, setBusy] = useState(false)

  const needsBranch = role === 'manager' || role === 'salesman'

  async function save(e) {
    e.preventDefault()
    if (needsBranch && !branchId) { onError('Managers and salesmen need a branch.'); return }
    if (password.length < 6) { onError('Password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      // Throwaway client => signUp won't clobber the admin's own session.
      const tmp = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      )
      const { data, error } = await tmp.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            branch_id: role === 'admin' ? (branchId || null) : branchId,
            can_view_inventory: flags.can_view_inventory,
            can_edit_inventory: flags.can_edit_inventory,
            can_view_ledger: flags.can_view_ledger,
          },
        },
      })
      if (error) throw error

      // The trigger creates the employees row from metadata. If the project has
      // "confirm email" enabled, the user must confirm before first login; the
      // employees row still exists so admin management works immediately.
      const note = data.user && !data.session
        ? 'User created. They may need to confirm their email before signing in.'
        : 'User created and ready to sign in.'
      onSaved(note)
    } catch (err) {
      onError(err.message || 'Could not create user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Invite user" onClose={onClose}>
      <form onSubmit={save}>
        <div className="alert alert--info">
          Set an initial email and password here, then share them with the new
          user. Their role, branch, and permissions are applied automatically.
        </div>
        <div className="field">
          <label>Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="row">
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Temporary password</label>
            <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="min 6 chars" />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Role</label>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="salesman">Salesman</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label>Branch {needsBranch && <span style={{ color: 'var(--loss)' }}>*</span>}</label>
            <select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{role === 'admin' ? 'All branches' : 'Select branch…'}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {role !== 'admin' && (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--slate-500)', margin: '8px 0 4px' }}>
              Permissions
            </label>
            {PERMS.map((p) => (
              <div className="checkline" key={p.key}>
                <input id={`c-${p.key}`} type="checkbox" checked={flags[p.key]}
                  onChange={(e) => setFlags((f) => ({ ...f, [p.key]: e.target.checked }))} />
                <label htmlFor={`c-${p.key}`}>{p.label}</label>
                <span className="hint">{p.hint}</span>
              </div>
            ))}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn--ghost btn--block" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--amber btn--block" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Create branch ----------------------------------------------------
function CreateBranchModal({ onClose, onSaved, onError }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.from('branches').insert({
        name: name.trim(),
        address: address.trim() || null,
      })
      if (error) throw error
      onSaved('Branch created')
    } catch (err) {
      onError(err.message || 'Could not create branch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add branch" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Branch name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. Lahore Main" />
        </div>
        <div className="field">
          <label>Address (optional)</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn--ghost btn--block" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--amber btn--block" disabled={busy}>{busy ? 'Saving…' : 'Create branch'}</button>
        </div>
      </form>
    </Modal>
  )
}
