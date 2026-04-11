import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatMonthYear, calculateSettlement } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

function subtractMonth(monthYear) {
  const [y, m] = monthYear.split('-').map(Number)
  const date = new Date(y, m - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function computeProjected(opening, incEntries, fixedSrcs, billMonthData, fixedBillData, extData) {
  const realSourceIds = new Set(incEntries.map(e => e.income_source_id))
  const totalIncome =
    incEntries.reduce((s, e) => s + Number(e.amount), 0) +
    (fixedSrcs || []).filter(s => !realSourceIds.has(s.id) && s.estimated_amount)
      .reduce((s, src) => s + Number(src.estimated_amount), 0)
  const billMap = {}
  for (const bm of (billMonthData || [])) billMap[bm.bill_id] = bm.amount
  const totalBills = (fixedBillData || []).reduce((s, fb) => s + Number(billMap[fb.id] ?? fb.estimated_amount ?? 0), 0)
  const totalExtras = (extData || []).reduce((s, e) => s + Number(e.amount), 0)
  return opening + totalIncome - totalBills - totalExtras
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonthYear())
  const [data, setData] = useState({ incomes: [], bills: [], extras: [], billMonths: [], billPayments: [] })
  const [settlementRecord, setSettlementRecord] = useState(null)
  const [cashRecord, setCashRecord] = useState(null)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [carryOver, setCarryOver] = useState(false)
  const [editingBalance, setEditingBalance] = useState(null) // null = not editing, string = editing
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { load() }, [month])

  async function exportCSV() {
    setExporting(true)
    const [incRes, fixedSrcRes, billMonthRes, fixedBillRes, extRes] = await Promise.all([
      supabase.from('income_entries').select('*, income_sources(name, type), people(name)').eq('month_year', month),
      supabase.from('income_sources').select('*, people(name)').eq('type', 'fixa'),
      supabase.from('bill_month_entries').select('*, fixed_bills(name, due_day), people(name)').eq('month_year', month),
      supabase.from('fixed_bills').select('*').eq('active', true),
      supabase.from('extra_expenses').select('*, people(name)').eq('month_year', month),
    ])

    const rows = [['Tipo', 'Descrição', 'Pessoa', 'Valor (R$)', 'Data', 'Status']]

    // Rendas recebidas
    const realSourceIds = new Set((incRes.data || []).map(e => e.income_source_id))
    for (const e of (incRes.data || [])) {
      rows.push(['Renda', e.income_sources?.name || '', e.people?.name || '', e.amount, e.received_date || '', 'Recebido'])
    }
    // Rendas fixas projetadas
    for (const s of (fixedSrcRes.data || []).filter(s => !realSourceIds.has(s.id) && s.estimated_amount)) {
      rows.push(['Renda', s.name, s.people?.name || '', s.estimated_amount, '', 'Projetado'])
    }

    // Contas Fixas
    const billMonthMap = {}
    for (const bm of (billMonthRes.data || [])) billMonthMap[bm.bill_id] = bm
    for (const fb of (fixedBillRes.data || [])) {
      const bm = billMonthMap[fb.id]
      const amount = bm?.amount ?? fb.estimated_amount ?? 0
      const status = bm?.paid_by ? 'Pago' : 'Não pago'
      rows.push(['Conta Fixa', fb.name, bm?.people?.name || '', amount, bm?.paid_date || '', status])
    }

    // Extras
    for (const e of (extRes.data || [])) {
      rows.push(['Extra', e.description, e.people?.name || '', e.amount, e.expense_date || '', 'Pago'])
    }

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `despesas-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  async function load() {
    setLoading(true)
    const prevMonth = subtractMonth(month)

    const [
      incRes, fixedSourcesRes, billPayRes, extRes, billMonthRes, fixedBillRes, settlRes, cashRes,
      prevCashRes, prevIncRes, prevBillMonthRes, prevExtRes,
    ] = await Promise.all([
      supabase.from('income_entries').select('*, people(name), income_sources(name, type)').eq('month_year', month),
      supabase.from('income_sources').select('*, people(name)').eq('type', 'fixa'),
      supabase.from('bill_month_entries').select('*, fixed_bills(name, due_day), people(name)').eq('month_year', month).not('paid_by', 'is', null),
      supabase.from('extra_expenses').select('*, people(name)').eq('month_year', month),
      supabase.from('bill_month_entries').select('bill_id, amount').eq('month_year', month),
      supabase.from('fixed_bills').select('id, estimated_amount').eq('active', true),
      supabase.from('settlements').select('*, from_person:from_person_id(name), to_person:to_person_id(name)').eq('month_year', month).maybeSingle(),
      supabase.from('monthly_cash').select('*').eq('month_year', month).maybeSingle(),
      supabase.from('monthly_cash').select('opening_balance').eq('month_year', prevMonth).maybeSingle(),
      supabase.from('income_entries').select('income_source_id, amount').eq('month_year', prevMonth),
      supabase.from('bill_month_entries').select('bill_id, amount').eq('month_year', prevMonth),
      supabase.from('extra_expenses').select('amount').eq('month_year', prevMonth),
    ])

    const realEntries = incRes.data || []
    const realSourceIds = new Set(realEntries.map(e => e.income_source_id))
    const projected = (fixedSourcesRes.data || [])
      .filter(s => !realSourceIds.has(s.id) && s.estimated_amount)
      .map(s => ({ income_source_id: s.id, person_id: s.person_id, person_name: s.people?.name, income_source_name: s.name, amount: s.estimated_amount, received_date: null }))

    const incomes = [
      ...realEntries.map(i => ({ ...i, person_name: i.people?.name, income_source_name: i.income_sources?.name })),
      ...projected,
    ]
    const billPayments = (billPayRes.data || []).map(b => ({ ...b, person_name: b.people?.name }))
    const extras = (extRes.data || []).map(e => ({ ...e, person_name: e.people?.name }))
    const billMonthMap = {}
    for (const bm of (billMonthRes.data || [])) billMonthMap[bm.bill_id] = bm.amount
    const billMonths = (fixedBillRes.data || []).map(fb => ({ amount: billMonthMap[fb.id] ?? fb.estimated_amount ?? 0 }))

    setData({ incomes, billPayments, extras, billMonths })
    setSettlementRecord(settlRes.data || null)

    // Saldo inicial
    if (cashRes.data) {
      setCashRecord(cashRes.data)
      setOpeningBalance(Number(cashRes.data.opening_balance))
      setCarryOver(false)
    } else {
      setCashRecord(null)
      if (prevCashRes.data) {
        const prevProjected = computeProjected(
          Number(prevCashRes.data.opening_balance),
          prevIncRes.data || [],
          fixedSourcesRes.data || [],
          prevBillMonthRes.data || [],
          fixedBillRes.data || [],
          prevExtRes.data || [],
        )
        setOpeningBalance(prevProjected)
        setCarryOver(true)
      } else {
        setOpeningBalance(0)
        setCarryOver(false)
      }
    }

    setEditingBalance(null)
    setLoading(false)
  }

  async function saveOpeningBalance() {
    const val = parseFloat(editingBalance) || 0
    if (cashRecord) {
      await supabase.from('monthly_cash').update({ opening_balance: val }).eq('id', cashRecord.id)
    } else {
      await supabase.from('monthly_cash').insert({ month_year: month, opening_balance: val })
    }
    load()
  }

  const totalIncome = data.incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalBills = data.billMonths?.reduce((s, b) => s + Number(b.amount), 0) || 0
  const totalExtras = data.extras.reduce((s, e) => s + Number(e.amount), 0)
  const totalOut = totalBills + totalExtras
  const balance = totalIncome - totalOut
  const projectedBalance = openingBalance + totalIncome - totalBills - totalExtras

  const settlement = calculateSettlement(data.incomes, data.billPayments, data.extras)

  return (
    <div>
      <MonthSelector value={month} onChange={setMonth} />

      {/* DRE */}
      <Card>
        <div style={styles.dreHeader}>
          <CardTitle>Fluxo de Caixa — {formatMonthYear(month)}</CardTitle>
          <div style={{ display: 'flex', gap: 6 }}>
            {editingBalance === null && (
              <button style={styles.editBalanceBtn} onClick={() => setEditingBalance(String(openingBalance))}>
                ✎ saldo inicial
              </button>
            )}
            <button style={styles.exportBtn} onClick={exportCSV} disabled={exporting}>
              {exporting ? '...' : '⬇ CSV'}
            </button>
          </div>
        </div>

        {editingBalance !== null && (
          <div style={styles.balanceEditBlock}>
            <label style={styles.label}>Saldo inicial (R$)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={styles.balanceInput} type="number" step="0.01" value={editingBalance}
                onChange={e => setEditingBalance(e.target.value)} autoFocus />
              <button style={styles.saveBtn} onClick={saveOpeningBalance}>Salvar</button>
              <button style={styles.cancelBtn} onClick={() => setEditingBalance(null)}>✕</button>
            </div>
          </div>
        )}

        <div style={styles.dreRow}>
          <span style={styles.dreLabel}>Saldo Inicial</span>
          <div style={styles.dreRight}>
            <span style={styles.dreValue}>{formatCurrency(openingBalance)}</span>
            {carryOver && <span style={styles.carryTag}>↑ mês anterior</span>}
          </div>
        </div>
        <div style={styles.dreRow}>
          <span style={{ ...styles.dreLabel, color: '#16a34a' }}>(+) Rendas</span>
          <span style={{ ...styles.dreValue, color: '#16a34a' }}>{formatCurrency(totalIncome)}</span>
        </div>
        <div style={styles.dreRow}>
          <span style={{ ...styles.dreLabel, color: '#dc2626' }}>(-) Contas Fixas</span>
          <span style={{ ...styles.dreValue, color: '#dc2626' }}>{formatCurrency(totalBills)}</span>
        </div>
        <div style={styles.dreRow}>
          <span style={{ ...styles.dreLabel, color: '#d97706' }}>(-) Extras</span>
          <span style={{ ...styles.dreValue, color: '#d97706' }}>{formatCurrency(totalExtras)}</span>
        </div>
        <div style={styles.dreSeparator} />
        <div style={styles.dreTotalRow}>
          <span style={styles.dreTotalLabel}>Saldo Projetado</span>
          <span style={{ ...styles.dreTotalValue, color: projectedBalance >= 0 ? '#16a34a' : '#dc2626' }}>
            {formatCurrency(projectedBalance)}
          </span>
        </div>
      </Card>

      {/* Cards resumo */}
      <div style={styles.grid}>
        <SummaryCard label="Total de Rendas" value={formatCurrency(totalIncome)} color="#1a56db" />
        <SummaryCard label="Contas Fixas" value={formatCurrency(totalBills)} color="#dc2626" />
        <SummaryCard label="Extras" value={formatCurrency(totalExtras)} color="#d97706" />
        <SummaryCard label="Resultado do Mês" value={formatCurrency(balance)} color={balance >= 0 ? '#16a34a' : '#dc2626'} />
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
  dreHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  editBalanceBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, color: '#64748b', fontSize: 12, padding: '3px 10px', cursor: 'pointer' },
  exportBtn: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, color: '#1a56db', fontSize: 12, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 },
  balanceEditBlock: { background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  balanceInput: { flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  saveBtn: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  cancelBtn: { background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 },
  dreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  dreLabel: { fontSize: 14, color: '#374151' },
  dreRight: { display: 'flex', alignItems: 'center', gap: 8 },
  dreValue: { fontSize: 15, fontWeight: 600 },
  carryTag: { fontSize: 11, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '2px 6px' },
  dreSeparator: { borderTop: '1px solid #e2e8f0', margin: '8px 0' },
  dreTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dreTotalLabel: { fontSize: 15, fontWeight: 700 },
  dreTotalValue: { fontSize: 20, fontWeight: 700 },
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
