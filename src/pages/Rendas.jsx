import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatDate } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Rendas() {
  const [month, setMonth] = useState(currentMonthYear())
  const [people, setPeople] = useState([])
  const [sources, setSources] = useState([])
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ income_source_id: '', amount: '', received_date: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { loadPeople() }, [])
  useEffect(() => { loadEntries() }, [month])

  async function loadPeople() {
    const [pRes, sRes] = await Promise.all([
      supabase.from('people').select('*').order('name'),
      supabase.from('income_sources').select('*, people(id, name)').order('name'),
    ])
    setPeople(pRes.data || [])
    setSources(sRes.data || [])
  }

  async function loadEntries() {
    const { data } = await supabase
      .from('income_entries')
      .select('*, income_sources(name, people(name)), people(name)')
      .eq('month_year', month)
      .order('received_date')
    setEntries(data || [])
  }

  async function addEntry(e) {
    e.preventDefault()
    const source = sources.find(s => s.id === form.income_source_id)
    if (!source || !form.amount || !form.received_date) return setMsg('Preencha todos os campos.')
    const { error } = await supabase.from('income_entries').insert({
      income_source_id: form.income_source_id,
      person_id: source.people.id,
      amount: parseFloat(form.amount),
      received_date: form.received_date,
      month_year: month,
    })
    if (error) return setMsg('Erro: ' + error.message)
    setForm({ income_source_id: '', amount: '', received_date: '' })
    setMsg('Renda lançada!')
    loadEntries()
  }

  async function deleteEntry(id) {
    if (!confirm('Remover lançamento?')) return
    await supabase.from('income_entries').delete().eq('id', id)
    loadEntries()
  }

  const totalByPerson = {}
  for (const e of entries) {
    const name = e.income_sources?.people?.name || e.people?.name || '?'
    totalByPerson[name] = (totalByPerson[name] || 0) + Number(e.amount)
  }
  const grandTotal = Object.values(totalByPerson).reduce((s, v) => s + v, 0)

  return (
    <div>
      <h1 style={styles.title}>Rendas do Mês</h1>
      <MonthSelector value={month} onChange={setMonth} />
      {msg && <div style={styles.msg}>{msg}</div>}

      <Card>
        <CardTitle>Lançar Renda</CardTitle>
        <form onSubmit={addEntry} style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Fonte de Renda</label>
            <select
              style={styles.input}
              value={form.income_source_id}
              onChange={e => setForm(f => ({ ...f, income_source_id: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {people.map(person => (
                <optgroup key={person.id} label={person.name}>
                  {sources.filter(s => s.people?.id === person.id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Valor (R$)</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              placeholder="0,00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Data de Recebimento</label>
            <input
              style={styles.input}
              type="date"
              value={form.received_date}
              onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
            />
          </div>
          <button style={styles.btn} type="submit">Lançar</button>
        </form>
      </Card>

      {Object.keys(totalByPerson).length > 0 && (
        <Card>
          <CardTitle>Resumo do Mês</CardTitle>
          {Object.entries(totalByPerson).map(([name, total]) => (
            <div key={name} style={styles.summaryRow}>
              <span>{name}</span>
              <span style={styles.summaryVal}>{formatCurrency(total)}</span>
            </div>
          ))}
          <div style={{ ...styles.summaryRow, borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ ...styles.summaryVal, color: '#1a56db' }}>{formatCurrency(grandTotal)}</span>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Lançamentos</CardTitle>
        {entries.length === 0 ? (
          <p style={styles.muted}>Nenhuma renda lançada neste mês.</p>
        ) : entries.map(e => (
          <div key={e.id} style={styles.entryRow}>
            <div style={styles.entryInfo}>
              <span style={styles.entryName}>{e.income_sources?.name}</span>
              <span style={styles.entryPerson}>{e.income_sources?.people?.name}</span>
            </div>
            <span style={styles.entryDate}>{formatDate(e.received_date)}</span>
            <span style={styles.entryAmount}>{formatCurrency(e.amount)}</span>
            <button onClick={() => deleteEntry(e.id)} style={styles.deleteBtn}>✕</button>
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
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginTop: 4 },
  muted: { color: '#94a3b8', fontSize: 14 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 },
  summaryVal: { fontWeight: 600, color: '#374151' },
  entryRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  entryInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  entryName: { fontSize: 14, fontWeight: 500 },
  entryPerson: { fontSize: 12, color: '#64748b' },
  entryDate: { fontSize: 13, color: '#64748b', minWidth: 70 },
  entryAmount: { fontWeight: 700, color: '#16a34a', minWidth: 90, textAlign: 'right' },
  deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
}
