import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { ChevronDown, ChevronUp, Pencil, Trash2, RefreshCw, Search, Filter } from 'lucide-react'
import './SyncUsuariosP.css'

const COLUMNS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'email', label: 'Email' },
  { key: 'documento', label: 'Documento' },
  { key: 'jornada', label: 'Jornada' },
  { key: 'departamento', label: 'Departamento' },
]

function StatusBadge({ row }) {
  if (row._status === 'error') return <span className="badge badge-error">Error</span>
  if (row._status === 'success') return <span className="badge badge-success">Creado</span>
  if (row._syncStatus?.inDB && row._syncStatus?.inMoodle) return <span className="badge badge-synced">Sincronizado</span>
  if (row._syncStatus?.inDB) return <span className="badge badge-db">Solo en BD</span>
  if (row._syncStatus?.inMoodle) return <span className="badge badge-moodle">Solo en Moodle</span>
  return <span className="badge badge-pending">Pendiente</span>
}

function EditModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ ...user })

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async () => {
    try {
      await axios.put(`/journey/usuarios/${user.id}`, form)
      onSave()
      onClose()
    } catch (e) {
      console.error('Error actualizando:', e.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>Editar Usuario</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-form">
          <div className="modal-section-title">Datos Básicos</div>
          <div className="modal-row">
            <div className="modal-field">
              <label>Nombre</label>
              <input name="firstname" value={form.firstname || ''} onChange={handleChange} />
            </div>
            <div className="modal-field">
              <label>Apellido</label>
              <input name="lastname" value={form.lastname || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="modal-row">
            <div className="modal-field">
              <label>Correo Institucional</label>
              <input name="email" value={form.email || ''} onChange={handleChange} />
            </div>
            <div className="modal-field">
              <label>Documento</label>
              <input name="documento" value={form.documento || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="modal-section-title">Contacto</div>
          <div className="modal-row">
            <div className="modal-field">
              <label>Correo Personal</label>
              <input name="correo_personal" value={form.correo_personal || ''} onChange={handleChange} />
            </div>
            <div className="modal-field">
              <label>Teléfono</label>
              <input name="telefono" value={form.telefono || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="modal-row">
            <div className="modal-field">
              <label>Celular</label>
              <input name="celular" value={form.celular || ''} onChange={handleChange} />
            </div>
            <div className="modal-field">
              <label>Fecha de Nacimiento</label>
              <input type="date" name="fecha_nacimiento" value={form.fecha_nacimiento ? String(form.fecha_nacimiento).split('T')[0] : ''} onChange={handleChange} />
            </div>
          </div>
          <div className="modal-section-title">Información Académica</div>
          <div className="modal-row">
            <div className="modal-field">
              <label>Jornada</label>
              <input name="jornada" value={form.jornada || ''} onChange={handleChange} />
            </div>
            <div className="modal-field">
              <label>Ciudad</label>
              <input name="city" value={form.city || ''} onChange={handleChange} />
            </div>
          </div>
          <div className="modal-field">
            <label>Departamento Académico</label>
            <input name="departamento_academico" value={form.departamento_academico || ''} onChange={handleChange} />
          </div>
          <div className="modal-field">
            <label>Plan de Estudios</label>
            <input name="plan_estudios" value={form.plan_estudios || ''} onChange={handleChange} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit}>Guardar Cambios</button>
        </div>
      </div>
    </div>
  )
}

export default function SyncUsuariosP() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterJornada, setFilterJornada] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [sortKey, setSortKey] = useState('nombre')
  const [sortDir, setSortDir] = useState('asc')
  const [expandedRows, setExpandedRows] = useState({})
  const [editUser, setEditUser] = useState(null)
  const [selected, setSelected] = useState({})
  const [page, setPage] = useState(1)
  const PER_PAGE = 15

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/sync/preview/students')
      const items = res.data?.body || []
      setUsers(items.map(u => ({
        ...u,
        nombre: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
        departamento: u.departamento_academico || '-',
        _syncStatus: u._syncStatus || { inDB: false, inMoodle: false }
      })))
    } catch (e) {
      console.error('Error cargando usuarios:', e.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = useMemo(() => {
    let data = [...users]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(u => Object.values(u).some(v => typeof v === 'string' && v.toLowerCase().includes(q)))
    }
    if (filterJornada) data = data.filter(u => u.jornada === filterJornada)
    if (filterEstado === 'sincronizado') data = data.filter(u => u._syncStatus?.inDB && u._syncStatus?.inMoodle)
    else if (filterEstado === 'solo_bd') data = data.filter(u => u._syncStatus?.inDB && !u._syncStatus?.inMoodle)
    else if (filterEstado === 'pendiente') data = data.filter(u => !u._syncStatus?.inDB)
    data.sort((a, b) => {
      const av = a[sortKey] || ''
      const bv = b[sortKey] || ''
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return data
  }, [users, search, filterJornada, filterEstado, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const jornadas = [...new Set(users.map(u => u.jornada).filter(Boolean))]

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleSelect = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }))

  const selectAll = () => {
    const allSelected = paginated.every(u => selected[u.id])
    const next = { ...selected }
    paginated.forEach(u => { next[u.id] = !allSelected })
    setSelected(next)
  }

  const selectedUsers = users.filter(u => selected[u.id])

  const handleSync = async () => {
    if (selectedUsers.length === 0) return
    setSyncing(true)
    try {
      await axios.post('/sync/students', { items: selectedUsers })
      setSelected({})
      await fetchUsers()
    } catch (e) {
      console.error('Error sincronizando:', e.message)
    }
    setSyncing(false)
  }

  const handleDelete = async (user) => {
    if (!confirm(`¿Eliminar a ${user.nombre} de Journey?`)) return
    try {
      await axios.delete(`/journey/usuarios/${user.id}`)
      await fetchUsers()
    } catch (e) {
      console.error('Error eliminando:', e.message)
    }
  }

  const allPageSelected = paginated.length > 0 && paginated.every(u => selected[u.id])

  return (
    <div className="sync-page">
      <div className="sync-page-header">
        <h2>Usuarios Plataforma</h2>
        <button className="btn-primary" onClick={handleSync} disabled={selectedUsers.length === 0 || syncing}>
          <RefreshCw size={15} />
          {syncing ? 'Sincronizando...' : `Sincronizar (${selectedUsers.length})`}
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-input-wrapper">
          <Search size={15} className="filter-icon" />
          <input
            className="filter-input"
            placeholder="Buscar por nombre, email, documento..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="filter-select" value={filterJornada} onChange={e => { setFilterJornada(e.target.value); setPage(1) }}>
          <option value="">Todas las jornadas</option>
          {jornadas.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <select className="filter-select" value={filterEstado} onChange={e => { setFilterEstado(e.target.value); setPage(1) }}>
          <option value="">Todos los estados</option>
          <option value="sincronizado">Sincronizado</option>
          <option value="solo_bd">Solo en BD</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <span className="results-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-box">Cargando usuarios...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allPageSelected} onChange={selectAll} /></th>
                  {COLUMNS.map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)} className="sortable">
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                        : <span style={{ opacity: 0.3 }}><ChevronDown size={13} /></span>}
                    </th>
                  ))}
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(user => (
                  <>
                    <tr key={user.id} className={selected[user.id] ? 'row-selected' : ''}>
                      <td><input type="checkbox" checked={!!selected[user.id]} onChange={() => toggleSelect(user.id)} /></td>
                      {COLUMNS.map(col => <td key={col.key}>{user[col.key] || '-'}</td>)}
                      <td><StatusBadge row={user} /></td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-icon" onClick={() => toggleExpand(user.id)} title="Ver más">
                            {expandedRows[user.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button className="btn-icon btn-icon-edit" onClick={() => setEditUser(user)} title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button className="btn-icon btn-icon-delete" onClick={() => handleDelete(user)} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows[user.id] && (
                      <tr key={`expand-${user.id}`} className="expand-row">
                        <td colSpan={COLUMNS.length + 3}>
                          <div className="expand-content">
                            <div className="expand-grid">
                              <div className="expand-item">
                                <span className="expand-label">Correo Personal</span>
                                <span className="expand-value">{user.correo_personal || '-'}</span>
                              </div>
                              <div className="expand-item">
                                <span className="expand-label">Teléfono</span>
                                <span className="expand-value">{user.telefono || '-'}</span>
                              </div>
                              <div className="expand-item">
                                <span className="expand-label">Celular</span>
                                <span className="expand-value">{user.celular || '-'}</span>
                              </div>
                              <div className="expand-item">
                                <span className="expand-label">Fecha Nacimiento</span>
                                <span className="expand-value">{user.fecha_nacimiento ? String(user.fecha_nacimiento).split('T')[0] : '-'}</span>
                              </div>
                              <div className="expand-item">
                                <span className="expand-label">Ciudad</span>
                                <span className="expand-value">{user.city || '-'}</span>
                              </div>
                              <div className="expand-item">
                                <span className="expand-label">Username</span>
                                <span className="expand-value">{user.username || '-'}</span>
                              </div>
                              <div className="expand-item" style={{ gridColumn: '1 / -1' }}>
                                <span className="expand-label">Plan de Estudios</span>
                                <span className="expand-value">{user.plan_estudios || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, i, arr) => (
                  <>
                    {i > 0 && arr[i - 1] !== p - 1 && <span key={`dot-${p}`} className="page-dots">...</span>}
                    <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                  </>
                ))}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
              <span className="page-info">Página {page} de {totalPages} — {filtered.length} registros</span>
            </div>
          )}
        </>
      )}

      {editUser && (
        <EditModal user={editUser} onClose={() => setEditUser(null)} onSave={fetchUsers} />
      )}
    </div>
  )
}