import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/pessoas', label: 'Pessoas', icon: '👥' },
  { to: '/rendas', label: 'Rendas', icon: '💰' },
  { to: '/contas', label: 'Contas Fixas', icon: '📋' },
  { to: '/sugestao', label: 'Sugestão', icon: '💡' },
  { to: '/extras', label: 'Extras', icon: '➕' },
  { to: '/encontro', label: 'Encontro', icon: '⚖️' },
]

export default function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={styles.header}>
        <span style={styles.logo}>💸 Despesas</span>
      </header>

      <nav style={styles.nav}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  header: {
    background: '#1a56db',
    color: '#fff',
    padding: '14px 20px',
    fontSize: 18,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
  },
  logo: { letterSpacing: 0.5 },
  nav: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    overflowX: 'auto',
    padding: '0 8px',
  },
  navLink: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 12px',
    textDecoration: 'none',
    color: '#64748b',
    fontSize: 11,
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
    gap: 2,
  },
  navLinkActive: {
    color: '#1a56db',
    borderBottomColor: '#1a56db',
  },
  navIcon: { fontSize: 18 },
  navLabel: {},
  main: {
    flex: 1,
    padding: 20,
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
  },
}
