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
  const [localValues, setLocalValues] = useState({}) // {sourceId: {amount, received_date}}
  const [saving, setSaving] = useState({})
  const [form, setForm] = useState({ income_source_id: '', amount: '', received_date: '' })
  const [editing, setEditing] = useState(null)
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
      .select('*, income_sources(name, type, people(name)), people(name)')
      .eq('month_year', month)
      .order('received_date')
    const entriesData = data || []
    setEntries(entriesData)

    // Inicializa localValues para fontes fixas
    const lv = {}
    for (const s of sources.filter(s => s.type === 'fixa')) {
      const entry = entriesData.find(e => e.income_source_id === s.id)
      lv[s.id] = {
        amount: entry ? String(entry.amount) : (s.estimated_amount ? String(s.estimated_amount) : ''),
        received_date: entry?.received_date || '',
      }
    }
    setLocalValues(lv)
  }

  // Reinicializa localValues quando sources carrega
  useEffect(() => {
    if (!sources.length || !entries.length) return
    const lv = {}
    for (const s of sources.filter(s => s.type === 'fixa')) {
      const entry = entries.find(e => e.income_source_id === s.id)
      lv[s.id] = {
        amount: entry ? String(entry.amount) : (s.estimated_amount ? String(s.estimated_amount) : ''),
        received_date: entry?.received_date || '',
      }
    }
    setLocalValues(lv)
  }, [sources, entries])

  function setLocal(sourceId, field, value) {
    setLocalValues(lv => ({ ...lv, [sourceId]: { ...lv[sourceId], [field]: value } }))
  }

  async function saveFixed(source) {
    setSaving(s => ({ ...s, [source.id]: true }))
    const lv = localValues[source.id] || {}
    const existing = entries.find(e => e.income_source_id === source.id)
    const payload = {
      amount: parseFloat(lv.amount) || 0,
      received_date: lv.received_date || null,
    }
    if (existing) {
      await supabase.from('income_entries').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('income_entries').insert({
        income_source_id: source.id,
        person_id: source.person_id,
        month_year: month,
        ...payload,
      })
    }
    setSaving(s => ({ ...s, [source.id]: false }))
    loadEntries()
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

  async function saveEdit(e) {
    e.preventDefault()
    await supabase.from('income_entries').update({
      amount: parseFloat(editing.amount),
      received_date: editing.received_date,
    }).eq('id', editing.id)
    setEditing(null)
    loadEntries()
  }

  async function deleteEntry(id) {
    if (!confirm('Remover lançamento?')) return
    await supabase.from('income_entries').delete().eq('id', id)
    loadEntries()
  }

  const fixedSources = sources.filter(s => s.type === 'fixa')
  const pontualSources = sources.filter(s => s.type === 'pontual')
  const pontualEntries = entries.filter(e => e.income_sources?.type === 'pontual')

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

      {/* Resumo */}
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

      {/* Rendas Fixas */}
      {fixedSources.length > 0 && (
        <>
          <p style={styles.sectionLabel}>🔁 Rendas Fixas</p>
          {fixedSources.map(source => {
            const lv = localValues[source.id] || {}
            const saved = !!entries.find(e => e.income_source_id === source.id)
            return (
              <Card key={source.id} style={{ paddingBottom: 12 }}>
                <div style={styles.fixedHeader}>
                  <div>
                    <span style={styles.fixedName}>{source.name}</span>
                    <span style={styles.fixedPerson}> · {source.people?.name}</span>
                    {saved && <span style={styles.savedBadge}>✓ confirmado</span>}
                  </div>
                </div>
                <div style={styles.twoCol}>
                  <div style={styles.field}>
                    <label style={styles.label}>Valor recebido (R$)</label>
                    <input style={styles.input} type="number" step="0.01"
                      value={lv.amount ?? ''}
                      onChange={e => setLocal(source.id, 'amount', e.target.value)} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Data de recebimento</label>
                    <input style={styles.input} type="date"
                      value={lv.received_date || ''}
                      onChange={e => setLocal(source.id, 'received_date', e.target.value)} />
                  </div>
                </div>
                <button
                  style={{ ...styles.btn, marginTop: 10, background: saved ? '#16a34a' : '#1a56db' }}
                  onClick={() => saveFixed(source)}
                  disabled={saving[source.id]}
                >
                  {saving[source.id] ? 'Salvando...' : saved ? '✓ Atualizar' : 'Confirmar recebimento'}
                </button>
              </Card>
            )
          })}
        </>
      )}

      {/* Rendas Pontuais */}
      <p style={styles.sectionLabel}>⚡ Rendas Pontuais</p>
      <Card>
        <CardTitle>Lançar Renda Pontual</CardTitle>
        {pontualSources.length === 0 ? (
          <p style={styles.muted}>Cadastre fontes de renda do tipo "Pontual" em Pessoas para lançar aqui.</p>
        ) : (
          <form onSubmit={addEntry} style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Fonte de Renda</label>
              <select style={styles.input} value={form.income_source_id}
                onChange={e => setForm(f => ({ ...f, income_source_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {pontualSources.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.people?.name}</option>
                ))}
              </select>
            </div>
            <div style={styles.twoCol}>
              <div style={styles.field}>
                <label style={styles.label}>Valor (R$)</label>
                <input style={styles.input} type="number" step="0.01" placeholder="0,00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Data de recebimento</label>
                <input style={styles.input} type="date" value={form.received_date}
                  onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
              </div>
            </div>
            <button style={styles.btn} type="submit">Lançar</button>
          </form>
        )}
      </Card>

      {/* Histórico pontuais */}
      {pontualEntries.length > 0 && (
        <Card>
          <CardTitle>Lançamentos Pontuais</CardTitle>
          {pontualEntries.map(e => (
            <div key={e.id}>
              {editing?.id === e.id ? (
                <form onSubmit={saveEdit} style={styles.editRow}>
                  <span style={styles.entryName}>{e.income_sources?.name} — {e.income_sources?.people?.name}</span>
                  <input style={{ ...styles.input, maxWidth: 120 }} type="number" step="0.01"
                    value={editing.amount} onChange={ev => setEditing(ed => ({ ...ed, amount: ev.target.value }))} />
                  <input style={{ ...styles.input, maxWidth: 140 }} type="date"
                    value={editing.received_date} onChange={ev => setEditing(ed => ({ ...ed, received_date: ev.target.value }))} />
                  <button style={styles.saveBtn} type="submit">Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} style={styles.cancelBtn}>✕</button>
                </form>
              ) : (
                <div style={styles.entryRow}>
                  <div style={styles.entryInfo}>
                    <span style={styles.entryName}>{e.income_sources?.name}</span>
                    <span style={styles.entryPerson}>{e.income_sources?.people?.name}</span>
                  </div>
                  <span style={styles.entryDate}>{formatDate(e.received_date)}</span>
                  <span style={styles.entryAmount}>{formatCurrency(e.amount)}</span>
                  <button onClick={() => setEditing({ id: e.id, amount: e.amount, received_date: e.received_date })} style={styles.editBtn}>✎</button>
                  <button onClick={() => deleteEntry(e.id)} style={styles.deleteBtn}>✕</button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  msg: { background: '#d1fae5', color: '#065f46', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#374151', margin: '16px 0 8px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' },
  muted: { color: '#94a3b8', fontSize: 14 },
  fixedHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fixedName: { fontWeight: 700, fontSize: 15 },
  fixedPerson: { color: '#64748b', fontSize: 13 },
  savedBadge: { marginLeft: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 },
  summaryVal: { fontWeight: 600, color: '#374151' },
  entryRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  editRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' },
  entryInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  entryName: { fontSize: 14, fontWeight: 500 },
  entryPerson: { fontSize: 12, color: '#64748b' },
  entryDate: { fontSize: 13, color: '#64748b', minWidth: 70 },
  entryAmount: { fontWeight: 700, color: '#16a34a', minWidth: 90, textAlign: 'right' },
  editBtn: { background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 15, padding: '2px 6px' },
  saveBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 13 },
  deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
}
