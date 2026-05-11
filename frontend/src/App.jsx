import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import './components/Layout.css'
import Home from './pages/Home'
import SyncUsuariosP from './pages/SyncUsuariosP'
import SyncCursos from './pages/SyncCursos'
import SyncMatriculas from './pages/SyncMatriculas'
import CargaUsuarios from './pages/CargaUsuarios'
import CargaMatriculas from './pages/CargaMatriculas'
import CargaNovedades from './pages/CargaNovedades'
import CargaDesmatriculas from './pages/CargaDesmatriculas'
import Configuracion from './pages/Configuracion'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="sync/usuarios" element={<SyncUsuariosP />} />
          <Route path="sync/cursos" element={<SyncCursos />} />
          <Route path="sync/matriculas" element={<SyncMatriculas />} />
          <Route path="carga/usuarios" element={<CargaUsuarios />} />
          <Route path="carga/matriculas" element={<CargaMatriculas />} />
          <Route path="carga/novedades" element={<CargaNovedades />} />
          <Route path="carga/desmatriculas" element={<CargaDesmatriculas />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App