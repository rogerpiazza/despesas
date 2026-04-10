import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonthYear, formatCurrency, formatDate, formatMonthYear, calculateSettlement } from '../lib/helpers'
import MonthSelector from '../components/MonthSelector'
import Card, { CardTitle } from '../components/Card'

export default function Encontro() {
  const [month, setMonth] = useState(currentMonthYear())
  const [settlement, setSettlement] = useState({ people: [], totalPaid: 0, grandTotal: 0, transfer: null })
  const [detail, setDetail] = useState([])
  const [settlementRecord, setSettlementRecord] = useState(null)
  const [allSettlements, setAllSettlements] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ paid_date: '', notes: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [month])

  async function load() {
    setLoading(true)

    const [incRes, fixedSourcesRes, billPayRes, extRes, settlRes, allSettlRes] = await Promise.all([
      supabase.from('income_entries').select('*, people(name)').eq('month_year', month),
      supabase.from('income_sources').select('*, people(name)').eq('type', 'fixa'),
      supabase.from('bill_month_entries')
        .select('*, fixed_bills(name), people(name)')
        .eq('month_year', month)
        .not('paid_by', 'is', null),
      supabase.from('extra_expenses').select('*, people(name)').eq('month_year', month),
      supabase.from('settlements')
        .select('*, from_person:from_person_id(name), to_person:to_person_id(name)')
        .eq('month_year', month)
        .maybeSingle(),
      supabase.from('settlements')
        .select('*, from_person:from_person_id(name), to_person:to_person_id(name)')
        .order('paid_date', { ascending: false }),
    ])

    // Projeta rendas fixas sem entrada no mês
    const realEntries = (incRes.data || [])
    const realSourceIds = new Set(realEntries.map(e => e.income_source_id))
    const projected = (fixedSourcesRes.data || [])
      .filter(s => !realSourceIds.has(s.id) && s.estimated_amount)
      .map(s => ({
        income_source_id: s.id,
        person_id: s.person_id,
        person_name: s.people?.name,
        amount: s.estimated_amount,
        received_date: null,
      }))

    const incomes = [
      ...realEntries.map(i => ({ ...i, person_name: i.people?.name })),
      ...projected,
    ]

    const billPayments = (billPayRes.data || []).map(b => ({
      ...b,
      person_name: b.people?.name,
      description: b.fixed_bills?.name,
    }))
    const extras = (extRes.data || []).map(e => ({ ...e, person_name: e.people?.name }))

    const s = calculateSettlement(incomes, billPayments, extras)
    setSettlement(s)
    setSettlementRecord(settlRes.data || null)
    setAllSettlements(allSettlRes.data || [])

    const allPayments = [
      ...billPayments.map(b => ({ type: 'Conta Fixa', description: b.description, amount: Number(b.amount), person_id: b.paid_by, person_name: b.person_name })),
      ...extras.map(e => ({ type: 'Extra', description: e.description, amount: Number(e.amount), person_id: e.paid_by, person_name: e.person_name })),
    ]
    setDetail(allPayments)
    setShowForm(false)
    setLoading(false)
  }

  async function registerSettlement(e) {
    e.preventDefault()
    if (!form.paid_date || !settlement.transfer) return
    const { people } = settlement

    const fromPerson = people.find(p => p.person_name === settlement.transfer.from)
    const toPerson = people.find(p => p.person_name === settlement.transfer.to)
    if (!fromPerson || !toPerson) return

    await supabase.from('settlements').insert({
      month_year: month,
      from_person_id: fromPerson.person_id,
      to_person_id: toPerson.person_id,
      amount: settlement.transfer.amount,
      paid_date: form.paid_date,
      notes: form.notes.trim() || null,
    })

    setForm({ paid_date: '', notes: '' })
    load()
  }

  async function deleteSettlement() {
    if (!confirm('Desfazer o registro do encontro?')) return
    await supabase.from('settlements').delete().eq('id', settlementRecord.id)
    load()
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
          {!settlementRecord && (
            settlement.transfer ? (
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
            )
          )}

          {settlementRecord ? (
            <Card style={{ background: '#d1fae5', borderLeft: '4px solid #16a34a' }}>
              <div style={styles.settlDoneHeader}>
                <div>
                  <p style={styles.settlDoneTitle}>✓ Encontro realizado</p>
                  <p style={styles.settlDoneMeta}>
                    {settlementRecord.from_person?.name} transferiu {formatCurrency(settlementRecord.amount)} para {settlementRecord.to_person?.name} em {formatDate(settlementRecord.paid_date)}
                  </p>
                  {settlementRecord.notes && (
                    <p style={styles.settlDoneNotes}>"{settlementRecord.notes}"</p>
                  )}
                </div>
                <button onClick={deleteSettlement} style={styles.undoBtn}>Desfazer</button>
              </div>
            </Card>
          ) : settlement.transfer ? (
            <Card>
              <CardTitle>Registrar Transferência</CardTitle>
              {!showForm ? (
                <button style={styles.registerBtn} onClick={() => setShowForm(true)}>
                  Marcar como pago
                </button>
              ) : (
                <form onSubmit={registerSettlement} style={styles.formGrid}>
                  <div style={styles.field}>
                    <label style={styles.label}>Data da transferência</label>
                    <input style={styles.input} type="date" value={form.paid_date}
                      onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))} autoFocus />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Observação (opcional)</label>
                    <input style={styles.input} placeholder="Ex: Pix realizado" value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div style={styles.formActions}>
                    <button style={styles.confirmBtn} type="submit">Confirmar</button>
                    <button type="button" style={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
                  </div>
                </form>
              )}
            </Card>
          ) : null}

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

          {allSettlements.length > 0 && (
            <Card>
              <CardTitle>Histórico de Encontros</CardTitle>
              {allSettlements.map(s => (
                <div key={s.id} style={styles.histRow}>
                  <div style={styles.histInfo}>
                    <span style={styles.histDesc}>
                      {s.from_person?.name} → {s.to_person?.name}
                    </span>
                    <span style={styles.histMeta}>
                      {formatMonthYear(s.month_year)} · {formatDate(s.paid_date)}
                      {s.notes ? ` · "${s.notes}"` : ''}
                    </span>
                  </div>
                  <span style={styles.histAmount}>{formatCurrency(s.amount)}</span>
                </div>
              ))}
            </Card>
          )}

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
  settlDoneHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  settlDoneTitle: { fontWeight: 700, color: '#065f46', fontSize: 15, marginBottom: 4 },
  settlDoneMeta: { fontSize: 13, color: '#065f46' },
  settlDoneNotes: { fontSize: 12, color: '#047857', fontStyle: 'italic', marginTop: 4 },
  undoBtn: { background: 'none', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
  registerBtn: { background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  input: { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', width: '100%' },
  formActions: { display: 'flex', gap: 8 },
  confirmBtn: { flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  cancelBtn: { flex: 1, background: '#e2e8f0', color: '#374151', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14 },
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
  histRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
  histInfo: { flex: 1 },
  histDesc: { fontSize: 14, fontWeight: 500, display: 'block' },
  histMeta: { fontSize: 12, color: '#64748b' },
  histAmount: { fontWeight: 700, color: '#1a56db' },
}
