import { useEffect } from 'react'

// ---- Inline icon set (stroke, currentColor) ----------------------------
const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const Icon = {
  pos: (props) => (
    <svg viewBox="0 0 24 24" {...props}><rect x="3" y="4" width="18" height="14" rx="2" {...p} /><path d="M3 9h18M8 18v2M16 18v2M7 22h10" {...p} /></svg>
  ),
  box: (props) => (
    <svg viewBox="0 0 24 24" {...props}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" {...p} /><path d="m3 8 9 5 9-5M12 13v8" {...p} /></svg>
  ),
  chart: (props) => (
    <svg viewBox="0 0 24 24" {...props}><path d="M4 4v16h16" {...p} /><path d="M8 14v3M12 10v7M16 6v11" {...p} /></svg>
  ),
  users: (props) => (
    <svg viewBox="0 0 24 24" {...props}><circle cx="9" cy="8" r="3.2" {...p} /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 5.6M20.5 20a5 5 0 0 0-3.2-4.6" {...p} /></svg>
  ),
  ladder: (props) => (
    <svg viewBox="0 0 24 24" {...props}><path d="M7 2v20M17 2v20M7 6h10M7 11h10M7 16h10" {...p} /></svg>
  ),
  plus: (props) => (<svg viewBox="0 0 24 24" {...props}><path d="M12 5v14M5 12h14" {...p} /></svg>),
  check: (props) => (<svg viewBox="0 0 24 24" {...props}><path d="m5 13 4 4L19 7" {...p} /></svg>),
  lock: (props) => (<svg viewBox="0 0 24 24" {...props}><rect x="5" y="11" width="14" height="9" rx="2" {...p} /><path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></svg>),
  edit: (props) => (<svg viewBox="0 0 24 24" {...props}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" {...p} /></svg>),
  copy: (props) => (<svg viewBox="0 0 24 24" {...props}><rect x="9" y="9" width="12" height="12" rx="2" {...p} /><path d="M5 15V5a2 2 0 0 1 2-2h10" {...p} /></svg>),
  alert: (props) => (<svg viewBox="0 0 24 24" {...props}><path d="M12 3 2 20h20L12 3ZM12 9v5M12 17.5v.5" {...p} /></svg>),
}

// ---- Toast --------------------------------------------------------------
export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, toast.ms || 2600)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  const cls = toast.kind === 'err' ? 'toast--err' : toast.kind === 'ok' ? 'toast--ok' : ''
  return (
    <div className={`toast ${cls}`} role="status">
      {toast.kind === 'ok' && <Icon.check style={{ width: 18, height: 18 }} />}
      {toast.kind === 'err' && <Icon.alert style={{ width: 18, height: 18 }} />}
      {toast.msg}
    </div>
  )
}

// ---- Modal --------------------------------------------------------------
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="modal__x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <hr className="rung rung--muted" />
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

export function Spinner() { return <div className="spinner" /> }

export function PageLoad({ label = 'Loading…' }) {
  return <div className="center-load"><Spinner /><span>{label}</span></div>
}

export function Empty({ title, children }) {
  return <div className="empty"><h3>{title}</h3><p>{children}</p></div>
}

export function RoleBadge({ role }) {
  return <span className={`badge badge--${role}`}>{role}</span>
}
