const STORAGE_KEY    = 'dorrego_reservas';
const PROFILE_KEY    = 'dorrego_perfil';
const AUTH_KEY       = 'dorrego_auth';
const WASH_DURATION  = 30;
const DRY_DURATION   = 60;
const MAX_DAYS_AHEAD = 3;
const MAX_PER_DAY    = 2;

// ── STATE ─────────────────────────────────────────────────────────────────────

let state = {
  view: 'onboarding',   // onboarding | profile | login | main
  profile: null,        // { unit, name, password }
  reservas: [],
  selectedDate: todayStr(),
  selectedTab: 'lavado',
  pendingSlot: null,
  pendingReservaId: null,
  modal: null,
  loginError: false,
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()],
    num: d.getDate(),
  };
}

function friendlyDate(dateStr) {
  const d    = new Date(dateStr + 'T00:00:00');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const today  = todayStr();
  if (dateStr === today) return 'Hoy';
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  if (dateStr === tom.toISOString().slice(0,10)) return 'Mañana';
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function generateSlots(type) {
  const slots = [], dur = type === 'lavado' ? WASH_DURATION : DRY_DURATION;
  for (let t = 7 * 60; t + dur <= 22 * 60; t += dur) {
    const fmt = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    slots.push({ index: slots.length, time: fmt(t), endTime: fmt(t + dur), duration: dur });
  }
  return slots;
}

function getAvailableDates() {
  return Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function loadData() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) state.reservas = JSON.parse(r);
    const p = localStorage.getItem(PROFILE_KEY);
    if (p) state.profile = JSON.parse(p);
  } catch (e) { /* ignore */ }
}

function saveData()    { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reservas)); }
function saveProfile() { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); }

function isAuthed()  { return sessionStorage.getItem(AUTH_KEY) === 'ok'; }
function setAuth()   { sessionStorage.setItem(AUTH_KEY, 'ok'); }
function clearAuth() { sessionStorage.removeItem(AUTH_KEY); }

function getReservaForSlot(date, type, slotIndex) {
  return state.reservas.find(r => r.date === date && r.type === type && r.slotIndex === slotIndex) || null;
}

function myReservas() {
  if (!state.profile) return [];
  return state.reservas
    .filter(r => r.unit === state.profile.unit)
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.slotIndex - b.slotIndex);
}

function wouldExceedMax(date, type, slotIndex) {
  const existing = state.reservas.filter(
    r => r.date === date && r.type === type && r.unit === state.profile.unit && r.slotIndex !== slotIndex
  );
  return existing.length >= MAX_PER_DAY;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function render() {
  document.getElementById('app').innerHTML = buildApp();
  attachEvents();
}

function buildApp() {
  let viewHTML = '';
  switch (state.view) {
    case 'onboarding': viewHTML = buildOnboarding(); break;
    case 'profile':    viewHTML = buildProfileSetup(); break;
    case 'login':      viewHTML = buildLogin(); break;
    case 'main':
      viewHTML = buildMain()
        + buildConfirmModal()
        + buildCancelModal()
        + buildMyBookingsModal()
        + buildProfileModal();
      break;
  }
  return viewHTML + `<div class="toast" id="toast"></div>`;
}

// ── VIEWS ─────────────────────────────────────────────────────────────────────

function buildOnboarding() {
  return `
  <div id="view-onboarding" class="view active">
    <div class="onboarding-logo">🧺</div>
    <div class="onboarding-title">Dorrego 1869</div>
    <div class="onboarding-subtitle">Sistema de turnos · Lavadero</div>
    <div class="onboarding-card">
      <p>Bienvenido al sistema de turnos del lavadero de Dorrego 1869.</p>
      <p style="margin-top:0.75rem">Solo se permitirá hacer uso del lavadero si tiene un turno asignado.</p>
      <ul>
        <li>Reservá tu turno de lavado (30 min) o secado (60 min)</li>
        <li>Máximo ${MAX_PER_DAY} turnos por sección por día</li>
        <li>Podés reservar hasta ${MAX_DAYS_AHEAD} días por adelantado</li>
        <li>Solo podés cancelar tus propias reservas</li>
      </ul>
    </div>
    <button class="btn btn-primary" id="btn-continue">Continuar →</button>
  </div>`;
}

function buildProfileSetup() {
  return `
  <div id="view-profile" class="view active" style="background:var(--bg)">
    <div class="profile-card">
      <div style="font-size:2rem;text-align:center;margin-bottom:1rem">🏠</div>
      <h2>Crear cuenta</h2>
      <p>Ingresá los datos de tu unidad. La contraseña te permitirá identificarte desde cualquier dispositivo.</p>
      <div class="form-group">
        <label>Piso / Departamento</label>
        <input id="input-unit" type="text" placeholder="Ej: 3B, PB, 5A…" maxlength="10" autocomplete="off" autocorrect="off" spellcheck="false" />
        <div class="form-error" id="err-unit">Ingresá tu unidad funcional.</div>
      </div>
      <div class="form-group">
        <label>Apellido</label>
        <input id="input-name" type="text" placeholder="Ej: García" maxlength="30" autocomplete="off" autocorrect="off" spellcheck="false" />
        <div class="form-error" id="err-name">Ingresá tu apellido.</div>
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input id="input-password" type="password" placeholder="Mínimo 4 caracteres" maxlength="50" autocomplete="new-password" />
        <div class="form-error" id="err-password">Ingresá una contraseña de al menos 4 caracteres.</div>
      </div>
      <div class="form-group">
        <label>Confirmar contraseña</label>
        <input id="input-password2" type="password" placeholder="Repetí la contraseña" maxlength="50" autocomplete="new-password" />
        <div class="form-error" id="err-password2">Las contraseñas no coinciden.</div>
      </div>
      <button class="btn btn-primary" id="btn-save-profile" style="margin-top:0.5rem">Crear cuenta</button>
    </div>
  </div>`;
}

function buildLogin() {
  return `
  <div id="view-login" class="view active" style="background:var(--bg)">
    <div class="profile-card">
      <div style="font-size:2rem;text-align:center;margin-bottom:1rem">🔑</div>
      <h2>Bienvenido de nuevo</h2>
      <p>Ingresá la contraseña de tu unidad para continuar.</p>
      <div class="unit-badge-login">
        <span class="unit-pill">${state.profile ? state.profile.unit : ''}</span>
        <span class="unit-name-login">${state.profile ? state.profile.name : ''}</span>
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input id="input-login-password" type="password" placeholder="••••••••" autocomplete="current-password" />
        ${state.loginError ? `<div class="form-error" style="display:block">Contraseña incorrecta. Intentá de nuevo.</div>` : ''}
      </div>
      <button class="btn btn-primary" id="btn-login-submit">Ingresar →</button>
      <button class="btn btn-link" id="btn-switch-unit">Usar otra unidad</button>
    </div>
  </div>`;
}

function buildMain() {
  const dates = getAvailableDates();
  const slots  = generateSlots(state.selectedTab);
  return `
  <div id="view-main" class="view active">
    <div class="app-header">
      <div class="header-top">
        <div class="header-title">
          <h1>Dorrego 1869</h1>
          <span>Turnos Lavadero</span>
        </div>
        <button class="user-badge" id="btn-profile-modal">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span>${state.profile ? state.profile.unit : ''}</span>
        </button>
      </div>
      <div class="date-nav">
        ${dates.map(d => {
          const lbl = dateLabel(d);
          return `<button class="date-btn ${d === state.selectedDate ? 'active' : ''}" data-date="${d}">
            <span class="day-name">${lbl.day}</span>
            <span class="day-num">${lbl.num}</span>
          </button>`;
        }).join('')}
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn ${state.selectedTab === 'lavado' ? 'active' : ''}" data-tab="lavado">
        <span class="tab-icon">🫧</span> Lavado <small>(30 min)</small>
      </button>
      <button class="tab-btn ${state.selectedTab === 'secado' ? 'active' : ''}" data-tab="secado">
        <span class="tab-icon">💨</span> Secado <small>(60 min)</small>
      </button>
    </div>
    <div class="slots-container">
      ${slots.map(slot => buildSlotCard(slot)).join('')}
    </div>
    <div class="my-bookings-bar">
      <button class="my-bookings-btn" id="btn-my-bookings">
        📋 Mis reservas
        <span class="booking-count">${myReservas().length}</span>
      </button>
    </div>
  </div>`;
}

function buildSlotCard(slot) {
  const reserva     = getReservaForSlot(state.selectedDate, state.selectedTab, slot.index);
  const ismine      = reserva && state.profile && reserva.unit === state.profile.unit;
  const free        = !reserva;
  const statusClass = free ? 'free' : ismine ? 'mine' : 'taken';

  const badge = free
    ? `<span class="slot-badge badge-free">Libre</span>`
    : ismine
      ? `<span class="slot-badge badge-mine">Tu turno</span>`
      : `<span class="slot-badge badge-taken">Ocupado</span>`;

  const unitText = free
    ? `<span class="slot-unit empty">Disponible</span>`
    : `<span class="slot-unit">${reserva.unit} · ${reserva.ownerName}${reserva.notes ? `<br><span class="slot-notes">${esc(reserva.notes)}</span>` : ''}</span>`;

  let actions = '';
  if (free) {
    actions = `<button class="btn btn-primary btn-sm" data-action="book" data-slot="${slot.index}">Reservar</button>`;
  } else if (ismine) {
    actions = `<button class="btn btn-danger btn-sm" data-action="cancel" data-slot="${slot.index}" data-reserva="${reserva.id}">Cancelar</button>`;
  }

  return `
  <div class="slot-card ${statusClass}">
    <div class="slot-time-col">
      <div class="slot-time">${slot.time}</div>
      <div class="slot-duration">${slot.duration} min</div>
    </div>
    <div class="slot-info">${unitText}</div>
    ${badge}
    <div class="slot-actions">${actions}</div>
  </div>`;
}

// ── MODALS ────────────────────────────────────────────────────────────────────

function buildConfirmModal() {
  if (state.pendingSlot === null) return `<div class="modal-overlay" id="modal-confirm"></div>`;
  const typeName = state.selectedTab === 'lavado' ? 'Lavado' : 'Secado';
  const s = generateSlots(state.selectedTab)[state.pendingSlot];
  return `
  <div class="modal-overlay ${state.modal === 'confirm' ? 'open' : ''}" id="modal-confirm">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">¿Confirmar reserva?</div>
      <div class="modal-subtitle">Revisá los datos antes de confirmar.</div>
      <div class="confirm-detail">
        <div class="confirm-row"><span class="label">Tipo</span><span class="value">${typeName}</span></div>
        <div class="confirm-row"><span class="label">Fecha</span><span class="value">${friendlyDate(state.selectedDate)}</span></div>
        <div class="confirm-row"><span class="label">Horario</span><span class="value">${s.time} – ${s.endTime}</span></div>
        <div class="confirm-row"><span class="label">Duración</span><span class="value">${s.duration} min</span></div>
        <div class="confirm-row"><span class="label">Unidad</span><span class="value">${state.profile.unit} · ${state.profile.name}</span></div>
      </div>
      <div class="form-group">
        <label>Notas (opcional)</label>
        <textarea id="input-notes" placeholder="Ej: ropa delicada, ciclo rápido…" rows="2" maxlength="120" autocomplete="off"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-confirm-cancel">Cancelar</button>
        <button class="btn btn-primary" id="btn-confirm-ok">Confirmar reserva</button>
      </div>
    </div>
  </div>`;
}

function buildCancelModal() {
  if (state.pendingSlot === null) return `<div class="modal-overlay" id="modal-cancel"></div>`;
  const typeName = state.selectedTab === 'lavado' ? 'Lavado' : 'Secado';
  const s = generateSlots(state.selectedTab)[state.pendingSlot];
  return `
  <div class="modal-overlay ${state.modal === 'cancel' ? 'open' : ''}" id="modal-cancel">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">¿Cancelar reserva?</div>
      <div class="modal-subtitle">Esta acción no se puede deshacer.</div>
      <div class="confirm-detail">
        <div class="confirm-row"><span class="label">Tipo</span><span class="value">${typeName}</span></div>
        <div class="confirm-row"><span class="label">Fecha</span><span class="value">${friendlyDate(state.selectedDate)}</span></div>
        <div class="confirm-row"><span class="label">Horario</span><span class="value">${s ? s.time + ' – ' + s.endTime : ''}</span></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancel-no">Volver</button>
        <button class="btn btn-danger" id="btn-cancel-yes">Sí, cancelar</button>
      </div>
    </div>
  </div>`;
}

function buildMyBookingsModal() {
  const mine    = myReservas();
  const sLavado = generateSlots('lavado');
  const sSecado = generateSlots('secado');

  const items = mine.map(r => {
    const s = (r.type === 'lavado' ? sLavado : sSecado)[r.slotIndex];
    return `
    <div class="booking-item">
      <div class="booking-item-info">
        <div class="booking-type">${r.type === 'lavado' ? '🫧 Lavado' : '💨 Secado'}</div>
        <div class="booking-when">${s ? s.time + ' – ' + s.endTime : ''}</div>
        <div class="booking-date">${friendlyDate(r.date)}</div>
        ${r.notes ? `<div class="booking-notes">${esc(r.notes)}</div>` : ''}
      </div>
      <button class="btn btn-danger btn-sm" data-action="cancel-from-list" data-id="${r.id}">Cancelar</button>
    </div>`;
  }).join('');

  return `
  <div class="modal-overlay ${state.modal === 'mybookings' ? 'open' : ''}" id="modal-mybookings">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">Mis reservas</div>
      <div class="modal-subtitle">${mine.length ? `${mine.length} turno${mine.length !== 1 ? 's' : ''} activo${mine.length !== 1 ? 's' : ''}` : 'No tenés reservas activas.'}</div>
      <div class="bookings-list">
        ${mine.length ? items : '<div class="empty-state">🧺 Sin reservas activas.</div>'}
      </div>
      <button class="btn btn-ghost" id="btn-mybookings-close" style="width:100%">Cerrar</button>
    </div>
  </div>`;
}

function buildProfileModal() {
  return `
  <div class="modal-overlay ${state.modal === 'profile' ? 'open' : ''}" id="modal-profile">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-title">Tu perfil</div>
      <div class="profile-info">
        <div class="p-label">Unidad funcional</div>
        <div class="p-value">${state.profile ? state.profile.unit : ''}</div>
        <div class="p-label" style="margin-top:0.75rem">Apellido</div>
        <div class="p-value">${state.profile ? state.profile.name : ''}</div>
      </div>
      <p style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem">Para cambiar tus datos, borrá el perfil y volvé a configurarlo.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-profile-modal-close">Cerrar</button>
        <button class="btn btn-danger" id="btn-reset-profile">Cerrar sesión</button>
      </div>
    </div>
  </div>`;
}

// ── EVENTS ────────────────────────────────────────────────────────────────────

function attachEvents() {

  // Onboarding
  on('btn-continue', 'click', () => {
    // If profile exists → ask for password (login). Otherwise → create account.
    state.view = state.profile ? 'login' : 'profile';
    state.loginError = false;
    render();
  });

  // Profile creation
  on('btn-save-profile', 'click', () => {
    const unit  = (document.getElementById('input-unit')?.value || '').trim().toUpperCase();
    const name  = (document.getElementById('input-name')?.value || '').trim();
    const pwd   = (document.getElementById('input-password')?.value || '');
    const pwd2  = (document.getElementById('input-password2')?.value || '');
    let valid = true;
    if (!unit)              { show('err-unit');      valid = false; } else { hide('err-unit'); }
    if (!name)              { show('err-name');      valid = false; } else { hide('err-name'); }
    if (pwd.length < 4)     { show('err-password');  valid = false; } else { hide('err-password'); }
    if (pwd !== pwd2)       { show('err-password2'); valid = false; } else { hide('err-password2'); }
    if (!valid) return;

    state.profile = { unit, name, password: pwd };
    saveProfile();
    setAuth();
    state.view = 'main';
    render();
  });

  on('input-unit',      'keydown', e => { if (e.key === 'Enter') document.getElementById('input-name')?.focus(); });
  on('input-name',      'keydown', e => { if (e.key === 'Enter') document.getElementById('input-password')?.focus(); });
  on('input-password',  'keydown', e => { if (e.key === 'Enter') document.getElementById('input-password2')?.focus(); });
  on('input-password2', 'keydown', e => { if (e.key === 'Enter') document.getElementById('btn-save-profile')?.click(); });

  // Login
  on('btn-login-submit', 'click', submitLogin);
  on('input-login-password', 'keydown', e => { if (e.key === 'Enter') submitLogin(); });

  on('btn-switch-unit', 'click', () => {
    // Log out of current profile without deleting it, go create/switch account
    clearAuth();
    state.loginError = false;
    state.view = 'profile';
    render();
  });

  // Date nav
  document.querySelectorAll('.date-btn').forEach(btn =>
    btn.addEventListener('click', () => { state.selectedDate = btn.dataset.date; render(); })
  );

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => { state.selectedTab = btn.dataset.tab; render(); })
  );

  // Book slots
  document.querySelectorAll('[data-action="book"]').forEach(btn =>
    btn.addEventListener('click', () => {
      const slotIndex = parseInt(btn.dataset.slot);
      if (wouldExceedMax(state.selectedDate, state.selectedTab, slotIndex)) {
        toast(`Máximo ${MAX_PER_DAY} turnos de ${state.selectedTab} por día.`, 'error');
        return;
      }
      state.pendingSlot = slotIndex;
      state.modal = 'confirm';
      render();
    })
  );

  // Cancel from slot
  document.querySelectorAll('[data-action="cancel"]').forEach(btn =>
    btn.addEventListener('click', () => {
      state.pendingSlot = parseInt(btn.dataset.slot);
      state.pendingReservaId = btn.dataset.reserva;
      state.modal = 'cancel';
      render();
    })
  );

  // Confirm modal
  on('btn-confirm-ok', 'click', () => {
    const notes = (document.getElementById('input-notes')?.value || '').trim();
    state.reservas.push({
      id: genId(),
      date: state.selectedDate,
      type: state.selectedTab,
      slotIndex: state.pendingSlot,
      unit: state.profile.unit,
      ownerName: state.profile.name,
      notes,
      createdAt: new Date().toISOString(),
    });
    saveData();
    state.modal = null;
    state.pendingSlot = null;
    render();
    toast('¡Turno reservado!', 'success');
  });

  on('btn-confirm-cancel', 'click', () => {
    state.modal = null; state.pendingSlot = null; render();
  });

  // Cancel modal
  on('btn-cancel-yes', 'click', () => {
    state.reservas = state.reservas.filter(r => r.id !== state.pendingReservaId);
    saveData();
    state.modal = null; state.pendingSlot = null; state.pendingReservaId = null;
    render();
    toast('Reserva cancelada.', 'success');
  });

  on('btn-cancel-no', 'click', () => {
    state.modal = null; state.pendingSlot = null; state.pendingReservaId = null; render();
  });

  // My bookings
  on('btn-my-bookings', 'click', () => { state.modal = 'mybookings'; render(); });
  on('btn-mybookings-close', 'click', () => { state.modal = null; render(); });

  document.querySelectorAll('[data-action="cancel-from-list"]').forEach(btn =>
    btn.addEventListener('click', () => {
      const r = state.reservas.find(x => x.id === btn.dataset.id);
      if (!r) return;
      state.pendingReservaId = r.id;
      state.pendingSlot = r.slotIndex;
      state.selectedTab  = r.type;
      state.selectedDate = r.date;
      state.modal = 'cancel';
      render();
    })
  );

  // Profile modal
  on('btn-profile-modal', 'click', () => { state.modal = 'profile'; render(); });
  on('btn-profile-modal-close', 'click', () => { state.modal = null; render(); });

  on('btn-reset-profile', 'click', () => {
    // Just log out (close session), keep profile and reservations intact
    clearAuth();
    state.modal = null;
    state.view = 'onboarding';
    render();
  });

  // Close modals on overlay click
  ['modal-confirm','modal-cancel','modal-mybookings','modal-profile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) { state.modal = null; render(); }});
  });
}

function submitLogin() {
  const pwd = document.getElementById('input-login-password')?.value || '';
  if (pwd === state.profile.password) {
    setAuth();
    state.loginError = false;
    state.view = 'main';
    render();
  } else {
    state.loginError = true;
    render();
    document.getElementById('input-login-password')?.focus();
  }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function on(id, ev, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(ev, fn);
}

function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── INIT ──────────────────────────────────────────────────────────────────────

loadData();
// If profile exists and session is active → main. If profile but no session → login. Otherwise → onboarding.
if (state.profile && isAuthed()) {
  state.view = 'main';
} else if (state.profile && !isAuthed()) {
  state.view = 'onboarding';
} else {
  state.view = 'onboarding';
}
render();
