import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    })
    if (error) {
      setError('Erro ao iniciar login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>💸</div>
        <h1 style={styles.title}>Despesas</h1>
        <p style={styles.subtitle}>Controle financeiro compartilhado</p>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} onClick={handleGoogle} disabled={loading}>
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            style={styles.googleIcon}
          />
          {loading ? 'Redirecionando...' : 'Entrar com Google'}
        </button>

        <p style={styles.note}>Acesso restrito a usuários autorizados.</p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f1f5f9',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 32px',
    maxWidth: 360,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 32 },
  error: { background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 16 },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 20px',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    color: '#374151',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  googleIcon: { width: 20, height: 20 },
  note: { fontSize: 12, color: '#94a3b8', marginTop: 20 },
}
