// ── CONFIG ────────────────────────────────────────────────────────────────────
const ADMIN_SESSION_KEY  = 'dorrego_admin';
const ADMIN_PASSWORDS    = ['cheleado', 'enchelado'];
const WASH_DUR = 30, DRY_DUR = 60;

function genSlots(type) {
  const dur = type === 'lavado' ? WASH_DUR : DRY_DUR;
  const slots = [];
  for (let t = 7 * 60; t + dur <= 22 * 60; t += dur) {
    const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    slots.push({ index: slots.length, time: fmt(t), endTime: fmt(t + dur) });
  }
  return slots;
}
const SLOTS = { lavado: genSlots('lavado'), secado: genSlots('secado') };

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  perfiles: [],
  reservas: [],
  tab:      'usuarios',
  modal:    null,   // { type, data }
  loading:  false,
  error:    null,
};

let unsubPerfiles = null;
let unsubReservas = null;

// ── AUTH ──────────────────────────────────────────────────────────────────────
function isAuthed() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  document.getElementById('app').innerHTML = isAuthed() ? buildPanel() : buildLogin();
  attachEvents();
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function buildLogin() {
  return `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-icon">🔐</div>
      <h1>Panel de Administración</h1>
      <p>Dorrego 1869 · Lavadero</p>
      ${state.error ? `<div class="alert-error">${esc(state.error)}</div>` : ''}
      <div class="form-group">
        <label>Contraseña</label>
        <input id="input-admin-pwd" type="password" placeholder="••••••••" autocomplete="current-password" />
      </div>
      <button class="btn btn-primary" id="btn-admin-login" style="width:100%;margin-top:0.25rem">Ingresar →</button>
    </div>
  </div>`;
}

// ── PANEL ─────────────────────────────────────────────────────────────────────
function buildPanel() {
  return `
  <div class="admin-wrap">
    <header class="admin-header">
      <div>
        <h1>Dorrego 1869 · Admin</h1>
        <span>Panel de administración del lavadero</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-admin-logout">Salir</button>
    </header>

    <div class="admin-tabs">
      <button class="a-tab-btn ${state.tab === 'usuarios' ? 'active' : ''}" data-tab="usuarios">
        Usuarios <span class="count-badge">${state.perfiles.length}</span>
      </button>
      <button class="a-tab-btn ${state.tab === 'reservas' ? 'active' : ''}" data-tab="reservas">
        Reservas <span class="count-badge">${state.reservas.length}</span>
      </button>
    </div>

    <div id="panel-body">
      ${state.tab === 'usuarios' ? buildUsuariosTab() : buildReservasTab()}
    </div>

    ${state.modal ? buildModal() : ''}
    ${state.loading ? `<div class="loading-overlay"><div class="spinner"></div></div>` : ''}
  </div>`;
}

// ── USUARIOS TAB ──────────────────────────────────────────────────────────────
function buildUsuariosTab() {
  const sorted = [...state.perfiles].sort((a, b) => a.unit.localeCompare(b.unit));
  return `
  <div class="section-header">
    <h2>Usuarios registrados</h2>
    <button class="btn btn-primary btn-sm" id="btn-new-user">+ Nuevo usuario</button>
  </div>
  ${sorted.length === 0
    ? `<div class="empty-state">No hay usuarios registrados.</div>`
    : `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Apellido</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(p => `
            <tr>
              <td><span class="unit-pill">${esc(p.unit)}</span></td>
              <td>${esc(p.name)}</td>
              <td class="col-muted">${p.createdAt ? p.createdAt.slice(0, 10) : '—'}</td>
              <td class="col-actions">
                <button class="btn btn-ghost btn-xs" data-action="edit-user" data-unit="${esc(p.unit)}">Editar</button>
                <button class="btn btn-danger btn-xs" data-action="delete-user" data-unit="${esc(p.unit)}">Eliminar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  }`;
}

// ── RESERVAS TAB ──────────────────────────────────────────────────────────────
function buildReservasTab() {
  const sorted = [...state.reservas].sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.slotIndex - b.slotIndex
  );
  return `
  <div class="section-header">
    <h2>Reservas activas</h2>
    <button class="btn btn-primary btn-sm" id="btn-new-booking">+ Nueva reserva</button>
  </div>
  ${sorted.length === 0
    ? `<div class="empty-state">No hay reservas activas.</div>`
    : `<div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Horario</th>
              <th>Unidad</th>
              <th>Apellido</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(r => {
              const slot = SLOTS[r.type]?.[r.slotIndex];
              return `
              <tr>
                <td>${esc(r.date)}</td>
                <td><span class="type-pill ${esc(r.type)}">${r.type === 'lavado' ? '🫧 Lavado' : '💨 Secado'}</span></td>
                <td class="col-mono">${slot ? slot.time + ' – ' + slot.endTime : '—'}</td>
                <td><span class="unit-pill">${esc(r.unit)}</span></td>
                <td>${esc(r.ownerName)}</td>
                <td class="col-muted">${r.notes ? esc(r.notes) : '—'}</td>
                <td class="col-actions">
                  <button class="btn btn-ghost btn-xs" data-action="edit-booking" data-id="${esc(r.id)}">Editar</button>
                  <button class="btn btn-danger btn-xs" data-action="delete-booking" data-id="${esc(r.id)}">Eliminar</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`
  }`;
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function buildModal() {
  const { type, data } = state.modal;
  let body = '';

  if (type === 'new-user') {
    body = `
    <h2>Nuevo usuario</h2>
    ${state.error ? `<div class="alert-error">${esc(state.error)}</div>` : ''}
    <div class="form-group">
      <label>Unidad</label>
      <input id="m-unit" type="text" placeholder="Ej: 3B, PB, 5A…" maxlength="10"
             autocorrect="off" autocomplete="off" spellcheck="false" value="${esc(data.unit || '')}" />
      <div class="form-error" id="err-m-unit">Requerido.</div>
    </div>
    <div class="form-group">
      <label>Apellido</label>
      <input id="m-name" type="text" placeholder="Ej: García" maxlength="30"
             autocomplete="off" value="${esc(data.name || '')}" />
      <div class="form-error" id="err-m-name">Requerido.</div>
    </div>
    <div class="form-group">
      <label>Contraseña</label>
      <input id="m-pwd" type="text" placeholder="Mínimo 4 caracteres" maxlength="50"
             autocomplete="off" value="${esc(data.pwd || '')}" />
      <div class="form-error" id="err-m-pwd">Mínimo 4 caracteres.</div>
    </div>
    <div class="a-modal-actions">
      <button class="btn btn-ghost" id="btn-modal-close">Cancelar</button>
      <button class="btn btn-primary" id="btn-modal-save">Crear usuario</button>
    </div>`;
  }

  if (type === 'edit-user') {
    body = `
    <h2>Editar usuario</h2>
    <div class="detail-grid">
      <div class="detail-row">
        <span class="d-label">Unidad</span>
        <span class="unit-pill d-value">${esc(data.unit)}</span>
      </div>
    </div>
    <div class="form-group">
      <label>Apellido</label>
      <input id="m-name" type="text" maxlength="30" autocomplete="off" value="${esc(data.name)}" />
      <div class="form-error" id="err-m-name">Requerido.</div>
    </div>
    <div class="form-group">
      <label>Nueva contraseña <span class="muted-label">(dejá vacío para no cambiar)</span></label>
      <input id="m-pwd" type="text" placeholder="Nueva contraseña…" maxlength="50" autocomplete="off" />
    </div>
    <div class="a-modal-actions">
      <button class="btn btn-ghost" id="btn-modal-close">Cancelar</button>
      <button class="btn btn-primary" id="btn-modal-save">Guardar cambios</button>
    </div>`;
  }

  if (type === 'new-booking') {
    const today = new Date().toISOString().slice(0, 10);
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const selType = data.bType || 'lavado';
    body = `
    <h2>Nueva reserva</h2>
    ${state.error ? `<div class="alert-error">${esc(state.error)}</div>` : ''}
    <div class="form-group">
      <label>Fecha</label>
      <select id="m-date">
        ${dates.map(d => `<option value="${d}"${d === (data.date || today) ? ' selected' : ''}>${d}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="m-type">
        <option value="lavado"${selType === 'lavado' ? ' selected' : ''}>🫧 Lavado (30 min)</option>
        <option value="secado"${selType === 'secado' ? ' selected' : ''}>💨 Secado (60 min)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Horario</label>
      <select id="m-slot">
        ${SLOTS[selType].map(s => `<option value="${s.index}"${s.index === (data.slotIndex ?? 0) ? ' selected' : ''}>${s.time} – ${s.endTime}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Unidad</label>
      <select id="m-unit">
        <option value="">— Seleccioná unidad —</option>
        ${state.perfiles
          .sort((a, b) => a.unit.localeCompare(b.unit))
          .map(p => `<option value="${esc(p.unit)}"${p.unit === data.unit ? ' selected' : ''}>${esc(p.unit)} · ${esc(p.name)}</option>`)
          .join('')}
      </select>
      <div class="form-error" id="err-m-unit">Seleccioná una unidad.</div>
    </div>
    <div class="form-group">
      <label>Notas <span class="muted-label">(opcional)</span></label>
      <textarea id="m-notes" rows="2" maxlength="120" placeholder="Ej: ropa delicada…">${esc(data.notes || '')}</textarea>
    </div>
    <div class="a-modal-actions">
      <button class="btn btn-ghost" id="btn-modal-close">Cancelar</button>
      <button class="btn btn-primary" id="btn-modal-save">Crear reserva</button>
    </div>`;
  }

  if (type === 'edit-booking') {
    const slot = SLOTS[data.type]?.[data.slotIndex];
    body = `
    <h2>Editar reserva</h2>
    <div class="detail-grid">
      <div class="detail-row"><span class="d-label">Fecha</span><span class="d-value">${esc(data.date)}</span></div>
      <div class="detail-row"><span class="d-label">Tipo</span><span class="d-value">${data.type === 'lavado' ? '🫧 Lavado' : '💨 Secado'}</span></div>
      <div class="detail-row"><span class="d-label">Horario</span><span class="d-value col-mono">${slot ? slot.time + ' – ' + slot.endTime : '—'}</span></div>
      <div class="detail-row"><span class="d-label">Unidad</span><span class="unit-pill">${esc(data.unit)}</span></div>
      <div class="detail-row"><span class="d-label">Apellido</span><span class="d-value">${esc(data.ownerName)}</span></div>
    </div>
    <div class="form-group">
      <label>Notas</label>
      <textarea id="m-notes" rows="2" maxlength="120">${esc(data.notes || '')}</textarea>
    </div>
    <div class="a-modal-actions">
      <button class="btn btn-ghost" id="btn-modal-close">Cancelar</button>
      <button class="btn btn-primary" id="btn-modal-save">Guardar cambios</button>
    </div>`;
  }

  return `
  <div class="a-modal-overlay open" id="modal-overlay">
    <div class="a-modal">${body}</div>
  </div>`;
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
function attachEvents() {
  // Login
  on('btn-admin-login', 'click', doAdminLogin);
  on('input-admin-pwd', 'keydown', e => { if (e.key === 'Enter') doAdminLogin(); });

  // Logout
  on('btn-admin-logout', 'click', () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    stopSync();
    state.perfiles = [];
    state.reservas = [];
    state.error = null;
    render();
  });

  // Tabs
  document.querySelectorAll('.a-tab-btn').forEach(btn =>
    btn.addEventListener('click', () => { state.tab = btn.dataset.tab; render(); })
  );

  // New user / booking buttons
  on('btn-new-user', 'click', () => {
    state.modal = { type: 'new-user', data: {} };
    state.error = null;
    render();
  });
  on('btn-new-booking', 'click', () => {
    state.modal = { type: 'new-booking', data: {} };
    state.error = null;
    render();
  });

  // Slot options update when booking type changes
  on('m-type', 'change', () => {
    const type = document.getElementById('m-type')?.value;
    const sel  = document.getElementById('m-slot');
    if (sel && type) {
      sel.innerHTML = SLOTS[type].map(s =>
        `<option value="${s.index}">${s.time} – ${s.endTime}</option>`
      ).join('');
    }
  });

  // Action buttons (edit / delete rows)
  document.querySelectorAll('[data-action]').forEach(btn =>
    btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset))
  );

  // Modal close
  on('btn-modal-close', 'click', closeModal);
  on('modal-overlay', 'click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

  // Modal save
  on('btn-modal-save', 'click', doModalSave);
}

function closeModal() {
  state.modal = null;
  state.error = null;
  render();
}

async function handleAction(action, dataset) {
  if (action === 'edit-user') {
    const p = state.perfiles.find(x => x.unit === dataset.unit);
    if (p) { state.modal = { type: 'edit-user', data: { ...p } }; render(); }
  }

  if (action === 'delete-user') {
    if (!confirm(`¿Eliminar usuario ${dataset.unit}?\nSus reservas activas NO se eliminarán.`)) return;
    state.loading = true; render();
    try {
      await db.collection('perfiles').doc(dataset.unit).delete();
      toast('Usuario eliminado.', 'success');
    } catch { toast('Error al eliminar.', 'error'); }
    state.loading = false; render();
  }

  if (action === 'edit-booking') {
    const r = state.reservas.find(x => x.id === dataset.id);
    if (r) { state.modal = { type: 'edit-booking', data: { ...r } }; render(); }
  }

  if (action === 'delete-booking') {
    if (!confirm('¿Eliminar esta reserva?')) return;
    state.loading = true; render();
    try {
      await db.collection('reservas').doc(dataset.id).delete();
      toast('Reserva eliminada.', 'success');
    } catch { toast('Error al eliminar.', 'error'); }
    state.loading = false; render();
  }
}

// ── MODAL SAVE ────────────────────────────────────────────────────────────────
async function doModalSave() {
  const { type, data } = state.modal;

  if (type === 'new-user') {
    const unit = (val('m-unit') || '').toUpperCase();
    const name = val('m-name');
    const pwd  = val('m-pwd');
    let ok = true;
    if (!unit)          { show('err-m-unit'); ok = false; } else { hide('err-m-unit'); }
    if (!name)          { show('err-m-name'); ok = false; } else { hide('err-m-name'); }
    if (pwd.length < 4) { show('err-m-pwd');  ok = false; } else { hide('err-m-pwd'); }
    if (!ok) return;

    state.loading = true; render();
    try {
      const ref = db.collection('perfiles').doc(unit);
      if ((await ref.get()).exists) {
        state.loading = false;
        state.error = `La unidad ${unit} ya tiene una cuenta.`;
        state.modal = { type, data: { unit, name, pwd } };
        render(); return;
      }
      await ref.set({ unit, name, password: pwd, createdAt: new Date().toISOString() });
      state.modal = null; state.loading = false; state.error = null;
      toast('Usuario creado.', 'success');
      render();
    } catch {
      state.loading = false;
      toast('Error al crear usuario.', 'error');
      render();
    }
  }

  if (type === 'edit-user') {
    const name = val('m-name');
    const pwd  = val('m-pwd');
    if (!name) { show('err-m-name'); return; }
    hide('err-m-name');

    state.loading = true; render();
    try {
      const update = { name };
      if (pwd.length >= 4) update.password = pwd;
      await db.collection('perfiles').doc(data.unit).update(update);
      state.modal = null; state.loading = false;
      toast('Usuario actualizado.', 'success');
      render();
    } catch {
      state.loading = false;
      toast('Error al actualizar.', 'error');
      render();
    }
  }

  if (type === 'new-booking') {
    const date      = val('m-date');
    const bType     = val('m-type') || 'lavado';
    const slotIndex = parseInt(val('m-slot') || '0');
    const unit      = val('m-unit');
    const notes     = val('m-notes');

    if (!unit) { show('err-m-unit'); return; }
    hide('err-m-unit');

    const profile   = state.perfiles.find(p => p.unit === unit);
    const ownerName = profile ? profile.name : unit;

    state.loading = true; render();
    try {
      const docId = `${date}__${bType}__${slotIndex}`;
      const ref   = db.collection('reservas').doc(docId);
      await db.runTransaction(async t => {
        const snap = await t.get(ref);
        if (snap.exists) throw new Error('slot_taken');
        t.set(ref, { date, type: bType, slotIndex, unit, ownerName, notes, createdAt: new Date().toISOString() });
      });
      state.modal = null; state.loading = false; state.error = null;
      toast('Reserva creada.', 'success');
      render();
    } catch (e) {
      state.loading = false;
      if (e.message === 'slot_taken') {
        state.error = 'Ese turno ya está reservado. Elegí otro horario.';
        state.modal = { type, data: { date: val('m-date'), bType, slotIndex, unit, notes } };
        render();
      } else {
        toast('Error al crear reserva.', 'error');
        render();
      }
    }
  }

  if (type === 'edit-booking') {
    const notes = val('m-notes');
    state.loading = true; render();
    try {
      await db.collection('reservas').doc(data.id).update({ notes });
      state.modal = null; state.loading = false;
      toast('Reserva actualizada.', 'success');
      render();
    } catch {
      state.loading = false;
      toast('Error al actualizar.', 'error');
      render();
    }
  }
}

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
function doAdminLogin() {
  const pwd = val('input-admin-pwd');
  if (!ADMIN_PASSWORDS.includes(pwd)) {
    state.error = 'Contraseña incorrecta.';
    render();
    document.getElementById('input-admin-pwd')?.focus();
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  state.error = null;
  startSync();
  render();
}

// ── FIRESTORE SYNC ────────────────────────────────────────────────────────────
function startSync() {
  unsubPerfiles = db.collection('perfiles').onSnapshot(snap => {
    state.perfiles = snap.docs.map(d => ({ unit: d.id, ...d.data() }));
    if (isAuthed() && !state.modal) render();
  }, err => console.error('perfiles sync:', err));

  unsubReservas = db.collection('reservas').onSnapshot(snap => {
    state.reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (isAuthed() && !state.modal) render();
  }, err => console.error('reservas sync:', err));
}

function stopSync() {
  if (unsubPerfiles) { unsubPerfiles(); unsubPerfiles = null; }
  if (unsubReservas) { unsubReservas(); unsubReservas = null; }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function val(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function on(id, ev, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(ev, fn);
}

function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = type;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
if (isAuthed()) startSync();
render();
