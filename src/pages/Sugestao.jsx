import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatDate, calculateSuggestions } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Sugestao() {
  const [month, setMonth] = useState(currentMonthYear())
  const [suggestions, setSuggestions] = useState([])
  const [byPerson, setByPerson] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)

    const [incRes, billRes] = await Promise.all([
      supabase
        .from('income_entries')
        .select('*, income_sources(name), people(name)')
        .eq('month_year', month)
        .order('received_date'),
      supabase
        .from('bill_month_entries')
        .select('*, fixed_bills(name, due_day)')
        .eq('month_year', month),
    ])

    const incomes = (incRes.data || []).map(i => ({
      ...i,
      person_name: i.people?.name,
      income_source_name: i.income_sources?.name,
    }))

    const bills = (billRes.data || []).map(b => ({
      ...b,
      name: b.fixed_bills?.name,
      due_day: b.fixed_bills?.due_day,
    })).filter(b => b.amount > 0)

    const sugg = calculateSuggestions(incomes, bills)
    setSuggestions(sugg)

    // Agrupa por pessoa
    const grouped = {}
    for (const s of sugg) {
      if (!grouped[s.payer_id]) {
        grouped[s.payer_id] = { name: s.payer_name, bills: [], total: 0, proportion: s.proportion }
      }
      grouped[s.payer_id].bills.push(s)
      grouped[s.payer_id].total += Number(s.bill.amount)
    }
    setByPerson(grouped)
    setLoading(false)
  }

  const personColors = ['#1a56db', '#7c3aed', '#dc2626', '#16a34a']

  return (
    <div>
      <h1 style={styles.title}>Sugestão de Pagamento</h1>
      <MonthSelector value={month} onChange={setMonth} />

      {loading ? (
        <Card><p style={styles.muted}>Carregando...</p></Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <p style={styles.muted}>Lance as rendas e os valores das contas fixas para ver a sugestão.</p>
        </Card>
      ) : (
        <>
          <Card style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
            <p style={{ fontSize: 13, color: '#92400e' }}>
              A sugestão considera a proporção de renda de cada pessoa e as datas de recebimento para distribuir as contas de forma justa.
            </p>
          </Card>

          {Object.entries(byPerson).map(([pid, p], idx) => (
            <Card key={pid}>
              <div style={styles.personHeader}>
                <span style={{ ...styles.personBadge, background: personColors[idx % personColors.length] }}>
                  {p.name}
                </span>
                <span style={styles.personProp}>{p.proportion}% da renda</span>
              </div>

              {p.bills.map((s, i) => (
                <div key={i} style={styles.billRow}>
                  <div style={styles.billInfo}>
                    <span style={styles.billName}>{s.bill.name}</span>
                    <span style={styles.billMeta}>
                      vence dia {s.bill.due_day} · pagar com {s.income_name}
                      {s.income_date ? ` (recebido ${formatDate(s.income_date)})` : ''}
                    </span>
                  </div>
                  <span style={styles.billAmount}>{formatCurrency(s.bill.amount)}</span>
                </div>
              ))}

              <div style={styles.personTotal}>
                <span>Total de {p.name}</span>
                <span style={{ ...styles.totalValue, color: personColors[idx % personColors.length] }}>
                  {formatCurrency(p.total)}
                </span>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#94a3b8', fontSize: 14 },
  personHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  personBadge: { color: '#fff', fontWeight: 700, borderRadius: 20, padding: '4px 14px', fontSize: 14 },
  personProp: { color: '#64748b', fontSize: 13 },
  billRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  billInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  billName: { fontSize: 14, fontWeight: 500 },
  billMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  billAmount: { fontWeight: 700, color: '#374151', minWidth: 90, textAlign: 'right' },
  personTotal: { display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, fontWeight: 600 },
  totalValue: { fontSize: 16, fontWeight: 700 },
}
