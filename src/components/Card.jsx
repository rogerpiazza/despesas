export default function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

export function CardTitle({ children }) {
  return <h2 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 14 }}>{children}</h2>
}
