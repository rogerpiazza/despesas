import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatDate } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Extras() {
  const [month, setMonth] = useState(currentMonthYear())
  const [people, setPeople] = useState([])
  const [extras, setExtras] = useState([])
  const [form, setForm] = useState({ description: '', amount: '', paid_by: '', expense_date: '' })
  const [editing, setEditing] = useState(null) // {id, description, amount, expense_date, paid_by}
  const [msg, setMsg] = useState('')

  useEffect(() => { loadPeople() }, [])
  useEffect(() => { loadExtras() }, [month])

  async function loadPeople() {
    const { data } = await supabase.from('people').select('*').order('name')
    setPeople(data || [])
    if (data?.length) setForm(f => ({ ...f, paid_by: data[0].id }))
  }

  async function loadExtras() {
    const { data } = await supabase
      .from('extra_expenses')
      .select('*, people(name)')
      .eq('month_year', month)
      .order('expense_date', { ascending: false })
    setExtras(data || [])
  }

  async function addExtra(e) {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || !form.paid_by || !form.expense_date)
      return setMsg('Preencha todos os campos.')
    const { error } = await supabase.from('extra_expenses').insert({
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      paid_by: form.paid_by,
      expense_date: form.expense_date,
      month_year: month,
    })
    if (error) return setMsg('Erro: ' + error.message)
    setForm(f => ({ ...f, description: '', amount: '', expense_date: '' }))
    setMsg('Gasto extra lançado!')
    loadExtras()
  }

  async function saveEdit(e) {
    e.preventDefault()
    await supabase.from('extra_expenses').update({
      description: editing.description,
      amount: parseFloat(editing.amount),
      expense_date: editing.expense_date,
      paid_by: editing.paid_by,
    }).eq('id', editing.id)
    setEditing(null)
    loadExtras()
  }

  async function deleteExtra(id) {
    if (!confirm('Remover gasto extra?')) return
    await supabase.from('extra_expenses').delete().eq('id', id)
    loadExtras()
  }

  const totalByPerson = {}
  for (const e of extras) {
    const name = e.people?.name || '?'
    totalByPerson[name] = (totalByPerson[name] || 0) + Number(e.amount)
  }
  const grandTotal = extras.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <h1 style={styles.title}>Gastos Extras</h1>
      <MonthSelector value={month} onChange={setMonth} />
      {msg && <div style={styles.msg}>{msg}</div>}

      <Card>
        <CardTitle>Lançar Gasto Extra</CardTitle>
        <form onSubmit={addExtra} style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Descrição</label>
            <input style={styles.input} placeholder="Ex: Farmácia, Supermercado..." value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>Valor (R$)</label>
              <input style={styles.input} type="number" step="0.01" placeholder="0,00"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Data</label>
              <input style={styles.input} type="date" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Quem pagou</label>
            <select style={styles.input} value={form.paid_by}
              onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button style={styles.btn} type="submit">Lançar</button>
        </form>
      </Card>

      {Object.keys(totalByPerson).length > 0 && (
        <Card>
          <CardTitle>Resumo de Extras</CardTitle>
          {Object.entries(totalByPerson).map(([name, total]) => (
            <div key={name} style={styles.summaryRow}>
              <span>{name}</span>
              <span style={styles.summaryVal}>{formatCurrency(total)}</span>
            </div>
          ))}
          <div style={{ ...styles.summaryRow, borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ ...styles.summaryVal, color: '#d97706' }}>{formatCurrency(grandTotal)}</span>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Lançamentos</CardTitle>
        {extras.length === 0 ? (
          <p style={styles.muted}>Nenhum gasto extra neste mês.</p>
        ) : extras.map(e => (
          <div key={e.id}>
            {editing?.id === e.id ? (
              <form onSubmit={saveEdit} style={styles.editBlock}>
                <input style={styles.input} value={editing.description}
                  onChange={ev => setEditing(ed => ({ ...ed, description: ev.target.value }))} placeholder="Descrição" autoFocus />
                <div style={styles.twoCol}>
                  <input style={styles.input} type="number" step="0.01" value={editing.amount}
                    onChange={ev => setEditing(ed => ({ ...ed, amount: ev.target.value }))} />
                  <input style={styles.input} type="date" value={editing.expense_date}
                    onChange={ev => setEditing(ed => ({ ...ed, expense_date: ev.target.value }))} />
                </div>
                <select style={styles.input} value={editing.paid_by}
                  onChange={ev => setEditing(ed => ({ ...ed, paid_by: ev.target.value }))}>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div style={styles.editActions}>
                  <button style={styles.saveBtn} type="submit">Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} style={styles.cancelBtn}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div style={styles.entryRow}>
                <div style={styles.entryInfo}>
                  <span style={styles.entryName}>{e.description}</span>
                  <span style={styles.entryMeta}>{e.people?.name} · {formatDate(e.expense_date)}</span>
                </div>
                <span style={styles.entryAmount}>{formatCurrency(e.amount)}</span>
                <button onClick={() => setEditing({ id: e.id, description: e.description, amount: e.amount, expense_date: e.expense_date, paid_by: e.paid_by })} style={styles.editBtn}>✎</button>
                <button onClick={() => deleteExtra(e.id)} style={styles.deleteBtn}>✕</button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  msg: { background: '#d1fae5', color: '#065f46', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginTop: 4 },
  muted: { color: '#94a3b8', fontSize: 14 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 },
  summaryVal: { fontWeight: 600, color: '#374151' },
  entryRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  editBlock: { display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  editActions: { display: 'flex', gap: 8 },
  editBtn: { background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 15, padding: '2px 6px' },
  saveBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, flex: 1 },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, flex: 1 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: 500, display: 'block' },
  entryMeta: { fontSize: 12, color: '#64748b' },
  entryAmount: { fontWeight: 700, color: '#d97706', minWidth: 90, textAlign: 'right' },
  deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
}
