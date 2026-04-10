import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Card, { CardTitle } from '../components/Card'

export default function Pessoas() {
  const [people, setPeople] = useState([])
  const [newName, setNewName] = useState('')
  const [editingPerson, setEditingPerson] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('people').select('*').order('name')
    setPeople(data || [])
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

  return (
    <div>
      <h1 style={styles.title}>Pessoas</h1>
      {msg && <div style={styles.msg}>{msg}</div>}

      <Card>
        <CardTitle>Adicionar Pessoa</CardTitle>
        <form onSubmit={addPerson} style={styles.row}>
          <input style={styles.input} placeholder="Nome da pessoa" value={newName}
            onChange={e => setNewName(e.target.value)} />
          <button style={styles.btn} type="submit">Adicionar</button>
        </form>
      </Card>

      {people.length > 0 && (
        <Card>
          <CardTitle>Pessoas cadastradas</CardTitle>
          {people.map(person => (
            <div key={person.id} style={styles.personRow}>
              {editingPerson?.id === person.id ? (
                <form onSubmit={savePerson} style={{ ...styles.row, flex: 1 }}>
                  <input style={styles.input} value={editingPerson.name} autoFocus
                    onChange={e => setEditingPerson(p => ({ ...p, name: e.target.value }))} />
                  <button style={styles.btn} type="submit">Salvar</button>
                  <button type="button" onClick={() => setEditingPerson(null)} style={styles.cancelBtn}>✕</button>
                </form>
              ) : (
                <>
                  <span style={styles.personName}>{person.name}</span>
                  <button onClick={() => setEditingPerson({ id: person.id, name: person.name })} style={styles.editBtn}>✎</button>
                  <button onClick={() => deletePerson(person.id)} style={styles.deleteBtn}>✕</button>
                </>
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
  row: { display: 'flex', gap: 8 },
  input: { flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  btn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 },
  personRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  personName: { flex: 1, fontSize: 15, fontWeight: 500 },
  editBtn: { background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', fontSize: 15, padding: '2px 6px' },
  deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '2px 6px' },
}
