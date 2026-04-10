import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pessoas from './pages/Pessoas'
import Rendas from './pages/Rendas'
import ContasFixas from './pages/ContasFixas'
import Sugestao from './pages/Sugestao'
import Extras from './pages/Extras'
import Encontro from './pages/Encontro'

const ALLOWED_EMAILS = ['rogerpiazza@gmail.com', 'simone.guterress@gmail.com']

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = carregando
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSession(session) {
    if (!session) {
      setSession(null)
      setDenied(false)
      return
    }
    const email = session.user?.email
    if (!ALLOWED_EMAILS.includes(email)) {
      await supabase.auth.signOut()
      setSession(null)
      setDenied(true)
      return
    }
    setSession(session)
    setDenied(false)
  }

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <p style={{ color: '#64748b' }}>Carregando...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        {denied && (
          <div style={{ background: '#fee2e2', color: '#dc2626', textAlign: 'center', padding: '12px', fontSize: 14 }}>
            Email não autorizado. Acesso negado.
          </div>
        )}
        <Login />
      </>
    )
  }

  return (
    <HashRouter>
      <Layout session={session}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pessoas" element={<Pessoas />} />
          <Route path="/rendas" element={<Rendas />} />
          <Route path="/contas" element={<ContasFixas />} />
          <Route path="/sugestao" element={<Sugestao />} />
          <Route path="/extras" element={<Extras />} />
          <Route path="/encontro" element={<Encontro />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
