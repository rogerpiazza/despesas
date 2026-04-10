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
  const [editing, setEditing] = useState(null)
  const [editingSource, setEditingSource] = useState(null)
  const [msg, setMsg] = useState('')

  const [cadastro, setCadastro] = useState({ person_id: '', newPersonName: '', type: 'fixa', name: '', estimated_amount: '', expected_day: '' })
  const [showNewPerson, setShowNewPerson] = useState(false)

  const [form, setForm] = useState({ income_source_id: '', amount: '', received_date: '' })

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadEntries() }, [month])

  async function loadAll() {
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
    setEntries(data || [])
  }

  async function cadastrarFonte(e) {
    e.preventDefault()
    let personId = cadastro.person_id

    if (showNewPerson) {
      if (!cadastro.newPersonName.trim()) return setMsg('Informe o nome da pessoa.')
      const { data, error } = await supabase.from('people').insert({ name: cadastro.newPersonName.trim() }).select().single()
      if (error) return setMsg('Erro ao criar pessoa: ' + error.message)
      personId = data.id
    }

    if (!personId || !cadastro.name.trim()) return setMsg('Preencha pessoa e descrição.')

    const { error } = await supabase.from('income_sources').insert({
      person_id: personId,
      name: cadastro.name.trim(),
      type: cadastro.type,
      estimated_amount: cadastro.type === 'fixa' && cadastro.estimated_amount ? parseFloat(cadastro.estimated_amount) : null,
      expected_day: cadastro.expected_day ? parseInt(cadastro.expected_day) : null,
    })
    if (error) return setMsg('Erro: ' + error.message)

    setCadastro({ person_id: '', newPersonName: '', type: 'fixa', name: '', estimated_amount: '', expected_day: '' })
    setShowNewPerson(false)
    setMsg('Renda cadastrada!')
    loadAll()
  }

  async function saveEditSource(e) {
    e.preventDefault()
    if (!editingSource.name.trim()) return
    await supabase.from('income_sources').update({
      name: editingSource.name.trim(),
      type: editingSource.type,
      estimated_amount: editingSource.type === 'fixa' && editingSource.estimated_amount ? parseFloat(editingSource.estimated_amount) : null,
      expected_day: editingSource.expected_day ? parseInt(editingSource.expected_day) : null,
    }).eq('id', editingSource.id)
    setEditingSource(null)
    loadAll()
  }

  async function deleteSource(id) {
    if (!confirm('Remover esta fonte de renda?')) return
    await supabase.from('income_sources').delete().eq('id', id)
    loadAll()
  }

  async function addEntry(e) {
    e.preventDefault()
    const source = sources.find(s => s.id === form.income_source_id)
    if (!source || !form.amount || !form.received_date) return setMsg('Preencha todos os campos.')
    const { error } = await supabase.from('income_entries').insert({
      income_source_id: form.income_source_id,
      person_id: source.people?.id || source.person_id,
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
      <h1 style={styles.title}>Rendas</h1>
      {msg && <div style={styles.msg}>{msg}</div>}

      {/* Cadastro */}
      <Card>
        <CardTitle>Cadastrar Renda</CardTitle>
        <form onSubmit={cadastrarFonte} style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Pessoa</label>
            {showNewPerson ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={styles.input} placeholder="Nome da pessoa" value={cadastro.newPersonName}
                  onChange={e => setCadastro(c => ({ ...c, newPersonName: e.target.value }))} autoFocus />
                <button type="button" style={styles.cancelBtn} onClick={() => { setShowNewPerson(false); setCadastro(c => ({ ...c, newPersonName: '' })) }}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={styles.input} value={cadastro.person_id}
                  onChange={e => setCadastro(c => ({ ...c, person_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" style={styles.newPersonBtn} onClick={() => { setShowNewPerson(true); setCadastro(c => ({ ...c, person_id: '' })) }}>+ Nova</button>
              </div>
            )}
          </div>

          <div style={styles.twoCol}>
            <div style={styles.field}>
              <label style={styles.label}>Tipo</label>
              <select style={styles.input} value={cadastro.type}
                onChange={e => setCadastro(c => ({ ...c, type: e.target.value }))}>
                <option value="fixa">Fixa (mensal)</option>
                <option value="pontual">Pontual</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Descrição</label>
              <input style={styles.input} placeholder="Ex: Salário, Freelance..."
                value={cadastro.name} onChange={e => setCadastro(c => ({ ...c, name: e.target.value }))} />
            </div>
          </div>

          {cadastro.type === 'fixa' && (
            <div style={styles.twoCol}>
              <div style={styles.field}>
                <label style={styles.label}>Valor estimado (R$)</label>
                <input style={styles.input} type="number" step="0.01" placeholder="0,00"
                  value={cadastro.estimated_amount} onChange={e => setCadastro(c => ({ ...c, estimated_amount: e.target.value }))} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Dia de recebimento</label>
                <input style={styles.input} type="number" min="1" max="31" placeholder="Ex: 5"
                  value={cadastro.expected_day} onChange={e => setCadastro(c => ({ ...c, expected_day: e.target.value }))} />
              </div>
            </div>
          )}

          <button style={styles.btn} type="submit">Cadastrar</button>
        </form>

        {/* Lista de fontes */}
        {sources.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <p style={styles.subLabel}>Fontes cadastradas</p>
            {sources.map(s => (
              <div key={s.id}>
                {editingSource?.id === s.id ? (
                  <form onSubmit={saveEditSource} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={styles.twoCol}>
                      <input style={styles.input} value={editingSource.name} autoFocus
                        onChange={e => setEditingSource(es => ({ ...es, name: e.target.value }))} placeholder="Descrição" />
                      <select style={styles.input} value={editingSource.type}
                        onChange={e => setEditingSource(es => ({ ...es, type: e.target.value }))}>
                        <option value="fixa">Fixa</option>
                        <option value="pontual">Pontual</option>
                      </select>
                    </div>
                    {editingSource.type === 'fixa' && (
                      <div style={styles.twoCol}>
                        <input style={styles.input} type="number" step="0.01" placeholder="Valor estimado"
                          value={editingSource.estimated_amount}
                          onChange={e => setEditingSource(es => ({ ...es, estimated_amount: e.target.value }))} />
                        <input style={styles.input} type="number" min="1" max="31" placeholder="Dia recebimento"
                          value={editingSource.expected_day}
                          onChange={e => setEditingSource(es => ({ ...es, expected_day: e.target.value }))} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...styles.btn, padding: '6px 16px', fontSize: 13 }} type="submit">Salvar</button>
                      <button type="button" onClick={() => setEditingSource(null)} style={styles.cancelBtn}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <div style={styles.sourceRow}>
                    <div style={styles.sourceInfo}>
                      <span style={styles.sourceName}>{s.name}</span>
                      <span style={styles.sourceMeta}>
                        {s.people?.name} · {s.type === 'fixa' ? '🔁 Fixa' : '⚡ Pontual'}
                        {s.type === 'fixa' && s.estimated_amount ? ` · ${formatCurrency(s.estimated_amount)}` : ''}
                        {s.type === 'fixa' && s.expected_day ? ` · dia ${s.expected_day}` : ''}
                      </span>
                    </div>
                    <button onClick={() => setEditingSource({ id: s.id, name: s.name, type: s.type || 'fixa', estimated_amount: s.estimated_amount || '', expected_day: s.expected_day || '' })} style={styles.editSmall}>✎</button>
                    <button onClick={() => deleteSource(s.id)} style={styles.deleteSmall}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rendas Pontuais */}
      {pontualSources.length > 0 && (
        <>
          <MonthSelector value={month} onChange={setMonth} />

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
            <CardTitle>⚡ Lançar Renda Pontual</CardTitle>
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
          </Card>

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
        </>
      )}
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
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' },
  newPersonBtn: { background: '#eff6ff', color: '#1a56db', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 },
  subLabel: { fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8 },
  sourceRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9' },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 14, fontWeight: 500, display: 'block' },
  sourceMeta: { fontSize: 12, color: '#64748b' },
  editSmall: { background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
  deleteSmall: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
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
  deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
}
