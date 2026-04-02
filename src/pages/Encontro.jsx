import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, calculateSettlement } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Encontro() {
  const [month, setMonth] = useState(currentMonthYear())
  const [settlement, setSettlement] = useState({ people: [], totalPaid: 0, grandTotal: 0, transfer: null })
  const [detail, setDetail] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)

    const [incRes, billPayRes, extRes] = await Promise.all([
      supabase.from('income_entries').select('*, people(name)').eq('month_year', month),
      supabase.from('bill_month_entries')
        .select('*, fixed_bills(name), people(name)')
        .eq('month_year', month)
        .not('paid_by', 'is', null),
      supabase.from('extra_expenses').select('*, people(name)').eq('month_year', month),
    ])

    const incomes = (incRes.data || []).map(i => ({ ...i, person_name: i.people?.name }))
    const billPayments = (billPayRes.data || []).map(b => ({
      ...b,
      person_name: b.people?.name,
      description: b.fixed_bills?.name,
    }))
    const extras = (extRes.data || []).map(e => ({ ...e, person_name: e.people?.name }))

    const s = calculateSettlement(incomes, billPayments, extras)
    setSettlement(s)

    // Detalhe de pagamentos por pessoa
    const allPayments = [
      ...billPayments.map(b => ({ type: 'Conta Fixa', description: b.description, amount: Number(b.amount), person_id: b.paid_by, person_name: b.person_name })),
      ...extras.map(e => ({ type: 'Extra', description: e.description, amount: Number(e.amount), person_id: e.paid_by, person_name: e.person_name })),
    ]
    setDetail(allPayments)
    setLoading(false)
  }

  const personColors = ['#1a56db', '#7c3aed']

  return (
    <div>
      <h1 style={styles.title}>Encontro de Contas</h1>
      <MonthSelector value={month} onChange={setMonth} />

      {loading ? (
        <Card><p style={styles.muted}>Carregando...</p></Card>
      ) : settlement.people.length === 0 ? (
        <Card><p style={styles.muted}>Lance rendas e pagamentos para calcular o encontro.</p></Card>
      ) : (
        <>
          {settlement.transfer ? (
            <Card style={{ background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
              <CardTitle>Resultado</CardTitle>
              <p style={styles.transferText}>
                <strong style={{ color: '#dc2626' }}>{settlement.transfer.from}</strong>
                {' deve transferir '}
                <strong style={{ color: '#1a56db', fontSize: 18 }}>{formatCurrency(settlement.transfer.amount)}</strong>
                {' para '}
                <strong style={{ color: '#16a34a' }}>{settlement.transfer.to}</strong>
              </p>
            </Card>
          ) : (
            <Card style={{ background: '#d1fae5', borderLeft: '4px solid #16a34a' }}>
              <p style={{ color: '#065f46', fontWeight: 600, fontSize: 15 }}>Estão quites este mês! ✓</p>
            </Card>
          )}

          <Card>
            <CardTitle>Detalhamento por Pessoa</CardTitle>
            {settlement.people.map((p, idx) => (
              <div key={p.person_id} style={{ ...styles.personBlock, borderTop: idx > 0 ? '1px solid #e2e8f0' : 'none' }}>
                <div style={styles.personHeader}>
                  <span style={{ ...styles.personBadge, background: personColors[idx % personColors.length] }}>
                    {p.person_name}
                  </span>
                  <span style={styles.personProp}>{(p.proportion * 100).toFixed(1)}% da renda</span>
                </div>

                <div style={styles.statGrid}>
                  <Stat label="Renda" value={formatCurrency(p.income)} color="#16a34a" />
                  <Stat label="Pagou" value={formatCurrency(p.paid)} color="#374151" />
                  <Stat label="Deveria pagar" value={formatCurrency(p.shouldPay)} color="#64748b" />
                  <Stat
                    label={p.balance >= 0 ? 'Pagou a mais' : 'Pagou a menos'}
                    value={formatCurrency(Math.abs(p.balance))}
                    color={p.balance >= 0 ? '#16a34a' : '#dc2626'}
                  />
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <CardTitle>Histórico de Pagamentos</CardTitle>
            {detail.length === 0 ? (
              <p style={styles.muted}>Nenhum pagamento registrado.</p>
            ) : detail.map((d, i) => (
              <div key={i} style={styles.detailRow}>
                <div style={styles.detailInfo}>
                  <span style={styles.detailDesc}>{d.description}</span>
                  <span style={styles.detailType}>{d.type} · {d.person_name}</span>
                </div>
                <span style={styles.detailAmount}>{formatCurrency(d.amount)}</span>
              </div>
            ))}

            <div style={styles.totalRow}>
              <span style={{ fontWeight: 700 }}>Total Pago</span>
              <span style={{ fontWeight: 700, color: '#1a56db' }}>{formatCurrency(settlement.totalPaid)}</span>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color }}>{value}</span>
    </div>
  )
}

const styles = {
  title: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#94a3b8', fontSize: 14 },
  transferText: { fontSize: 15, lineHeight: 2 },
  personBlock: { paddingTop: 14, paddingBottom: 8, marginBottom: 8 },
  personHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  personBadge: { color: '#fff', fontWeight: 700, borderRadius: 20, padding: '4px 14px', fontSize: 14 },
  personProp: { color: '#64748b', fontSize: 13 },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  stat: { background: '#f8fafc', borderRadius: 8, padding: '8px 12px' },
  statLabel: { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: 700 },
  detailRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9' },
  detailInfo: { flex: 1 },
  detailDesc: { fontSize: 14, fontWeight: 500, display: 'block' },
  detailType: { fontSize: 12, color: '#64748b' },
  detailAmount: { fontWeight: 600, color: '#374151' },
  totalRow: { display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontWeight: 600 },
}
