import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatMonthYear, calculateSettlement } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonthYear())
  const [data, setData] = useState({ incomes: [], bills: [], extras: [], billPayments: [] })
  const [settlementRecord, setSettlementRecord] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)
    const [incRes, fixedSourcesRes, billPayRes, extRes, billMonthRes, fixedBillRes, settlRes] = await Promise.all([
      supabase.from('income_entries').select('*, people(name), income_sources(name, type)').eq('month_year', month),
      supabase.from('income_sources').select('*, people(name)').eq('type', 'fixa'),
      supabase.from('bill_month_entries').select('*, fixed_bills(name, due_day), people(name)').eq('month_year', month).not('paid_by', 'is', null),
      supabase.from('extra_expenses').select('*, people(name)').eq('month_year', month),
      supabase.from('bill_month_entries').select('bill_id, amount').eq('month_year', month),
      supabase.from('fixed_bills').select('id, estimated_amount').eq('active', true),
      supabase.from('settlements').select('*, from_person:from_person_id(name), to_person:to_person_id(name)').eq('month_year', month).maybeSingle(),
    ])

    // Entradas reais
    const realEntries = (incRes.data || [])
    const realSourceIds = new Set(realEntries.map(e => e.income_source_id))

    // Projeta rendas fixas sem entrada no mês
    const projected = (fixedSourcesRes.data || [])
      .filter(s => !realSourceIds.has(s.id) && s.estimated_amount)
      .map(s => ({
        income_source_id: s.id,
        person_id: s.person_id,
        person_name: s.people?.name,
        income_source_name: s.name,
        amount: s.estimated_amount,
        received_date: null,
      }))

    const incomes = [
      ...realEntries.map(i => ({ ...i, person_name: i.people?.name, income_source_name: i.income_sources?.name })),
      ...projected,
    ]

    const billPayments = (billPayRes.data || []).map(b => ({ ...b, person_name: b.people?.name }))
    const extras = (extRes.data || []).map(e => ({ ...e, person_name: e.people?.name }))

    const billMonthMap = {}
    for (const bm of (billMonthRes.data || [])) billMonthMap[bm.bill_id] = bm.amount
    const billMonths = (fixedBillRes.data || []).map(fb => ({
      amount: billMonthMap[fb.id] ?? fb.estimated_amount ?? 0,
    }))

    setData({ incomes, billPayments, extras, billMonths })
    setSettlementRecord(settlRes.data || null)
    setLoading(false)
  }

  const totalIncome = data.incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalBills = data.billMonths?.reduce((s, b) => s + Number(b.amount), 0) || 0
  const totalExtras = data.extras.reduce((s, e) => s + Number(e.amount), 0)
  const totalOut = totalBills + totalExtras
  const balance = totalIncome - totalOut

  const settlement = calculateSettlement(data.incomes, data.billPayments, data.extras)

  return (
    <div>
      <MonthSelector value={month} onChange={setMonth} />

      <div style={styles.grid}>
        <SummaryCard label="Total de Rendas" value={formatCurrency(totalIncome)} color="#1a56db" />
        <SummaryCard label="Contas Fixas" value={formatCurrency(totalBills)} color="#dc2626" />
        <SummaryCard label="Extras" value={formatCurrency(totalExtras)} color="#d97706" />
        <SummaryCard label="Saldo" value={formatCurrency(balance)} color={balance >= 0 ? '#16a34a' : '#dc2626'} />
      </div>

      <Card>
        <CardTitle>Rendas por Pessoa</CardTitle>
        {loading ? <p style={styles.muted}>Carregando...</p> : settlement.people.length === 0 ? (
          <p style={styles.muted}>Nenhuma renda lançada neste mês.</p>
        ) : settlement.people.map(p => (
          <div key={p.person_id} style={styles.personRow}>
            <span style={styles.personName}>{p.person_name}</span>
            <span style={styles.personIncome}>{formatCurrency(p.income)}</span>
            <span style={styles.personProp}>({(p.proportion * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </Card>

      <Card>
        <CardTitle>Encontro Rápido</CardTitle>
        {settlementRecord ? (
          <p style={{ color: '#16a34a', fontWeight: 600 }}>
            ✓ Encontro realizado — {settlementRecord.from_person?.name} transferiu {formatCurrency(settlementRecord.amount)} para {settlementRecord.to_person?.name}
          </p>
        ) : settlement.transfer ? (
          <div style={styles.transfer}>
            <span style={styles.transferFrom}>{settlement.transfer.from}</span>
            <span style={styles.transferArrow}> deve transferir </span>
            <span style={styles.transferAmount}>{formatCurrency(settlement.transfer.amount)}</span>
            <span style={styles.transferArrow}> para </span>
            <span style={styles.transferTo}>{settlement.transfer.to}</span>
          </div>
        ) : settlement.people.length > 0 ? (
          <p style={{ color: '#16a34a', fontWeight: 600 }}>Estão quites! ✓</p>
        ) : (
          <p style={styles.muted}>Lance as rendas e pagamentos para calcular.</p>
        )}
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ ...styles.summaryCard, borderTop: `3px solid ${color}` }}>
      <p style={styles.summaryLabel}>{label}</p>
      <p style={{ ...styles.summaryValue, color }}>{value}</p>
    </div>
  )
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  summaryCard: { background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: 700 },
  muted: { color: '#94a3b8', fontSize: 14 },
  personRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  personName: { flex: 1, fontWeight: 500 },
  personIncome: { fontWeight: 700, color: '#1a56db' },
  personProp: { color: '#64748b', fontSize: 13 },
  transfer: { fontSize: 15, lineHeight: 1.8 },
  transferFrom: { fontWeight: 700, color: '#dc2626' },
  transferTo: { fontWeight: 700, color: '#16a34a' },
  transferAmount: { fontWeight: 700, color: '#1a56db' },
  transferArrow: { color: '#64748b' },
}
