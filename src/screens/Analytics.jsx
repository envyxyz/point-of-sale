import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { money, pct, num, currentWeekRange, currentMonthRange } from '../lib/format'
import { PageLoad, Empty } from '../components/ui'

// Compute the four headline metrics from a set of sale rows (v_sale_profit).
// Formulas per spec section 4:
//   revenue = Σ SP*Q over non-returned
//   profit  = Σ (SP-CP)*Q over non-returned
//   margin  = profit / revenue * 100 (revenue-weighted; NOT avg of line %)
//   return rate = units returned in period / units sold gross in period * 100
function computeMetrics(rows, range) {
  const start = new Date(range.start).getTime()
  const end = new Date(range.end).getTime()

  let revenue = 0, cost = 0, unitsGross = 0, unitsReturned = 0

  for (const r of rows) {
    const soldMs = new Date(r.sold_at).getTime()
    const soldIn = soldMs >= start && soldMs < end
    const q = Number(r.quantity)

    // Units sold gross: everything sold in the period, returned or not.
    if (soldIn) {
      unitsGross += q
      if (!r.is_returned) {
        revenue += Number(r.sale_price) * q
        cost += Number(r.cost_price_at_sale) * q
      }
    }

    // Units returned: counted by returned_at falling in the period.
    if (r.is_returned && r.returned_at) {
      const retMs = new Date(r.returned_at).getTime()
      if (retMs >= start && retMs < end) unitsReturned += q
    }
  }

  const profit = revenue - cost
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0
  const returnRate = unitsGross > 0 ? (unitsReturned / unitsGross) * 100 : 0

  return { revenue, profit, margin, returnRate, unitsGross, unitsReturned }
}

function StatCard({ label, value, sub, tone }) {
  const cls = tone === 'profit' ? 'stat stat--profit' : tone === 'loss' ? 'stat stat--loss' : 'stat'
  return (
    <div className={cls}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  )
}

function CardRow({ m }) {
  return (
    <div className="stat-grid">
      <StatCard label="Revenue" value={money(m.revenue)} sub={`${num(m.unitsGross)} units sold`} />
      <StatCard label="Profit" value={money(m.profit)} tone={m.profit >= 0 ? 'profit' : 'loss'} sub="revenue − cost" />
      <StatCard label="Avg margin" value={pct(m.margin)} sub="revenue-weighted" />
      <StatCard
        label="Return rate"
        value={pct(m.returnRate)}
        tone={m.returnRate > 0 ? 'loss' : undefined}
        sub={`${num(m.unitsReturned)} of ${num(m.unitsGross)} units`}
      />
    </div>
  )
}

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState(null)
  const [month, setMonth] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)

    const weekR = currentWeekRange()
    const monthR = currentMonthRange()

    // Pull the union of rows we need: anything sold OR returned in the month
    // window (month is the widest here since week ⊂ current month is not
    // guaranteed at month edges — so query from min(week.start, month.start)).
    const lo = new Date(Math.min(new Date(weekR.start), new Date(monthR.start))).toISOString()
    const hi = new Date(Math.max(new Date(weekR.end), new Date(monthR.end))).toISOString()

    // v_sale_profit inherits RLS: admin sees all, manager sees own branch.
    // We fetch by sold_at OR returned_at within the window using two queries
    // and merge, since PostgREST 'or' across ranges is awkward.
    const [{ data: bySold, error: e1 }, { data: byRet, error: e2 }] = await Promise.all([
      supabase.from('v_sale_profit')
        .select('id, sale_price, cost_price_at_sale, quantity, sold_at, is_returned, returned_at')
        .gte('sold_at', lo).lt('sold_at', hi),
      supabase.from('v_sale_profit')
        .select('id, sale_price, cost_price_at_sale, quantity, sold_at, is_returned, returned_at')
        .eq('is_returned', true).gte('returned_at', lo).lt('returned_at', hi),
    ])

    if (e1 || e2) { setErr((e1 || e2).message); setLoading(false); return }

    // Merge unique by id.
    const map = new Map()
    for (const r of [...(bySold || []), ...(byRet || [])]) map.set(r.id, r)
    const rows = [...map.values()]

    setWeek(computeMetrics(rows, weekR))
    setMonth(computeMetrics(rows, monthR))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLoad label="Crunching numbers…" />

  if (err) {
    return (
      <div className="card"><div className="card__pad">
        <div className="alert alert--err">{err}</div>
        <Empty title="Couldn't load analytics">
          You may not have permission to view sales across branches.
        </Empty>
      </div></div>
    )
  }

  const noData = week.unitsGross === 0 && month.unitsGross === 0

  return (
    <>
      {noData && (
        <div className="alert alert--info">
          No sales recorded in the current week or month yet. Cards will populate as sales are logged.
        </div>
      )}

      <div className="stat-section-label">This week</div>
      <CardRow m={week} />

      <div className="stat-section-label">This month</div>
      <CardRow m={month} />

      <p className="muted" style={{ marginTop: 22, fontSize: 12.5 }}>
        Periods use the Asia/Karachi calendar. Week starts Monday. Returned sales
        are excluded from revenue and profit and counted only in the return rate.
      </p>
    </>
  )
}
