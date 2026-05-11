document.addEventListener('DOMContentLoaded', () => {
  const statusMessage = document.getElementById('statusMessage');
  const logOutput = document.getElementById('logOutput');
  const userDropdown = document.getElementById('userDropdown');
  const userMenu = document.getElementById('userMenu');

  const appendLog = (message) => {
    if (!logOutput) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    if (logOutput.textContent === 'Ninguna acción ejecutada aún.') logOutput.textContent = '';
    logOutput.prepend(line);
  };

  document.getElementById('toggle-menu')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
  });

  document.querySelectorAll('.has-submenu .submenu-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = toggle.closest('.has-submenu');
      if (!menu) return;
      const submenu = menu.querySelector('.submenu');
      menu.classList.toggle('open');
      submenu?.classList.toggle('open');
    });
  });

  userDropdown?.addEventListener('click', () => userMenu?.classList.toggle('show'));
  document.addEventListener('click', (e) => {
    if (!userDropdown?.contains(e.target) && !userMenu?.contains(e.target)) {
      userMenu?.classList.remove('show');
    }
  });

  // ─── MODAL EDITAR ────────────────────────────────────────────────────────────
  const createModal = () => {
    if (document.getElementById('edit-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Editar Usuario</h3>
          <button class="modal-close" id="modal-close">✕</button>
        </div>
        <div class="modal-form">
          <input type="hidden" id="edit-id">
          <div class="modal-section-title">Datos Básicos</div>
          <div class="modal-row">
            <div class="modal-field">
              <label>Nombre</label>
              <input type="text" id="edit-firstname">
            </div>
            <div class="modal-field">
              <label>Apellido</label>
              <input type="text" id="edit-lastname">
            </div>
          </div>
          <div class="modal-row">
            <div class="modal-field">
              <label>Correo Institucional</label>
              <input type="email" id="edit-email">
            </div>
            <div class="modal-field">
              <label>Documento</label>
              <input type="text" id="edit-documento">
            </div>
          </div>
          <div class="modal-section-title">Contacto</div>
          <div class="modal-row">
            <div class="modal-field">
              <label>Correo Personal</label>
              <input type="email" id="edit-correo_personal">
            </div>
            <div class="modal-field">
              <label>Teléfono</label>
              <input type="text" id="edit-telefono">
            </div>
          </div>
          <div class="modal-row">
            <div class="modal-field">
              <label>Celular</label>
              <input type="text" id="edit-celular">
            </div>
            <div class="modal-field">
              <label>Fecha de Nacimiento</label>
              <input type="date" id="edit-fecha_nacimiento">
            </div>
          </div>
          <div class="modal-section-title">Información Académica</div>
          <div class="modal-row">
            <div class="modal-field">
              <label>Jornada</label>
              <input type="text" id="edit-jornada">
            </div>
            <div class="modal-field">
              <label>Ciudad</label>
              <input type="text" id="edit-city">
            </div>
          </div>
          <div class="modal-field">
            <label>Departamento Académico</label>
            <input type="text" id="edit-departamento_academico">
          </div>
          <div class="modal-field">
            <label>Plan de Estudios</label>
            <input type="text" id="edit-plan_estudios">
          </div>
        </div>
        <div class="modal-actions">
          <button id="modal-cancel" class="btn-secondary">Cancelar</button>
          <button id="modal-save" class="btn-primary">Guardar Cambios</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('modal-cancel').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('modal-close').addEventListener('click', () => modal.classList.remove('show'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
  };

  const openEditModal = (row, onSave) => {
    createModal();
    const modal = document.getElementById('edit-modal');
    document.getElementById('edit-id').value = row.id;
    document.getElementById('edit-firstname').value = row.firstname || '';
    document.getElementById('edit-lastname').value = row.lastname || '';
    document.getElementById('edit-email').value = row.email || '';
    document.getElementById('edit-documento').value = row.documento || '';
    document.getElementById('edit-correo_personal').value = row.correo_personal || '';
    document.getElementById('edit-telefono').value = row.telefono || '';
    document.getElementById('edit-celular').value = row.celular || '';
    document.getElementById('edit-fecha_nacimiento').value = row.fecha_nacimiento ? String(row.fecha_nacimiento).split('T')[0] : '';
    document.getElementById('edit-jornada').value = row.jornada || '';
    document.getElementById('edit-city').value = row.city || '';
    document.getElementById('edit-departamento_academico').value = row.departamento_academico || '';
    document.getElementById('edit-plan_estudios').value = row.plan_estudios || '';
    modal.classList.add('show');

    const saveBtn = document.getElementById('modal-save');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', async () => {
      newSaveBtn.textContent = 'Guardando...';
      newSaveBtn.disabled = true;
      const data = {
        firstname: document.getElementById('edit-firstname').value,
        lastname: document.getElementById('edit-lastname').value,
        email: document.getElementById('edit-email').value,
        documento: document.getElementById('edit-documento').value,
        correo_personal: document.getElementById('edit-correo_personal').value,
        telefono: document.getElementById('edit-telefono').value,
        celular: document.getElementById('edit-celular').value,
        fecha_nacimiento: document.getElementById('edit-fecha_nacimiento').value || null,
        jornada: document.getElementById('edit-jornada').value,
        city: document.getElementById('edit-city').value,
        country: 'CO',
        departamento_academico: document.getElementById('edit-departamento_academico').value,
        plan_estudios: document.getElementById('edit-plan_estudios').value
      };
      try {
        const res = await fetch(`/journey/usuarios/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          modal.classList.remove('show');
          appendLog(`Usuario ${data.firstname} ${data.lastname} actualizado`);
          onSave();
        }
      } catch (e) {
        console.error('Error actualizando usuario:', e.message);
      }
      newSaveBtn.textContent = 'Guardar Cambios';
      newSaveBtn.disabled = false;
    });
  };

  // ─── VISTAS DE SINCRONIZACIÓN ────────────────────────────────────────────────

  const syncViews = {
    students: {
      previewUrl: '/sync/preview/students',
      syncUrl: '/sync/students',
      label: 'Estudiantes',
      columns: ['nombre', 'email', 'documento', 'jornada', 'departamento'],
      mapRow: (item) => ({
        id: item.id,
        nombre: `${item.firstname || ''} ${item.lastname || ''}`.trim(),
        email: item.email || '-',
        documento: item.documento || '-',
        jornada: item.jornada || '-',
        departamento: item.departamento_academico || '-',
        // Campos para modal y expand
        firstname: item.firstname,
        lastname: item.lastname,
        city: item.city,
        country: item.country,
        username: item.username,
        correo_personal: item.correo_personal,
        telefono: item.telefono,
        celular: item.celular,
        fecha_nacimiento: item.fecha_nacimiento,
        departamento_academico: item.departamento_academico,
        plan_estudios: item.plan_estudios,
        _syncStatus: item._syncStatus || { inDB: false, inMoodle: false },
        _raw: item
      })
    },
    courses: {
      previewUrl: '/sync/preview/courses',
      syncUrl: '/sync/courses',
      label: 'Cursos',
      columns: ['nombre', 'código'],
      mapRow: (item) => ({
        id: item.id || item.shortname,
        nombre: item.fullname || item.nombre || item.name || '-',
        código: item.shortname || item.codigo || '-',
        _syncStatus: item._syncStatus || { inDB: false, inMoodle: false },
        _raw: item
      })
    },
    enrollments: {
      previewUrl: '/sync/preview/enrollments',
      syncUrl: '/sync/enrollments',
      label: 'Matrículas',
      columns: ['estudiante', 'curso'],
      mapRow: (item) => ({
        id: item.id || `${item.studentId}-${item.courseId}`,
        estudiante: item.studentName || item.student || item.studentId || '-',
        curso: item.courseName || item.course || item.courseId || '-',
        _syncStatus: item._syncStatus || { inDB: false, inMoodle: false },
        _raw: item
      })
    }
  };

  const getStatusBadge = (row) => {
    if (row._status === 'error') return '<span class="badge badge-error">❌ Error</span>';
    if (row._status === 'success') return '<span class="badge badge-success">✅ Creado</span>';
    if (row._syncStatus?.inDB && row._syncStatus?.inMoodle) return '<span class="badge badge-synced">✅ Sincronizado</span>';
    if (row._syncStatus?.inDB) return '<span class="badge badge-db">🗄️ Solo en BD</span>';
    if (row._syncStatus?.inMoodle) return '<span class="badge badge-moodle">🟡 Solo en Moodle</span>';
    return '<span class="badge badge-pending">➕ Pendiente</span>';
  };

  const renderSyncView = async (type) => {
    const view = syncViews[type];
    const mainContent = document.getElementById('main-content') || document.querySelector('.main-content') || document.querySelector('main');
    if (!mainContent) return;

    mainContent.innerHTML = `
      <div class="sync-view">
        <div class="sync-header">
          <h2>Sincronizar ${view.label}</h2>
          <div class="sync-controls">
            <input type="text" id="sync-search" placeholder="Buscar..." class="sync-search-input">
          </div>
          <div class="sync-actions-bar">
            <span id="sync-counter">Cargando...</span>
            <button id="btn-select-all" class="btn-secondary">Seleccionar todos</button>
            <button id="btn-deselect-all" class="btn-secondary">Deseleccionar todos</button>
            <button id="btn-sync-selected" class="btn-primary" disabled>Sincronizar Seleccionados</button>
          </div>
        </div>
        <div id="sync-table-container"><p class="loading-text">Cargando datos...</p></div>
      </div>`;

    let allRows = [];
    try {
      const res = await fetch(view.previewUrl);
      const data = await res.json();
      const items = data.body || data.data || data || [];
      allRows = items.map(view.mapRow);
    } catch (e) {
      document.getElementById('sync-table-container').innerHTML = `<p class="error-text">Error cargando datos: ${e.message}</p>`;
      return;
    }

    let filteredRows = [...allRows];

    const reloadPreview = async () => {
      try {
        const res2 = await fetch(view.previewUrl);
        const data2 = await res2.json();
        const items2 = data2.body || data2.data || data2 || [];
        allRows = items2.map(view.mapRow);
        filteredRows = [...allRows];
        renderTable();
      } catch (e) {
        console.error('Error recargando preview:', e.message);
      }
    };

    const renderTable = () => {
      const container = document.getElementById('sync-table-container');
      if (!container) return;
      const selected = filteredRows.filter(r => r._selected).length;
      document.getElementById('sync-counter').textContent = `${selected} de ${filteredRows.length} seleccionados`;
      document.getElementById('btn-sync-selected').disabled = selected === 0;

      if (filteredRows.length === 0) {
        container.innerHTML = '<p class="empty-text">No hay datos disponibles.</p>';
        return;
      }

      const showActions = type === 'students';

      container.innerHTML = `
        <table class="sync-table">
          <thead>
            <tr>
              <th style="width:40px"><input type="checkbox" id="check-all"></th>
              ${view.columns.map(c => `<th>${c.charAt(0).toUpperCase() + c.slice(1)}</th>`).join('')}
              <th>Estado</th>
              ${showActions ? '<th style="width:100px">Acciones</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${filteredRows.map((row, i) => `
              <tr class="main-row ${row._status ? 'row-' + row._status : ''}" data-index="${i}">
                <td><input type="checkbox" class="row-check" data-index="${i}" ${row._selected ? 'checked' : ''} ${row._status ? 'disabled' : ''}></td>
                ${view.columns.map(c => `<td>${row[c] || '-'}</td>`).join('')}
                <td>${getStatusBadge(row)}</td>
                ${showActions ? `
                <td class="action-btns">
                  <button class="btn-expand" data-index="${i}" title="Ver más">▼</button>
                  <button class="btn-edit" data-index="${i}" title="Editar">✏️</button>
                  <button class="btn-delete" data-index="${i}" title="Eliminar">🗑️</button>
                </td>` : ''}
              </tr>
              ${showActions ? `
              <tr class="expand-row" id="expand-${i}" style="display:none">
                <td colspan="${view.columns.length + 3}">
                  <div class="expand-content">
                    <div class="expand-grid">
                      <div class="expand-item"><span class="expand-label">Correo Personal</span><span class="expand-value">${row.correo_personal || '-'}</span></div>
                      <div class="expand-item"><span class="expand-label">Teléfono</span><span class="expand-value">${row.telefono || '-'}</span></div>
                      <div class="expand-item"><span class="expand-label">Celular</span><span class="expand-value">${row.celular || '-'}</span></div>
                      <div class="expand-item"><span class="expand-label">Fecha Nacimiento</span><span class="expand-value">${row.fecha_nacimiento ? String(row.fecha_nacimiento).split('T')[0] : '-'}</span></div>
                      <div class="expand-item"><span class="expand-label">Ciudad</span><span class="expand-value">${row.city || '-'}</span></div>
                      <div class="expand-item"><span class="expand-label">Username</span><span class="expand-value">${row.username || '-'}</span></div>
                      <div class="expand-item expand-full"><span class="expand-label">Plan de Estudios</span><span class="expand-value">${row.plan_estudios || '-'}</span></div>
                    </div>
                  </div>
                </td>
              </tr>` : ''}
            `).join('')}
          </tbody>
        </table>`;

      // Checkboxes
      container.querySelectorAll('.row-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
          filteredRows[parseInt(e.target.dataset.index)]._selected = e.target.checked;
          renderTable();
        });
      });

      document.getElementById('check-all')?.addEventListener('change', (e) => {
        filteredRows.forEach(r => { if (!r._status) r._selected = e.target.checked; });
        renderTable();
      });

      // Expandir fila
      container.querySelectorAll('.btn-expand').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const i = e.target.dataset.index;
          const expandRow = document.getElementById(`expand-${i}`);
          const isOpen = expandRow.style.display !== 'none';
          expandRow.style.display = isOpen ? 'none' : 'table-row';
          e.target.textContent = isOpen ? '▼' : '▲';
        });
      });

      // Editar
      container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const row = filteredRows[parseInt(e.target.dataset.index)];
          openEditModal(row, reloadPreview);
        });
      });

      // Borrar
      container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const row = filteredRows[parseInt(e.target.dataset.index)];
          if (!confirm(`¿Eliminar a ${row.nombre} de Journey?`)) return;
          try {
            await fetch(`/journey/usuarios/${row.id}`, { method: 'DELETE' });
            appendLog(`Usuario ${row.nombre} eliminado`);
            await reloadPreview();
          } catch (err) {
            console.error('Error eliminando usuario:', err.message);
          }
        });
      });
    };

    renderTable();

    document.getElementById('sync-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      filteredRows = allRows.filter(r => Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(q)));
      renderTable();
    });

    document.getElementById('btn-select-all')?.addEventListener('click', () => {
      filteredRows.forEach(r => { if (!r._status) r._selected = true; });
      renderTable();
    });

    document.getElementById('btn-deselect-all')?.addEventListener('click', () => {
      filteredRows.forEach(r => r._selected = false);
      renderTable();
    });

    document.getElementById('btn-sync-selected')?.addEventListener('click', async () => {
      const selected = filteredRows.filter(r => r._selected).map(r => r._raw);
      const btn = document.getElementById('btn-sync-selected');
      btn.disabled = true;
      btn.textContent = 'Sincronizando...';
      try {
        const res = await fetch(view.syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: selected })
        });
        const data = await res.json();
        const results = data.body?.results || data.results || [];
        if (results.length === 0) {
          filteredRows.filter(r => r._selected).forEach(r => { r._status = 'success'; r._selected = false; });
        } else {
          results.forEach(result => {
            const row = filteredRows.find(r => r.id == result.id || r.email == result.email);
            if (row) { row._status = result.status || (result.error ? 'error' : 'success'); row._selected = false; }
          });
        }
        appendLog(`${view.label}: sincronización completada`);
      } catch (e) {
        filteredRows.filter(r => r._selected).forEach(r => r._status = 'error');
        appendLog(`${view.label}: error en sincronización`);
      }
      btn.textContent = 'Sincronizar Seleccionados';
      renderTable();
      setTimeout(reloadPreview, 800);
    });
  };

  // ─── CONECTAR BOTONES ────────────────────────────────────────────────────────
  document.getElementById('sync-students')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('students'); });
  document.getElementById('sync-enrollments')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('enrollments'); });
  document.getElementById('sync-courses')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('courses'); });
  document.getElementById('sync-students-sidebar')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('students'); });
  document.getElementById('sync-enrollments-sidebar')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('enrollments'); });
  document.getElementById('sync-courses-sidebar')?.addEventListener('click', (e) => { e.preventDefault(); renderSyncView('courses'); });
});