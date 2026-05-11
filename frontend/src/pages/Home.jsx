import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { Users, BookOpen, Activity, RefreshCw } from 'lucide-react'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const [indicadores, setIndicadores] = useState({
    usuarios: 0,
    cursos: 0,
    apiStatus: 'Verificando...'
  })

  useEffect(() => {
    const cargarIndicadores = async () => {
      try {
        const [usersRes, coursesRes] = await Promise.all([
          axios.get('/sync/preview/students'),
          axios.get('/sync/preview/courses')
        ])
        const users = usersRes.data?.body || []
        const courses = coursesRes.data?.body || []
        setIndicadores({
          usuarios: users.length,
          cursos: courses.length,
          apiStatus: 'Activa'
        })
      } catch {
        setIndicadores(prev => ({ ...prev, apiStatus: 'Error' }))
      }
    }
    cargarIndicadores()
  }, [])

  const acciones = [
    { label: 'Usuarios Plataforma', icon: Users, path: '/sync/usuarios' },
    { label: 'Matrículas', icon: BookOpen, path: '/sync/matriculas' },
    { label: 'Cursos', icon: Activity, path: '/sync/cursos' },
  ]

  return (
    <div className="home">
      <div className="home-header">
        <div>
          <h2>Hola, Usuario</h2>
          <p className="home-subtitle">Recursos más usados</p>
        </div>
        <div className="home-sync-btns">
          <button className="btn-sync" onClick={() => navigate('/sync/usuarios')}>
            <RefreshCw size={14} /> Sync Usuarios
          </button>
          <button className="btn-sync btn-sync-secondary" onClick={() => navigate('/sync/matriculas')}>
            <RefreshCw size={14} /> Sync Matrículas
          </button>
          <button className="btn-sync btn-sync-outline" onClick={() => navigate('/sync/cursos')}>
            <RefreshCw size={14} /> Sync Cursos
          </button>
        </div>
      </div>

      <div className="home-cards">
        {acciones.map(a => {
          const Icon = a.icon
          return (
            <button key={a.path} className="home-card" onClick={() => navigate(a.path)}>
              <Icon size={28} strokeWidth={1.5} className="home-card-icon" />
              <span className="home-card-label">{a.label}</span>
            </button>
          )
        })}
      </div>

      <div className="home-panel">
        <h5>Indicadores</h5>
        <div className="home-indicators">
          <div className="indicator-card">
            <Users size={24} strokeWidth={1.5} className="indicator-icon" />
            <span className="indicator-value">{indicadores.usuarios}</span>
            <span className="indicator-label">Usuarios en BD</span>
          </div>
          <div className="indicator-card">
            <BookOpen size={24} strokeWidth={1.5} className="indicator-icon" />
            <span className="indicator-value">{indicadores.cursos}</span>
            <span className="indicator-label">Cursos</span>
          </div>
          <div className="indicator-card">
            <Activity size={24} strokeWidth={1.5} className="indicator-icon" />
            <span className="indicator-value indicator-status">{indicadores.apiStatus}</span>
            <span className="indicator-label">Estado API</span>
          </div>
        </div>
      </div>
    </div>
  )
}