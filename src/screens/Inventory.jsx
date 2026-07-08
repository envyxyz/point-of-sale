import { useEffect, useState, useCallback } from 'react'
import { supabase, productImageUrl } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { money, num, fmtDate } from '../lib/format'
import { Icon, Toast, Modal, PageLoad, Empty } from '../components/ui'

const LOW_STOCK = 5

export default function Inventory() {
  const { can } = useAuth()
  const editable = can.editInventory

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [productStock, setProductStock] = useState({}) // id -> available
  const [vendors, setVendors] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [batches, setBatches] = useState([])
  const [batchStock, setBatchStock] = useState({})     // batch_id -> {available, sold, allocated}
  const [toast, setToast] = useState(null)

  const [productModal, setProductModal] = useState(null) // {mode, product}
  const [batchModal, setBatchModal] = useState(false)

  const loadProducts = useCallback(async () => {
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .order('name')
    setProducts(prods || [])

    const { data: ps } = await supabase
      .from('v_product_stock')
      .select('product_id, quantity_available')
    setProductStock(Object.fromEntries((ps || []).map((r) => [r.product_id, Number(r.quantity_available)])))

    const { data: v } = await supabase.from('vendors').select('id, name').order('name')
    setVendors(v || [])
  }, [])

  const loadBatches = useCallback(async (productId) => {
    if (!productId) { setBatches([]); return }
    const { data: bs } = await supabase
      .from('batches')
      .select('*, vendors(name)')
      .eq('product_id', productId)
      .order('batch_date', { ascending: false })
    setBatches(bs || [])

    const { data: bstock } = await supabase
      .from('v_batch_stock')
      .select('batch_id, quantity_sold, quantity_allocated, quantity_available')
      .eq('product_id', productId)
    setBatchStock(Object.fromEntries((bstock || []).map((r) => [r.batch_id, r])))
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await loadProducts()
      setLoading(false)
    })()
  }, [loadProducts])

  useEffect(() => { loadBatches(selectedId) }, [selectedId, loadBatches])

  const selected = products.find((p) => p.id === selectedId) || null

  async function refreshAll() {
    await loadProducts()
    await loadBatches(selectedId)
  }

  if (loading) return <PageLoad label="Loading inventory…" />

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__left">
          <span className="muted">{products.length} products</span>
        </div>
        {editable ? (
          <button className="btn btn--amber" onClick={() => setProductModal({ mode: 'create', product: null })}>
            <Icon.plus style={{ width: 16, height: 16 }} /> Add product
          </button>
        ) : (
          <span className="readonly-note"><Icon.lock style={{ width: 14, height: 14 }} /> View only</span>
        )}
      </div>

      {products.length === 0 ? (
        <div className="card"><div className="card__pad">
          <Empty title="No products">
            {editable ? 'Add your first ladder model to get started.' : 'No products have been added yet.'}
          </Empty>
        </div></div>
      ) : (
        <div className="inv-layout">
          {/* Product list ------------------------------------------- */}
          <div className="prod-list">
            {products.map((pr) => {
              const stock = productStock[pr.id] ?? 0
              const low = stock <= LOW_STOCK
              const img = productImageUrl(pr.image_path)
              return (
                <button
                  key={pr.id}
                  className={`prod-row ${selectedId === pr.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(pr.id)}
                >
                  <span className="prod-row__thumb">
                    {img ? <img src={img} alt="" /> : <Icon.ladder style={{ width: 22, height: 22 }} />}
                  </span>
                  <span>
                    <span className="prod-row__name">{pr.name}</span>
                    <br />
                    <span className="prod-row__meta">{pr.sku || 'no SKU'} · {Number(pr.default_margin_pct)}%</span>
                  </span>
                  <span className={`prod-row__stock ${low ? 'low' : ''}`}>{num(stock)}</span>
                </button>
              )
            })}
          </div>

          {/* Detail -------------------------------------------------- */}
          <div>
            {!selected ? (
              <div className="card"><div className="card__pad">
                <Empty title="Select a product">Choose a product on the left to view its batches and stock.</Empty>
              </div></div>
            ) : (
              <div className="card"><div className="card__pad">
                <div className="detail-head">
                  <span className="detail-img">
                    {productImageUrl(selected.image_path)
                      ? <img src={productImageUrl(selected.image_path)} alt="" />
                      : <Icon.ladder style={{ width: 40, height: 40 }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <h2 style={{ fontSize: 21 }}>{selected.name}</h2>
                        <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>
                          {selected.sku || 'no SKU'} · default margin {Number(selected.default_margin_pct)}%
                          {!selected.is_active && ' · inactive'}
                        </div>
                      </div>
                      {editable && (
                        <button className="btn btn--ghost btn--sm" onClick={() => setProductModal({ mode: 'edit', product: selected })}>
                          <Icon.edit style={{ width: 14, height: 14 }} /> Edit
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <span className="badge">
                        {num(productStock[selected.id] ?? 0)} units available
                      </span>
                      {(productStock[selected.id] ?? 0) <= LOW_STOCK && (
                        <span className="badge badge--off" style={{ marginLeft: 8 }}>Low stock</span>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="rung rung--muted" style={{ margin: '18px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16 }}>Batches</h3>
                  {editable && (
                    <button className="btn btn--sm" onClick={() => setBatchModal(true)}>
                      <Icon.plus style={{ width: 14, height: 14 }} /> Add batch
                    </button>
                  )}
                </div>

                {batches.length === 0 ? (
                  <p className="muted">No batches yet. {editable && 'Add a batch to set cost and stock.'}</p>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Batch date</th>
                        <th>Vendor</th>
                        <th className="num">Cost</th>
                        <th className="num">Received</th>
                        <th className="num">Sold</th>
                        <th className="num">Allocated</th>
                        <th className="num">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => {
                        const st = batchStock[b.id] || {}
                        const avail = Number(st.quantity_available ?? b.quantity_received)
                        return (
                          <tr key={b.id}>
                            <td className="nowrap">{fmtDate(b.batch_date)}</td>
                            <td>{b.vendors?.name || <span className="muted">In-house</span>}</td>
                            <td className="num">{money(b.cost_price, b.currency)}</td>
                            <td className="num">{num(b.quantity_received)}</td>
                            <td className="num">{num(st.quantity_sold ?? 0)}</td>
                            <td className="num">{num(st.quantity_allocated ?? 0)}</td>
                            <td className="num" style={{ fontWeight: 700, color: avail <= LOW_STOCK ? 'var(--loss)' : 'inherit' }}>
                              {num(avail)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div></div>
            )}
          </div>
        </div>
      )}

      {productModal && (
        <ProductModal
          mode={productModal.mode}
          product={productModal.product}
          editable={editable}
          onClose={() => setProductModal(null)}
          onSaved={async (msg) => { setProductModal(null); setToast({ kind: 'ok', msg }); await refreshAll() }}
          onError={(msg) => setToast({ kind: 'err', msg })}
        />
      )}

      {batchModal && selected && (
        <BatchModal
          product={selected}
          vendors={vendors}
          onClose={() => setBatchModal(false)}
          onSaved={async () => { setBatchModal(false); setToast({ kind: 'ok', msg: 'Batch added' }); await refreshAll() }}
          onError={(msg) => setToast({ kind: 'err', msg })}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}

// ---- Product create/edit modal (with image upload) --------------------
function ProductModal({ mode, product, editable, onClose, onSaved, onError }) {
  const [name, setName] = useState(product?.name || '')
  const [sku, setSku] = useState(product?.sku || '')
  const [margin, setMargin] = useState(product?.default_margin_pct ?? 20)
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!editable) return
    setBusy(true)
    try {
      let image_path = product?.image_path || null

      // Upload image if a new file was chosen.
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) throw upErr
        image_path = path
      }

      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        default_margin_pct: Number(margin),
        is_active: isActive,
        image_path,
      }

      if (mode === 'create') {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        onSaved('Product added')
      } else {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id)
        if (error) throw error
        onSaved('Product updated')
      }
    } catch (err) {
      onError(err.message || 'Could not save product')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Add product' : 'Edit product'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="e.g. 6ft Aluminium Step Ladder" />
        </div>
        <div className="row">
          <div className="field">
            <label>SKU (optional)</label>
            <input className="input input--mono" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="field">
            <label>Default margin %</label>
            <input className="input input--mono" type="number" step="0.001" min="0"
              value={margin} onChange={(e) => setMargin(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label>Product image</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {product?.image_path && !file && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Current image kept unless you choose a new one.</p>
          )}
        </div>
        <div className="checkline">
          <input id="active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <label htmlFor="active">Active (shown on POS)</label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn--ghost btn--block" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--amber btn--block" disabled={busy}>
            {busy ? 'Saving…' : mode === 'create' ? 'Add product' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Add batch modal --------------------------------------------------
function BatchModal({ product, vendors, onClose, onSaved, onError }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
  const [batchDate, setBatchDate] = useState(today)
  const [cost, setCost] = useState('')
  const [qtyRecv, setQtyRecv] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.from('batches').insert({
        product_id: product.id,
        vendor_id: vendorId || null,
        batch_date: batchDate,
        cost_price: Number(cost),
        quantity_received: parseInt(qtyRecv, 10),
        notes: notes.trim() || null,
      })
      if (error) throw error
      onSaved()
    } catch (err) {
      onError(err.message || 'Could not add batch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Add batch — ${product.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="row">
          <div className="field">
            <label>Batch date</label>
            <input className="input" type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Vendor (optional)</label>
            <select className="select" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">In-house / none</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Cost price (per unit)</label>
            <input className="input input--mono" type="number" step="0.01" min="0"
              value={cost} onChange={(e) => setCost(e.target.value)} required />
          </div>
          <div className="field">
            <label>Quantity received</label>
            <input className="input input--mono" type="number" min="0"
              value={qtyRecv} onChange={(e) => setQtyRecv(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="alert alert--info" style={{ marginTop: 4 }}>
          This batch's cost sets the suggested POS price via the product's margin.
          Salesmen never see the cost figure.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn--ghost btn--block" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--amber btn--block" disabled={busy}>
            {busy ? 'Adding…' : 'Add batch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
