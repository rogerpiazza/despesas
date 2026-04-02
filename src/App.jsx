import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Pessoas from './pages/Pessoas'
import Rendas from './pages/Rendas'
import ContasFixas from './pages/ContasFixas'
import Sugestao from './pages/Sugestao'
import Extras from './pages/Extras'
import Encontro from './pages/Encontro'

export default function App() {
  return (
    <HashRouter>
      <Layout>
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
