import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import {
  Home, RefreshCw, BookOpen, Upload, Shield,
  Link, FileText, BarChart2, Search, Settings,
  ChevronDown, Menu, User, Users, BookMarked,
  GraduationCap, FileUp, Bell, UserMinus
} from 'lucide-react'

const menuItems = [
  { label: 'Home', icon: Home, path: '/' },
  {
    label: 'Sincronización', icon: RefreshCw, children: [
      { label: 'Usuarios Plataforma', path: '/sync/usuarios' },
      { label: 'Matrículas', path: '/sync/matriculas' },
      { label: 'Cursos', path: '/sync/cursos' },
    ]
  },
  {
    label: 'Módulos', icon: BookOpen, children: [
      { label: 'Usuarios', path: '/modulos/usuarios' },
      { label: 'Cursos y categorías', path: '/modulos/cursos' },
      { label: 'Matrículas', path: '/modulos/matriculas' },
    ]
  },
  {
    label: 'Carga Masiva', icon: Upload, children: [
      { label: 'Usuarios', path: '/carga/usuarios' },
      { label: 'Matrículas', path: '/carga/matriculas' },
      { label: 'Novedades', path: '/carga/novedades' },
      { label: 'Desmatrículas', path: '/carga/desmatriculas' },
    ]
  },
  {
    label: 'Reglas', icon: Shield, children: [
      { label: 'Reglas activas', path: '/reglas/activas' },
      { label: 'Plantillas', path: '/reglas/plantillas' },
    ]
  },
  {
    label: 'Integración', icon: Link, children: [
      { label: 'Estado de APIs', path: '/integracion/apis' },
    ]
  },
  { label: 'Reportes', icon: FileText, path: '/reportes' },
  { label: 'Estadísticas', icon: BarChart2, path: '/estadisticas' },
  { label: 'Búsqueda', icon: Search, path: '/busqueda' },
  { label: 'Configuración', icon: Settings, path: '/configuracion' },
]

function SidebarItem({ item }) {
  const [open, setOpen] = useState(false)
  const Icon = item.icon

  if (item.children) {
    return (
      <li>
        <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
          <Icon size={16} className="sidebar-icon" />
          <span>{item.label}</span>
          <ChevronDown size={14} className={`chevron ${open ? 'open' : ''}`} />
        </button>
        {open && (
          <ul className="submenu">
            {item.children.map(child => (
              <li key={child.path}>
                <NavLink to={child.path} className={({ isActive }) => isActive ? 'active' : ''}>
                  {child.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <li>
      <NavLink
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) => isActive ? 'active' : ''}
      >
        <Icon size={16} className="sidebar-icon" />
        <span>{item.label}</span>
      </NavLink>
    </li>
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={20} />
          </button>
          <span className="navbar-brand">JOURNEY</span>
        </div>
        <div className="user-menu">
          <button className="user-btn" onClick={() => setUserMenuOpen(!userMenuOpen)}>
            <User size={16} />
            <span>Usuario</span>
            <ChevronDown size={14} />
          </button>
          {userMenuOpen && (
            <ul className="user-dropdown">
              <li><a href="#">Mi Perfil</a></li>
              <li><a href="#">Ver Logs</a></li>
              <li><a href="#">Cerrar sesión</a></li>
            </ul>
          )}
        </div>
      </nav>

      <div className="app-body">
        {sidebarOpen && (
          <aside className="sidebar">
            <ul>
              {menuItems.map((item, i) => (
                <SidebarItem key={i} item={item} />
              ))}
            </ul>
          </aside>
        )}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}