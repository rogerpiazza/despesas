import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Card, { CardTitle } from '../components/Card'

export default function Pessoas() {
  const [people, setPeople] = useState([])
  const [sources, setSources] = useState([])
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState({ person_id: '', name: '', expected_day: '' })
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
    })
    if (error) return setMsg('Erro: ' + error.message)
    setNewSource({ person_id: newSource.person_id, name: '', expected_day: '' })
    setMsg('Fonte de renda adicionada!')
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
          <input
            style={styles.input}
            placeholder="Nome da pessoa"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button style={styles.btn} type="submit">Adicionar</button>
        </form>
      </Card>

      {loading ? null : people.map(person => (
        <Card key={person.id}>
          <div style={styles.personHeader}>
            <CardTitle>{person.name}</CardTitle>
            <button onClick={() => deletePerson(person.id)} style={styles.deleteBtn}>Remover</button>
          </div>

          <p style={styles.subLabel}>Fontes de renda:</p>
          {sources.filter(s => s.person_id === person.id).map(s => (
            <div key={s.id} style={styles.sourceRow}>
              <span style={styles.sourceName}>{s.name}</span>
              {s.expected_day && <span style={styles.sourceDay}>~dia {s.expected_day}</span>}
              <button onClick={() => deleteSource(s.id)} style={styles.deleteSmall}>✕</button>
            </div>
          ))}

          <form onSubmit={addSource} style={{ ...styles.row, marginTop: 10 }}>
            <input
              style={{ ...styles.input, flex: 2 }}
              placeholder="Nova fonte (ex: Salário CLT)"
              value={newSource.person_id === person.id ? newSource.name : ''}
              onChange={e => setNewSource({ person_id: person.id, name: e.target.value, expected_day: newSource.expected_day })}
              onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))}
            />
            <input
              style={{ ...styles.input, flex: 1, maxWidth: 90 }}
              placeholder="~Dia"
              type="number"
              min="1"
              max="31"
              value={newSource.person_id === person.id ? newSource.expected_day : ''}
              onChange={e => setNewSource(s => ({ ...s, person_id: person.id, expected_day: e.target.value }))}
              onFocus={() => setNewSource(s => ({ ...s, person_id: person.id }))}
            />
            <button style={styles.btn} type="submit">+</button>
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
  input: { flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  personHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  deleteBtn: { background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  deleteSmall: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
  subLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  sourceRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  sourceName: { flex: 1, fontSize: 14 },
  sourceDay: { fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '2px 6px' },
}
