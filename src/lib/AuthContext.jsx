import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadEmployee = useCallback(async (uid) => {
    if (!uid) { setEmployee(null); setBranch(null); return }
    // Employee row (own row is always selectable via RLS).
    const { data: emp } = await supabase
      .from('employees')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    setEmployee(emp || null)

    if (emp?.branch_id) {
      const { data: br } = await supabase
        .from('branches')
        .select('*')
        .eq('id', emp.branch_id)
        .maybeSingle()
      setBranch(br || null)
    } else {
      setBranch(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadEmployee(data.session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, sess) => {
      setSession(sess)
      await loadEmployee(sess?.user?.id)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadEmployee])

  const refreshEmployee = useCallback(
    () => loadEmployee(session?.user?.id),
    [loadEmployee, session]
  )

  const role = employee?.role || null
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'

  // Permission resolution: admin has everything; flags grant upward.
  const can = {
    viewInventory: isAdmin || !!employee?.can_view_inventory,
    editInventory: isAdmin || !!employee?.can_edit_inventory,
    viewLedger: isAdmin || !!employee?.can_view_ledger,
    // Manager also gets inventory/ledger visibility per RLS.
    manageUsers: isAdmin,
    viewAnalytics: isAdmin || isManager,
  }
  // Managers can read inventory/vendors per RLS, reflect that in the UI gate.
  if (isManager) { can.viewInventory = true; can.viewLedger = true }

  const value = {
    session, employee, branch, loading, role, isAdmin, isManager, can,
    refreshEmployee,
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
