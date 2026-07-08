import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Icon } from './ui'

function LadderMark() {
  // Small ladder glyph used as the brand logo.
  return (
    <svg className="rail__logo" viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="8" fill="#24363F" />
      <path d="M14 8v24M26 8v24M14 14h12M14 20h12M14 26h12"
        stroke="#E8A33D" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export default function Shell() {
  const { employee, branch, role, can, signOut } = useAuth()
  const loc = useLocation()

  const links = [
    { to: '/pos', label: 'Point of Sale', icon: Icon.pos, show: true },
    { to: '/inventory', label: 'Inventory & Batches', icon: Icon.box, show: can.viewInventory },
    { to: '/analytics', label: 'Analytics', icon: Icon.chart, show: can.viewAnalytics },
    { to: '/users', label: 'Users & Permissions', icon: Icon.users, show: can.manageUsers },
  ].filter((l) => l.show)

  const active = links.find((l) => loc.pathname.startsWith(l.to))

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__brand">
          <LadderMark />
          <div className="rail__brand-text">
            <b>Moon Ladder</b>
            <span>House POS</span>
          </div>
        </div>
        <hr className="rung" style={{ margin: '0 16px' }} />

        <nav className="rail__nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `rail__link ${isActive ? 'is-active' : ''}`}
            >
              <l.icon />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="rail__foot">
          <div className="rail__who">{employee?.full_name}</div>
          <div style={{ marginTop: 4 }}>
            <span className="rail__role">{role}</span>
          </div>
          {branch && (
            <div className="muted" style={{ color: '#8FA0A9', marginTop: 8, fontSize: 12 }}>
              {branch.name}
            </div>
          )}
          <button className="rail__signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <div className="topbar__title">
            <h1>{active?.label || 'Moon Ladder House'}</h1>
          </div>
        </div>
        <hr className="rung rung--muted" style={{ margin: '16px 32px 0' }} />
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
