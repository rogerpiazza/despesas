import { currentMonthYear, formatMonthYear } from '../lib/helpers'

export default function MonthSelector({ value, onChange }) {
  function prev() {
    const [y, m] = value.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function next() {
    const [y, m] = value.split('-').map(Number)
    const d = new Date(y, m, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div style={styles.wrap}>
      <button onClick={prev} style={styles.btn}>‹</button>
      <span style={styles.label}>{formatMonthYear(value)}</span>
      <button onClick={next} style={styles.btn}>›</button>
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  btn: { background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 18, cursor: 'pointer' },
  label: { fontWeight: 700, fontSize: 17, minWidth: 160, textAlign: 'center' },
}
