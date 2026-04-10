import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/helpers'
import Card, { CardTitle } from '../components/Card'

export default function Pessoas() {
  const [people, setPeople] = useState([])
  const [sources, setSources] = useState([])
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState({ person_id: '', name: '', expected_day: '', type: 'fixa', estimated_amount: '' })
  const [editingPerson, setEditingPerson] = useState(null)
  const [editingSource, setEditingSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      supabase.from('people').select('*').order('name'),
      supabase.from('income_sources').select('*, people(name)').order('name'),
    ])
    setPeople(pRes.data || [])
    setSources(sRes.data || [])
    setLoading(false)
  }

  async function addPerson(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await supabase.from('people').insert({ name: newName.trim() })
    if (error) return setMsg('Erro: ' + error.message)
    setNewName('')
    setMsg('Pessoa adicionada!')
    load()
  }

  async function savePerson(e) {
    e.preventDefault()
    if (!editingPerson.name.trim()) return
    await supabase.from('people').update({ name: editingPerson.name.trim() }).eq('id', editingPerson.id)
    setEditingPerson(null)
    load()
  }

  async function deletePerson(id) {
    if (!confirm('Remover pessoa? Isso também remove as fontes de renda vinculadas.')) return
    await supabase.from('income_sources').delete().eq('person_id', id)
    await supabase.from('people').delete().eq('id', id)
    load()
  }

  async function addSource(e) {
    e.preventDefault()
    if (!newSource.person_id || !newSource.name.trim()) return
    const { error } = await supabase.from('income_sources').insert({
      person_id: newSource.person_id,
      name: newSource.name.trim(),
      expected_day: newSource.expected_day ? parseInt(newSource.expected_day) : null,
      type: newSource.type,
      estimated_amount: newSource.type === 'fixa' && newSource.estimated_amount ? parseFloat(newSource.estimated_amount) : null,
    })
    if (error) return setMsg('Erro: ' + error.message)
    setNewSource({ person_id: newSource.person_id, name: '', expected_day: '', type: 'fixa', estimated_amount: '' })
    setMsg('Fonte de renda adicionada!')
    load()
  }

  async function saveSource(e) {
    e.preventDefault()
    if (!editingSource.name.trim()) return
    await supabase.from('income_sources').update({
      name: editingSource.name.trim(),
      expected_day: editingSource.expected_day ? parseInt(editingSource.expected_day) : null,
      type: editingSource.type,
      estimated_amount: editingSource.type === 'fixa' && editingSource.estimated_amount ? parseFloat(editingSource.estimated_amount) : null,
    }).eq('id', editingSource.id)
    setEditingSource(null)
    load()
  }

  async function deleteSource(id) {
    if (!confirm('Remover fonte de renda?')) return
    await supabase.from('income_sources').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h1 style={styles.title}>Pessoas e Rendas</h1>
      {msg && <div style={styles.msg}>{msg}</div>}

      <Card>
        <CardTitle>Adicionar Pessoa</CardTitle>
        <form onSubmit={addPerson} style={styles.row}>
          <input style={styles.input} placeholder="Nome da pessoa" value={newName}
            onChange={e => setNewName(e.target.value)} />
          <button style={styles.btn} type="submit">Adicionar</button>
        </form>
      </Card>

      {loading ? null : people.map(person => (
        <Card key={person.id}>
          <div style={styles.personHeader}>
            {editingPerson?.id === person.id ? (
              <form onSubmit={savePerson} style={{ ...styles.row, flex: 1, marginRight: 8 }}>
                <input style={styles.input} value={editingPerson.name}
                  onChange={e => setEditingPerson(p => ({ ...p, name: e.target.value }))} autoFocus />
                <button style={styles.btn} type="submit">Salvar</button>
                <button type="button" onClick={() => setEditingPerson(null)} style={styles.cancelBtn}>✕</button>
              </form>
            ) : (
              <>
                <CardTitle>{person.name}</CardTitle>
                <div style={styles.actionGroup}>
                  <button onClick={() => setEditingPerson({ id: person.id, name: person.name })} style={styles.editBtn}>Editar</button>
                  <button onClick={() => deletePerson(person.id)} style={styles.deleteBtn}>Remover</button>
                </div>
              </>
            )}
          </div>

          <p style={styles.subLabel}>Fontes de renda:</p>
          {sources.filter(s => s.person_id === person.id).map(s => (
            <div key={s.id}>
              {editingSource?.id === s.id ? (
                <form onSubmit={saveSource} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                  <input style={styles.input} value={editingSource.name}
                    onChange={e => setEditingSource(es => ({ ...es, name: e.target.value }))} autoFocus placeholder="Nome" />
                  <div style={styles.twoCol}>
                    <input style={styles.input} type="number" min="1" max="31" placeholder="~Dia recebimento"
                      value={editingSource.expected_day}
                      onChange={e => setEditingSource(es => ({ ...es, expected_day: e.target.value }))} />
                    <select style={styles.input} value={editingSource.type}
                      onChange={e => setEditingSource(es => ({ ...es, type: e.target.value }))}>
                      <option value="fixa">Fixa (mensal)</option>
                      <option value="pontual">Pontual</option>
                    </select>
                  </div>
                  {editingSource.type === 'fixa' && (
                    <input style={styles.input} type="number" step="0.01" placeholder="Valor estimado (R$)"
                      value={editingSource.estimated_amount}
                      onChange={e => setEditingSource(es => ({ ...es, estimated_amount: e.target.value }))} />
                  )}
                  <div style={styles.row}>
                    <button style={styles.btn} type="submit">Salvar</button>
                    <button type="button" onClick={() => setEditingSource(null)} style={styles.cancelBtn}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <div style={styles.sourceRow}>
                  <div style={styles.sourceInfo}>
                    <span style={styles.sourceName}>{s.name}</span>
                    <span style={styles.sourceMeta}>
                      {s.type === 'fixa' ? '🔁 Fixa' : '⚡ Pontual'}
                      {s.expected_day ? ` · ~dia ${s.expected_day}` : ''}
                      {s.type === 'fixa' && s.estimated_amount ? ` · ${formatCurrency(s.estimated_amount)}` : ''}
                    </span>
                  </div>
                  <button onClick={() => setEditingSource({ id: s.id, name: s.name, expected_day: s.expected_day || '', type: s.type || 'fixa', estimated_amount: s.estimated_amount || '' })} style={styles.editSmall}>✎</button>
                  <button onClick={() => deleteSource(s.id)} style={styles.deleteSmall}>✕</button>
                </div>
              )}
            </div>
          ))}

          {/* Formulário nova fonte */}
          <form onSubmit={addSource} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div style={styles.twoCol}>
              <input style={styles.input} placeholder="Nova fonte (ex: Salário CLT)"
                value={newSource.person_id === person.id ? newSource.name : ''}
                onChange={e => setNewSource({ ...newSource, person_id: person.id, name: e.target.value })}
                onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))} />
              <select style={styles.input}
                value={newSource.person_id === person.id ? newSource.type : 'fixa'}
                onChange={e => setNewSource(s => ({ ...s, person_id: person.id, type: e.target.value }))}
                onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))}>
                <option value="fixa">Fixa (mensal)</option>
                <option value="pontual">Pontual</option>
              </select>
            </div>
            <div style={styles.twoCol}>
              <input style={styles.input} placeholder="~Dia recebimento" type="number" min="1" max="31"
                value={newSource.person_id === person.id ? newSource.expected_day : ''}
                onChange={e => setNewSource(s => ({ ...s, person_id: person.id, expected_day: e.target.value }))}
                onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))} />
              {(newSource.person_id === person.id ? newSource.type : 'fixa') === 'fixa' && (
                <input style={styles.input} type="number" step="0.01" placeholder="Valor estimado (R$)"
                  value={newSource.person_id === person.id ? newSource.estimated_amount : ''}
                  onChange={e => setNewSource(s => ({ ...s, person_id: person.id, estimated_amount: e.target.value }))}
                  onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))} />
              )}
            </div>
            <button style={styles.btn} type="submit">+ Adicionar fonte</button>
          </form>
        </Card>
      ))}
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  msg: { background: '#d1fae5', color: '#065f46', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 14 },
  row: { display: 'flex', gap: 8 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  input: { flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 },
  personHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  actionGroup: { display: 'flex', gap: 6 },
  editBtn: { background: '#eff6ff', color: '#1a56db', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  deleteBtn: { background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  editSmall: { background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
  deleteSmall: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
  subLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, marginTop: 8 },
  sourceRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  sourceInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  sourceName: { fontSize: 14, fontWeight: 500 },
  sourceMeta: { fontSize: 12, color: '#64748b' },
}
