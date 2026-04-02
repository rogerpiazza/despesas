import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function ContasFixas() {
  const [month, setMonth] = useState(currentMonthYear())
  const [bills, setBills] = useState([])
  const [billMonths, setBillMonths] = useState([])
  const [people, setPeople] = useState([])
  const [newBill, setNewBill] = useState({ name: '', due_day: '', estimated_amount: '' })
  const [localValues, setLocalValues] = useState({}) // {billId: {amount, paid_by, paid_date}}
  const [saving, setSaving] = useState({})
  const [editingBill, setEditingBill] = useState(null) // {id, name, due_day, estimated_amount}
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [month])

  async function load() {
    const [bRes, bmRes, pRes] = await Promise.all([
      supabase.from('fixed_bills').select('*').eq('active', true).order('due_day'),
      supabase.from('bill_month_entries').select('*, people(name)').eq('month_year', month),
      supabase.from('people').select('*').order('name'),
    ])
    const billsData = bRes.data || []
    const billMonthsData = bmRes.data || []
    setBills(billsData)
    setBillMonths(billMonthsData)
    setPeople(pRes.data || [])

    // Inicializa valores locais com dados do banco ou estimados
    const lv = {}
    for (const bill of billsData) {
      const bm = billMonthsData.find(b => b.bill_id === bill.id)
      lv[bill.id] = {
        amount: bm ? String(bm.amount) : (bill.estimated_amount ? String(bill.estimated_amount) : ''),
        paid_by: bm?.paid_by || '',
        paid_date: bm?.paid_date || '',
      }
    }
    setLocalValues(lv)
  }

  async function addBill(e) {
    e.preventDefault()
    if (!newBill.name.trim() || !newBill.due_day) return setMsg('Nome e dia são obrigatórios.')
    const { error } = await supabase.from('fixed_bills').insert({
      name: newBill.name.trim(),
      due_day: parseInt(newBill.due_day),
      estimated_amount: newBill.estimated_amount ? parseFloat(newBill.estimated_amount) : null,
    })
    if (error) return setMsg('Erro: ' + error.message)
    setNewBill({ name: '', due_day: '', estimated_amount: '' })
    setMsg('Conta adicionada!')
    load()
  }

  async function saveBillEdit(e) {
    e.preventDefault()
    if (!editingBill.name.trim() || !editingBill.due_day) return
    await supabase.from('fixed_bills').update({
      name: editingBill.name.trim(),
      due_day: parseInt(editingBill.due_day),
      estimated_amount: editingBill.estimated_amount ? parseFloat(editingBill.estimated_amount) : null,
    }).eq('id', editingBill.id)
    setEditingBill(null)
    load()
  }

  async function deactivateBill(id) {
    if (!confirm('Desativar esta conta? Ela não aparecerá mais nas sugestões.')) return
    await supabase.from('fixed_bills').update({ active: false }).eq('id', id)
    load()
  }

  async function saveBill(bill) {
    setSaving(s => ({ ...s, [bill.id]: true }))
    const lv = localValues[bill.id] || {}
    const existing = billMonths.find(bm => bm.bill_id === bill.id)
    const payload = {
      amount: parseFloat(lv.amount) || 0,
      paid_by: lv.paid_by || null,
      paid_date: lv.paid_date || null,
    }
    if (existing) {
      await supabase.from('bill_month_entries').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('bill_month_entries').insert({
        bill_id: bill.id,
        month_year: month,
        ...payload,
      })
    }
    setSaving(s => ({ ...s, [bill.id]: false }))
    load()
  }

  function setLocal(billId, field, value) {
    setLocalValues(lv => ({ ...lv, [billId]: { ...lv[billId], [field]: value } }))
  }

  const total = billMonths.reduce((s, b) => s + Number(b.amount), 0)

  return (
    <div>
      <h1 style={styles.title}>Contas Fixas</h1>

      <Card>
        <CardTitle>Nova Conta Fixa</CardTitle>
        <form onSubmit={addBill} style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Nome da Conta</label>
            <input style={styles.input} placeholder="Ex: Aluguel" value={newBill.name}
              onChange={e => setNewBill(b => ({ ...b, name: e.target.value }))} />
          </div>
          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>Dia de Vencimento</label>
              <input style={styles.input} type="number" min="1" max="31" placeholder="Dia"
                value={newBill.due_day} onChange={e => setNewBill(b => ({ ...b, due_day: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Valor Estimado (R$)</label>
              <input style={styles.input} type="number" step="0.01" placeholder="0,00"
                value={newBill.estimated_amount} onChange={e => setNewBill(b => ({ ...b, estimated_amount: e.target.value }))} />
            </div>
          </div>
          <button style={styles.btn} type="submit">Adicionar Conta</button>
        </form>
        {msg && <p style={styles.msg}>{msg}</p>}
      </Card>

      <MonthSelector value={month} onChange={setMonth} />

      {bills.length === 0 ? (
        <Card><p style={styles.muted}>Nenhuma conta fixa cadastrada.</p></Card>
      ) : (
        <>
          {bills.map(bill => {
            const lv = localValues[bill.id] || {}
            const bm = billMonths.find(b => b.bill_id === bill.id)
            const saved = !!bm
            return (
              <Card key={bill.id} style={{ paddingBottom: 12 }}>
                {editingBill?.id === bill.id ? (
                  <form onSubmit={saveBillEdit} style={styles.editBillForm}>
                    <input style={styles.input} value={editingBill.name} autoFocus
                      onChange={e => setEditingBill(b => ({ ...b, name: e.target.value }))} placeholder="Nome" />
                    <div style={styles.twoCol}>
                      <input style={styles.input} type="number" min="1" max="31" placeholder="Dia venc."
                        value={editingBill.due_day} onChange={e => setEditingBill(b => ({ ...b, due_day: e.target.value }))} />
                      <input style={styles.input} type="number" step="0.01" placeholder="Valor estimado"
                        value={editingBill.estimated_amount} onChange={e => setEditingBill(b => ({ ...b, estimated_amount: e.target.value }))} />
                    </div>
                    <div style={styles.editBillActions}>
                      <button style={styles.saveEditBtn} type="submit">Salvar</button>
                      <button type="button" onClick={() => setEditingBill(null)} style={styles.cancelEditBtn}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div style={styles.billHeader}>
                    <div>
                      <span style={styles.billName}>{bill.name}</span>
                      <span style={styles.billDay}> · vence dia {bill.due_day}</span>
                      {saved && <span style={styles.savedBadge}>✓ salvo</span>}
                    </div>
                    <div style={styles.billActions}>
                      <button onClick={() => setEditingBill({ id: bill.id, name: bill.name, due_day: bill.due_day, estimated_amount: bill.estimated_amount || '' })} style={styles.editBillBtn}>Editar</button>
                      <button onClick={() => deactivateBill(bill.id)} style={styles.deleteBtn}>Desativar</button>
                    </div>
                  </div>
                )}

                <div style={styles.twoCol}>
                  <div style={styles.field}>
                    <label style={styles.label}>Valor neste mês (R$)</label>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      value={lv.amount ?? ''}
                      onChange={e => setLocal(bill.id, 'amount', e.target.value)}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Quem pagou</label>
                    <select
                      style={styles.input}
                      value={lv.paid_by || ''}
                      onChange={e => setLocal(bill.id, 'paid_by', e.target.value)}
                    >
                      <option value="">— não pago —</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                {lv.paid_by && (
                  <div style={{ ...styles.field, marginTop: 8 }}>
                    <label style={styles.label}>Data do pagamento</label>
                    <input
                      style={{ ...styles.input, maxWidth: 180 }}
                      type="date"
                      value={lv.paid_date || ''}
                      onChange={e => setLocal(bill.id, 'paid_date', e.target.value)}
                    />
                  </div>
                )}

                <button
                  style={{ ...styles.btn, marginTop: 12, background: saved ? '#16a34a' : '#1a56db' }}
                  onClick={() => saveBill(bill)}
                  disabled={saving[bill.id]}
                >
                  {saving[bill.id] ? 'Salvando...' : saved ? '✓ Atualizar' : 'Salvar'}
                </button>
              </Card>
            )
          })}

          <Card style={{ background: '#eff6ff' }}>
            <div style={styles.totalRow}>
              <span style={{ fontWeight: 700 }}>Total Contas Fixas (salvas)</span>
              <span style={{ fontWeight: 700, color: '#1a56db', fontSize: 18 }}>{formatCurrency(total)}</span>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  msg: { marginTop: 8, color: '#065f46', fontSize: 13 },
  muted: { color: '#94a3b8', fontSize: 14 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' },
  billHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  billActions: { display: 'flex', gap: 6 },
  editBillBtn: { background: '#eff6ff', color: '#1a56db', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  editBillForm: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  editBillActions: { display: 'flex', gap: 8 },
  saveEditBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flex: 1 },
  cancelEditBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, flex: 1 },
  billName: { fontWeight: 700, fontSize: 15 },
  billDay: { color: '#64748b', fontSize: 13 },
  savedBadge: { marginLeft: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 },
  deleteBtn: { background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}
