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

    const [incRes, fixedSourcesRes, billMonthRes, fixedBillRes] = await Promise.all([
      supabase.from('income_entries').select('*, income_sources(name), people(name)').eq('month_year', month).order('received_date'),
      supabase.from('income_sources').select('*, people(name)').eq('type', 'fixa'),
      supabase.from('bill_month_entries').select('*, fixed_bills(name, due_day)').eq('month_year', month),
      supabase.from('fixed_bills').select('*').eq('active', true).order('due_day'),
    ])

    // Projeta rendas fixas (sempre usa estimated_amount + expected_day para sugestão)
    const realEntries = (incRes.data || [])
    const realSourceIds = new Set(realEntries.map(e => e.income_source_id))
    const projected = (fixedSourcesRes.data || [])
      .filter(s => !realSourceIds.has(s.id) && s.estimated_amount)
      .map(s => {
        // Monta uma data fictícia no mês atual usando expected_day para o algoritmo de timing
        let received_date = null
        if (s.expected_day) {
          const [y, m] = month.split('-')
          const day = String(s.expected_day).padStart(2, '0')
          received_date = `${y}-${m}-${day}`
        }
        return {
          income_source_id: s.id,
          person_id: s.person_id,
          person_name: s.people?.name,
          income_source_name: s.name,
          amount: s.estimated_amount,
          received_date,
        }
      })

    const incomes = [
      ...realEntries.map(i => ({ ...i, person_name: i.people?.name, income_source_name: i.income_sources?.name })),
      ...projected,
    ]

    const billMonthMap = {}
    for (const bm of (billMonthRes.data || [])) billMonthMap[bm.bill_id] = bm

    const bills = (fixedBillRes.data || []).map(fb => {
      const bm = billMonthMap[fb.id]
      return {
        id: bm?.id || fb.id,
        bill_id: fb.id,
        name: fb.name,
        due_day: fb.due_day,
        amount: bm?.amount ?? fb.estimated_amount ?? 0,
      }
    }).filter(b => b.amount > 0)

    const sugg = calculateSuggestions(incomes, bills)
    setSuggestions(sugg)

    const grouped = {}
    for (const s of sugg) {
      if (!grouped[s.payer_id]) {
        grouped[s.payer_id] = { name: s.payer_name, bills: [], total: 0, proportion: s.proportion }
      }
      grouped[s.payer_id].bills.push(s)
      grouped[s.payer_id].total += s.amount
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
                    <span style={styles.billName}>
                      {s.bill.name}
                      {s.split && <span style={styles.splitBadge}> (divisão)</span>}
                    </span>
                    <span style={styles.billMeta}>
                      vence dia {s.bill.due_day} · pagar com {s.income_name}
                      {s.income_date ? ` (recebido ${formatDate(s.income_date)})` : ''}
                    </span>
                    {s.split && (
                      <span style={styles.billMetaSplit}>Total da conta: {formatCurrency(s.bill.amount)}</span>
                    )}
                  </div>
                  <span style={styles.billAmount}>{formatCurrency(s.amount)}</span>
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
  billMetaSplit: { fontSize: 12, color: '#9333ea', marginTop: 1 },
  splitBadge: { fontSize: 11, color: '#9333ea', fontWeight: 600 },
  billAmount: { fontWeight: 700, color: '#374151', minWidth: 90, textAlign: 'right' },
  personTotal: { display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, fontWeight: 600 },
  totalValue: { fontSize: 16, fontWeight: 700 },
}
