import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, productImageUrl } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { money, fmtTime, isToday } from '../lib/format'
import { Icon, Toast, PageLoad, Empty } from '../components/ui'

export default function POS() {
  const { employee, branch, can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])        // active products
  const [priceMap, setPriceMap] = useState({})         // product_id -> {batch_id, suggested, image_path}
  const [stockMap, setStockMap] = useState({})         // product_id -> available (best effort)
  const [selected, setSelected] = useState(null)       // product object
  const [salePrice, setSalePrice] = useState('')
  const [qty, setQty] = useState(1)
  const [costOverride, setCostOverride] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sales, setSales] = useState([])
  const [toast, setToast] = useState(null)

  const loadSales = useCallback(async () => {
    // Own sales (RLS restricts to salesman_id = auth.uid()).
    const { data } = await supabase
      .from('sales')
      .select('id, product_id, quantity, sale_price, currency, is_returned, sold_at')
      .order('sold_at', { ascending: false })
      .limit(60)
    setSales(data || [])
  }, [])

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    // Products are readable by any authenticated user (no cost exposed).
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, sku, image_path, default_margin_pct')
      .eq('is_active', true)
      .order('name')
    const list = prods || []
    setProducts(list)

    // For each product, ask the restricted RPC for batch_id + suggested price.
    // (Salesmen cannot read batches directly; this is the only price path.)
    const entries = await Promise.all(
      list.map(async (pr) => {
        const { data, error } = await supabase.rpc('rpc_pos_price', { p_product_id: pr.id })
        if (error || !data || !data.length) return [pr.id, null]
        const r = data[0]
        return [pr.id, {
          batch_id: r.batch_id,
          suggested: Number(r.suggested_sale_price),
          image_path: r.image_path,
          product_name: r.product_name,
        }]
      })
    )
    setPriceMap(Object.fromEntries(entries))

    // Stock is best-effort: v_product_stock inherits RLS, so a plain salesman
    // (no view_inventory) will get nothing here — that's fine, we just hide it.
    const { data: stock } = await supabase
      .from('v_product_stock')
      .select('product_id, quantity_available')
    if (stock) {
      setStockMap(Object.fromEntries(stock.map((s) => [s.product_id, Number(s.quantity_available)])))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCatalog(); loadSales() }, [loadCatalog, loadSales])

  function pick(pr) {
    const info = priceMap[pr.id]
    setSelected(pr)
    setSalePrice(info?.suggested != null ? String(info.suggested) : '')
    setQty(1)
    setCostOverride('')
  }

  const lineTotal = useMemo(() => {
    const sp = parseFloat(salePrice)
    if (isNaN(sp)) return 0
    return sp * qty
  }, [salePrice, qty])

  async function confirmSale() {
    if (!selected) return
    const info = priceMap[selected.id]
    if (!info?.batch_id) {
      setToast({ kind: 'err', msg: 'No batch available for this product yet.' })
      return
    }
    const sp = parseFloat(salePrice)
    if (isNaN(sp) || sp < 0) {
      setToast({ kind: 'err', msg: 'Enter a valid sale price.' })
      return
    }
    setConfirming(true)
    const params = {
      p_batch_id: info.batch_id,
      p_quantity: qty,
      p_sale_price: sp,
    }
    // Override only sent when the field is shown (view_inventory) and filled.
    if (can.viewInventory && costOverride !== '' && !isNaN(parseFloat(costOverride))) {
      params.p_cost_price_override = parseFloat(costOverride)
    }
    const { error } = await supabase.rpc('rpc_log_sale', params)
    setConfirming(false)
    if (error) {
      setToast({ kind: 'err', msg: error.message })
      return
    }
    setToast({ kind: 'ok', msg: `Sale logged — ${money(lineTotal, selected.currency || 'PKR')}` })
    setSelected(null)
    setSalePrice(''); setQty(1); setCostOverride('')
    loadSales()
  }

  const todaySales = sales.filter((s) => isToday(s.sold_at))
  const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]))

  if (loading) return <PageLoad label="Loading catalog…" />

  return (
    <>
      <div className="pos">
        {/* Product grid ------------------------------------------------ */}
        <div>
          {products.length === 0 ? (
            <div className="card"><div className="card__pad">
              <Empty title="No products yet">
                An administrator needs to add products and batches on the
                Inventory screen before you can sell.
              </Empty>
            </div></div>
          ) : (
            <div className="pos__grid">
              {products.map((pr) => {
                const info = priceMap[pr.id]
                const img = productImageUrl(info?.image_path || pr.image_path)
                const stock = stockMap[pr.id]
                const low = stock != null && stock <= 5
                return (
                  <button
                    key={pr.id}
                    className={`tile ${selected?.id === pr.id ? 'is-selected' : ''}`}
                    onClick={() => pick(pr)}
                  >
                    <div className="tile__img">
                      {img ? <img src={img} alt={pr.name} />
                           : <Icon.ladder className="ph" style={{ width: 40, height: 40 }} />}
                    </div>
                    <div className="tile__body">
                      <div className="tile__name">{pr.name}</div>
                      <div className="tile__price">
                        {info?.suggested != null ? money(info.suggested) : '—'}
                      </div>
                      {stock != null && (
                        <div className={`tile__stock ${low ? 'low' : ''}`}>
                          {stock} in stock
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Today's sales (own) -------------------------------------- */}
          <div className="recent card" style={{ marginTop: 20 }}>
            <div className="card__pad">
              <h3>Your sales today</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                {todaySales.length} {todaySales.length === 1 ? 'sale' : 'sales'} ·{' '}
                {money(
                  todaySales.filter((s) => !s.is_returned)
                    .reduce((a, s) => a + Number(s.sale_price) * s.quantity, 0)
                )}
              </p>
              {todaySales.length === 0 ? (
                <p className="muted" style={{ marginTop: 14 }}>No sales logged yet today.</p>
              ) : (
                <div className="recent__list">
                  {todaySales.map((s) => (
                    <div key={s.id} className={`recent__item ${s.is_returned ? 'ret' : ''}`}>
                      <div>
                        <div>{nameById[s.product_id] || 'Product'}{s.quantity > 1 ? ` ×${s.quantity}` : ''}</div>
                        <div className="t">{fmtTime(s.sold_at)}{s.is_returned ? ' · returned' : ''}</div>
                      </div>
                      <div className="p">{money(Number(s.sale_price) * s.quantity, s.currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sale panel -------------------------------------------------- */}
        <div className="panel">
          <div className="panel__head">
            <h3>New sale</h3>
            <div className="branch">{branch?.name || 'No branch assigned'}</div>
          </div>

          {!selected ? (
            <div className="panel__empty">
              <Icon.pos style={{ width: 34, height: 34, color: 'var(--slate-400)' }} />
              <p style={{ marginTop: 10 }}>Tap a product to start a sale.</p>
            </div>
          ) : (
            <div className="panel__body">
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--steel)' }}>
                {selected.name}
              </div>
              {selected.sku && <div className="muted mono" style={{ fontSize: 12 }}>{selected.sku}</div>}

              <hr className="rung rung--muted" style={{ margin: '14px 0' }} />

              <div className="field">
                <label>Sale price (per unit)</label>
                <input
                  className="input input--mono"
                  type="number" min="0" step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Quantity</label>
                <div className="stepper">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input
                    type="number" min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  />
                  <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
              </div>

              {/* Cost override only visible to privileged users. */}
              {can.viewInventory && (
                <div className="field">
                  <label>Cost override (optional)</label>
                  <input
                    className="input input--mono"
                    type="number" min="0" step="0.01"
                    placeholder="Defaults to batch cost"
                    value={costOverride}
                    onChange={(e) => setCostOverride(e.target.value)}
                  />
                </div>
              )}

              <div className="linetotal">
                <span>Total</span>
                <b>{money(lineTotal, selected.currency || 'PKR')}</b>
              </div>

              <button
                className="btn btn--amber btn--block btn--lg"
                onClick={confirmSale}
                disabled={confirming || !branch}
              >
                {confirming ? 'Logging…' : 'Confirm sale'}
              </button>
              {!branch && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 10, textAlign: 'center' }}>
                  You need a branch assigned before selling. Ask your admin.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}
