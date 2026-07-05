// ═══════════════════════════════════════════════
// PORTAL DE CUOTAS — 1° MEDIO 2026
// ═══════════════════════════════════════════════

const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1r5mdZscvgnR56-yIlH9FjEKzTLc80vahEiMoQDvFVB0/export?format=csv&gid=0';
const ADMIN_PASSWORD = 'tesorero2026';
const MESES = ['Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CUOTA_VALOR = 20000;

let appData = {
  alumnos: [],
  resumen: { entregaAnterior: 0, recaudado: 0, gastos: 0, saldo: 0 },
  lastSync: null
};

let currentUser = null; // { role: 'apoderado'|'admin', alumnoIdx: number }
let chartMensual = null;
let chartEstado = null;
let chartApodCurso = null;
let allAlumnosRaw = [];

// ── Storage helpers ──────────────────────────────
function saveAccounts(accounts) { localStorage.setItem('cuotas_accounts', JSON.stringify(accounts)); }
function loadAccounts() { return JSON.parse(localStorage.getItem('cuotas_accounts') || '{}'); }
function saveCachedData(data) { localStorage.setItem('cuotas_data', JSON.stringify(data)); }
function loadCachedData() { return JSON.parse(localStorage.getItem('cuotas_data') || 'null'); }

// ── Role selector ────────────────────────────────
function selectRole(role) {
  document.getElementById('btn-apoderado').classList.toggle('active', role === 'apoderado');
  document.getElementById('btn-tesorero').classList.toggle('active', role === 'tesorero');
  document.getElementById('form-apoderado').classList.toggle('hidden', role !== 'apoderado');
  document.getElementById('form-tesorero').classList.toggle('hidden', role === 'apoderado');
  clearError();
}

// ── Alumno search ────────────────────────────────
let selectedAlumno = null;

function filterAlumnos(val) {
  const dd = document.getElementById('alumno-dropdown');
  if (!val.trim()) { dd.classList.add('hidden'); return; }
  const matches = appData.alumnos.filter(a => a.nombre.toLowerCase().includes(val.toLowerCase())).slice(0, 10);
  if (!matches.length) { dd.classList.add('hidden'); return; }
  dd.innerHTML = matches.map((a, i) =>
    `<div class="dropdown-item" onclick="selectAlumno(${a.idx})">${a.nombre}</div>`
  ).join('');
  dd.classList.remove('hidden');
}

function selectAlumno(idx) {
  selectedAlumno = appData.alumnos.find(a => a.idx === idx);
  document.getElementById('alumno-dropdown').classList.add('hidden');
  document.getElementById('search-alumno').value = '';
  document.getElementById('selected-alumno-info').classList.remove('hidden');
  document.getElementById('selected-alumno-name').textContent = selectedAlumno.nombre;
  document.getElementById('password-section').classList.remove('hidden');

  const accounts = loadAccounts();
  const hasAccount = !!accounts[idx];
  document.getElementById('password-label').textContent = hasAccount ? 'Contraseña' : 'Crear contraseña';
  document.getElementById('new-account-hint').classList.toggle('hidden', hasAccount);
  document.getElementById('btn-forgot-password').classList.toggle('hidden', !hasAccount);
  document.getElementById('login-btn-text').textContent = hasAccount ? 'Ingresar' : 'Crear cuenta e ingresar';
  clearError();
}

function resetPassword() {
  if (!selectedAlumno) return;
  if (confirm('¿Olvidaste tu contraseña actual? Al aceptar, se borrará la clave guardada en este dispositivo y podrás crear una nueva. ¿Deseas continuar?')) {
    const accounts = loadAccounts();
    delete accounts[selectedAlumno.idx];
    saveAccounts(accounts);
    document.getElementById('apoderado-password').value = '';
    // Refrescar el formulario simulando que seleccionó al alumno nuevamente
    selectAlumno(selectedAlumno.idx);
    toast('Contraseña reseteada. Ahora ingresa tu nueva clave.');
  }
}

function clearAlumnoSelection() {
  selectedAlumno = null;
  document.getElementById('selected-alumno-info').classList.add('hidden');
  document.getElementById('password-section').classList.add('hidden');
  document.getElementById('search-alumno').value = '';
  clearError();
}

// ── Login logic ──────────────────────────────────

// Apoderados con acceso al panel del Tesorero (en minúsculas para comparación)
const ADMIN_ALUMNOS = [
  'vergara arias victor',
  'arce solar francisco'
];

function esAdminAlumno(nombre) {
  return ADMIN_ALUMNOS.some(n => nombre.toLowerCase().includes(n) || n.includes(nombre.toLowerCase()));
}

function loginApoderado() {
  if (!selectedAlumno) { showError('Selecciona un alumno/a.'); return; }
  const pwd = document.getElementById('apoderado-password').value.trim();
  if (!pwd || pwd.length < 4) { showError('La contraseña debe tener al menos 4 caracteres.'); return; }

  const accounts = loadAccounts();
  const idx = selectedAlumno.idx;

  if (accounts[idx]) {
    if (accounts[idx] !== pwd) { showError('Contraseña incorrecta.'); return; }
  } else {
    accounts[idx] = pwd;
    saveAccounts(accounts);
  }

  // Si el alumno tiene privilegios de admin, ir al panel del tesorero
  if (esAdminAlumno(selectedAlumno.nombre)) {
    currentUser = { role: 'admin', alumnoIdx: idx };
    showScreen('admin');
    renderAdmin();
  } else {
    currentUser = { role: 'apoderado', alumnoIdx: idx };
    showScreen('apoderado');
    renderApoderado();
  }
}

function loginAdmin() {
  const pwd = document.getElementById('admin-password').value.trim();
  if (pwd !== ADMIN_PASSWORD) { showError('Clave incorrecta.'); return; }
  currentUser = { role: 'admin' };
  showScreen('admin');
  renderAdmin();
}

function logout() {
  currentUser = null;
  showScreen('login');
  document.getElementById('apoderado-password').value = '';
  document.getElementById('admin-password').value = '';
  clearAlumnoSelection();
}

// ── Screen switching ─────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() { document.getElementById('login-error').classList.add('hidden'); }

// ── Toast ────────────────────────────────────────
function toast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), duration);
}

// ── Format currency ──────────────────────────────
function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

// ── Parse CSV ────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r/g, ''));
  const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

  // Extract header summary from top rows
  let entregaAnterior = 0, recaudado = 0, gastos = 0, saldo = 0;
  lines.forEach(l => {
    if (!l.trim()) return;
    const cols = l.split(csvRegex).map(c => c.replace(/^"|"$/g, ''));
    if (cols[2] && cols[2].includes('Entrega directiva')) entregaAnterior = parseFloat((cols[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (cols[2] && cols[2].trim() === 'Cuenta individual') recaudado = parseFloat((cols[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (cols[2] && cols[2].trim() === 'Gastos') gastos = parseFloat((cols[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (cols[2] && cols[2].trim() === 'Total') saldo = parseFloat((cols[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;
  });

  // Find data rows (rows with a number in col index 1)
  const alumnos = [];
  lines.forEach(l => {
    if (!l.trim()) return;
    const cols = l.split(csvRegex).map(c => c.replace(/^"|"$/g, ''));
    const num = parseInt(cols[1]);
    if (!isNaN(num) && num >= 1 && num <= 36 && cols[2] && cols[2].trim()) {
      const nombre = cols[2].trim();
      const cuentaIndividual = parseFloat((cols[3] || '0').replace(/\./g, '').replace(',', '.')) || 0;

      // Cuotas mensuales: cols 10-19 (Marzo a Diciembre) based on CSV structure
      // cols[9]=Total cuotas, cols[10]=Marzo, cols[11]=abril, ..., cols[19]=diciembre
      const cuotas = {};
      MESES.forEach((mes, i) => {
        const raw = cols[10 + i] || '';
        const val = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
        cuotas[mes] = val;
      });

      // Reuniones: cols 5-8
      const reuniones = {};
      ['Reunión 1','Reunión 2','Reunión 3','Reunión 4'].forEach((r, i) => {
        const raw = cols[5 + i] || '';
        reuniones[r] = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
      });

      alumnos.push({ idx: num, nombre, cuentaIndividual, cuotas, reuniones });
    }
  });

  return { alumnos, resumen: { entregaAnterior, recaudado, gastos, saldo } };
}

// ── Sync from Google Sheets ──────────────────────
async function syncData() {
  const icons = ['sync-icon', 'sync-icon-admin'].map(id => document.getElementById(id)).filter(Boolean);
  icons.forEach(el => el.parentElement.classList.add('spinning'));
  toast('Sincronizando con Google Sheets…');

  try {
    // Usamos el endpoint oficial de Google Visualization que no requiere proxy CORS
    const url = 'https://docs.google.com/spreadsheets/d/1r5mdZscvgnR56-yIlH9FjEKzTLc80vahEiMoQDvFVB0/gviz/tq?tqx=out:csv&gid=0&_t=' + Date.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const csv = await res.text();
    const parsed = parseCSV(csv);
    if (parsed.alumnos.length > 0) {
      appData = { ...parsed, lastSync: new Date().toISOString() };
      saveCachedData(appData);
      toast('✅ Datos actualizados — ' + parsed.alumnos.length + ' alumnos');
    } else {
      throw new Error('No se encontraron datos');
    }
  } catch (e) {
    console.warn('Sync error:', e);
    toast('⚠️ Sin conexión — usando datos guardados');
  } finally {
    icons.forEach(el => el.parentElement.classList.remove('spinning'));
    if (currentUser?.role === 'apoderado') renderApoderado();
    else if (currentUser?.role === 'admin') renderAdmin();
  }
}

// ── Render: Apoderado ────────────────────────────
function renderApoderado() {
  const alumno = appData.alumnos.find(a => a.idx === currentUser.alumnoIdx);
  if (!alumno) return;

  document.getElementById('nav-alumno-name').textContent = alumno.nombre;

  // Cuotas stats
  const pagas = MESES.filter(m => alumno.cuotas[m] > 0);
  const pendientes = MESES.filter(m => alumno.cuotas[m] === 0);
  const proximo = pendientes[0] || '—';

  document.getElementById('apod-cuenta').textContent = fmt(alumno.cuentaIndividual);
  document.getElementById('apod-pagadas').textContent = pagas.length + ' / ' + MESES.length;
  document.getElementById('apod-pendientes').textContent = pendientes.length;
  document.getElementById('apod-proximo').textContent = proximo;

  // Cuotas grid
  const grid = document.getElementById('apod-cuotas-grid');
  grid.innerHTML = MESES.map(mes => {
    const val = alumno.cuotas[mes];
    const cls = val > 0 ? 'cuota-pagada' : 'cuota-pendiente';
    return `<div class="cuota-chip ${cls}">
      <span class="cuota-icon"></span>
      <span class="cuota-mes">${mes.substring(0,3)}</span>
      <span class="cuota-monto">${val > 0 ? fmt(val) : 'Pendiente'}</span>
    </div>`;
  }).join('');

  // Course summary
  const r = appData.resumen;
  document.getElementById('apod-course-summary').innerHTML = `
    <div class="finance-item"><span class="finance-item-label">Total Recaudado</span><span class="finance-item-value finance-green">${fmt(r.recaudado)}</span></div>
    <div class="finance-item"><span class="finance-item-label">Saldo Disponible</span><span class="finance-item-value finance-blue">${fmt(r.saldo)}</span></div>
    <div class="finance-item"><span class="finance-item-label">Gastos</span><span class="finance-item-value finance-red">${fmt(r.gastos)}</span></div>
    <div class="finance-item"><span class="finance-item-label">Fondo Inicial</span><span class="finance-item-value finance-amber">${fmt(r.entregaAnterior)}</span></div>
  `;

  // Chart: course recaudacion by month
  const mensualData = MESES.map(mes => {
    return appData.alumnos.reduce((sum, a) => sum + (a.cuotas[mes] || 0), 0);
  });

  if (chartApodCurso) chartApodCurso.destroy();
  const ctx = document.getElementById('chart-apod-curso').getContext('2d');
  chartApodCurso = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MESES.map(m => m.substring(0, 3)),
      datasets: [{
        label: 'Recaudado',
        data: mensualData,
        backgroundColor: 'rgba(139,92,246,0.5)',
        borderColor: 'rgba(139,92,246,0.9)',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: chartOptionsBar('Recaudación mensual del curso')
  });
}

// ── Render: Admin ────────────────────────────────
function renderAdmin() {
  const r = appData.resumen;

  // KPIs
  document.getElementById('admin-recaudado').textContent = fmt(r.recaudado);
  document.getElementById('admin-saldo').textContent = fmt(r.saldo);
  document.getElementById('admin-gastos').textContent = fmt(r.gastos);

  // Determinar meses esperados hasta la fecha actual (Marzo = mes 2 en JS, Abril = 3)
  const currentMonth = new Date().getMonth();
  // Si estamos antes de marzo, exigimos 0. Si estamos en abril (3), exigimos 2 (Marzo, Abril).
  const expectedCount = Math.max(1, currentMonth - 1); 
  const expectedMeses = MESES.slice(0, expectedCount);

  // Alumnos Al Día %
  const alDia = appData.alumnos.filter(a => expectedMeses.every(m => a.cuotas[m] > 0)).length;
  const pct = appData.alumnos.length > 0 ? Math.round((alDia / appData.alumnos.length) * 100) : 0;
  document.getElementById('admin-cobranza').textContent = pct + '%';

  if (appData.lastSync) {
    document.getElementById('last-update').textContent = 'Última sync: ' + new Date(appData.lastSync).toLocaleString('es-CL');
  }

  // Chart mensual
  const mensualData = MESES.map(mes => appData.alumnos.reduce((s, a) => s + (a.cuotas[mes] || 0), 0));
  if (chartMensual) chartMensual.destroy();
  const ctx1 = document.getElementById('chart-admin-mensual').getContext('2d');
  chartMensual = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: MESES.map(m => m.substring(0, 3)),
      datasets: [{
        label: 'Recaudado',
        data: mensualData,
        backgroundColor: mensualData.map(v => v > 0 ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.07)'),
        borderColor: mensualData.map(v => v > 0 ? 'rgba(139,92,246,0.9)' : 'rgba(255,255,255,0.15)'),
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: chartOptionsBar('Recaudación por mes')
  });

  // Chart estado (donut)
  const sinPagos = appData.alumnos.filter(a => MESES.every(m => (a.cuotas[m] || 0) === 0)).length;
  const parciales = appData.alumnos.length - alDia - sinPagos;

  if (chartEstado) chartEstado.destroy();
  const ctx2 = document.getElementById('chart-admin-estado').getContext('2d');
  chartEstado = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Al día', 'Parciales', 'Sin pagos'],
      datasets: [{
        data: [alDia, Math.max(0, parciales), sinPagos],
        backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
        borderColor: ['rgba(16,185,129,1)', 'rgba(245,158,11,1)', 'rgba(239,68,68,1)'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, cutout: '68%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + c.raw + ' alumnos' } } }
    }
  });

  document.getElementById('legend-estado').innerHTML = [
    { color: '#10b981', label: `Al día (${alDia})` },
    { color: '#f59e0b', label: `Parciales (${Math.max(0, parciales)})` },
    { color: '#ef4444', label: `Sin pagos (${sinPagos})` }
  ].map(x => `<div class="legend-item"><div class="legend-dot" style="background:${x.color}"></div><span>${x.label}</span></div>`).join('');

  // Table
  renderAdminTable(appData.alumnos);
}

function renderAdminTable(alumnos) {
  const head = document.getElementById('admin-table-head');
  const body = document.getElementById('admin-table-body');

  head.innerHTML = `<tr>
    <th class="col-num">N°</th>
    <th>Alumno/a</th>
    <th>Cuenta Indiv.</th>
    ${MESES.map(m => `<th>${m.substring(0,3)}</th>`).join('')}
  </tr>`;

  body.innerHTML = alumnos.map(a => `
    <tr>
      <td class="col-num">${a.idx}</td>
      <td>${a.nombre}</td>
      <td class="col-cuenta">${fmt(a.cuentaIndividual)}</td>
      ${MESES.map(m => {
        const v = a.cuotas[m];
        if (v > 0) return `<td><span class="badge badge-paid">${fmt(v)}</span></td>`;
        return `<td><span class="badge badge-pending">Pendiente</span></td>`;
      }).join('')}
    </tr>
  `).join('');
}

function filterAdminTable(val) {
  const filtered = val.trim()
    ? appData.alumnos.filter(a => a.nombre.toLowerCase().includes(val.toLowerCase()))
    : appData.alumnos;
  renderAdminTable(filtered);
}

// ── Chart options ────────────────────────────────
function chartOptionsBar(title) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: c => ' ' + fmt(c.raw) } }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 }, callback: v => '$' + (v/1000).toFixed(0) + 'k' } }
    }
  };
}

// ── Export CSV ───────────────────────────────────
function exportCSV() {
  const header = ['N°', 'Alumno', 'Cuenta Individual', ...MESES];
  const rows = appData.alumnos.map(a => [
    a.idx, a.nombre, a.cuentaIndividual,
    ...MESES.map(m => a.cuotas[m] || 0)
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cuotas_1medio_2026.csv';
  link.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV exportado');
}

// ── Init ─────────────────────────────────────────
async function init() {
  // Load cached data first
  const cached = loadCachedData();
  if (cached && cached.alumnos && cached.alumnos.length > 0) {
    appData = cached;
  } else {
    // Use hardcoded fallback from spreadsheet
    appData = getHardcodedData();
  }

  showScreen('login');

  // Sync in background
  try {
    const url = 'https://docs.google.com/spreadsheets/d/1r5mdZscvgnR56-yIlH9FjEKzTLc80vahEiMoQDvFVB0/gviz/tq?tqx=out:csv&gid=0&_t=' + Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const csv = await res.text();
      const parsed = parseCSV(csv);
      if (parsed.alumnos.length > 0) {
        appData = { ...parsed, lastSync: new Date().toISOString() };
        saveCachedData(appData);
      }
    }
  } catch (e) {
    console.log('Background sync skipped:', e.message);
  }
}

// ── Hardcoded fallback data (from the real spreadsheet) ──
function getHardcodedData() {
  const raw = [
    [1,'ACEVEDO DIGMAN EMILIO GABRIEL',10203,[0,0,0,0,0,0,0,0,0,0]],
    [2,'ALCANTAR VEGA EMMA SOFIA',10203,[0,0,0,0,0,0,0,0,0,0]],
    [3,'ALVAREZ YOUNG BARBARA',10203,[0,0,0,0,0,0,0,0,0,0]],
    [4,'APARICIO ESPINOZA VICENTE FELIPE',10203,[0,0,0,0,0,0,0,0,0,0]],
    [5,'ARCE SOLAR FRANCISCO JAVIER',10203,[0,0,0,0,0,0,0,0,0,0]],
    [6,'BRAVO GONZÁLEZ DIEGO IGNACIO',10203,[0,0,0,0,0,0,0,0,0,0]],
    [7,'BRIONES ESCOBAR TOMAS',10203,[0,0,0,0,0,0,0,0,0,0]],
    [8,'BUSTOS FARIAS DIEGO',10203,[0,0,0,0,0,0,0,0,0,0]],
    [9,'CASTILLO SILVA GABRIEL',10203,[0,0,0,0,0,0,0,0,0,0]],
    [10,'CID MORALES JOSEFA',62488,[20000,20000,20000,0,0,0,0,0,0,0]],
    [11,'CONTRERAS TOBAR LUCAS',2488,[0,0,0,0,0,0,0,0,0,0]],
    [12,'ELGUETA MARCHANT CAMILA',51203,[20000,20000,0,0,0,0,0,0,0,0]],
    [13,'ESCANILLA SAAVEDRA MARTINA',50203,[20000,20000,0,0,0,0,0,0,0,0]],
    [14,'FERNANDEZ FONTECILLA ELOISA',50203,[20000,20000,0,0,0,0,0,0,0,0]],
    [15,'GONZALEZ GUTIERREZ GASPAR',2488,[0,0,0,0,0,0,0,0,0,0]],
    [16,'LEPE MUÑOZ ALONSO',10203,[0,0,0,0,0,0,0,0,0,0]],
    [17,'MARTINEZ GUZMAN SOFIA',10203,[0,0,0,0,0,0,0,0,0,0]],
    [18,'MARZAN GAETE NICOLAS',10203,[0,0,0,0,0,0,0,0,0,0]],
    [19,'MELIN ACEITUNO CONSTANZA',30203,[20000,0,0,0,0,0,0,0,0,0]],
    [20,'MILLACARIS PONCE JOAQUIN',10203,[0,0,0,0,0,0,0,0,0,0]],
    [21,'NUÑEZ DIAZ MAXIMILIANO',2488,[0,0,0,0,0,0,0,0,0,0]],
    [22,'NUÑEZ KUNCAR SANTIAGO',10203,[0,0,0,0,0,0,0,0,0,0]],
    [23,'ORELLANA GONZÁLEZ AMPARO',10203,[0,0,0,0,0,0,0,0,0,0]],
    [24,'OSORIO PEÑA FLORENCIA',2488,[0,0,0,0,0,0,0,0,0,0]],
    [25,'PAREDES ABARZA JAVIER',10203,[0,0,0,0,0,0,0,0,0,0]],
    [26,'PAVEZ ACEVEDO MARÍA JESÚS',2488,[0,0,0,0,0,0,0,0,0,0]],
    [27,'POBLETE OSSANDON ANTONIA',10203,[0,0,0,0,0,0,0,0,0,0]],
    [28,'ROJAS MALDINI MARÍA JESÚS',10203,[0,0,0,0,0,0,0,0,0,0]],
    [29,'ROJAS VARGAS ALVARO',110203,[20000,20000,20000,20000,20000,0,0,0,0,0]],
    [30,'SALAZAR BÓRQUEZ PAZ',10203,[0,0,0,0,0,0,0,0,0,0]],
    [31,'VALVERDE DONOSO VICENTE',10203,[0,0,0,0,0,0,0,0,0,0]],
    [32,'VARGAS BERRIOS LUCAS',50203,[20000,20000,0,0,0,0,0,0,0,0]],
    [33,'VÁSQUEZ DIAZ AMANDA',2488,[0,0,0,0,0,0,0,0,0,0]],
    [34,'VERA CASTRO AGUSTIN',10203,[0,0,0,0,0,0,0,0,0,0]],
    [35,'VERGARA ARIAS VICTOR',15203,[5000,0,0,0,0,0,0,0,0,0]],
    [36,'YAÑEZ NIÑO ISIDORA',2488,[0,0,0,0,0,0,0,0,0,0]],
  ];

  const alumnos = raw.map(([idx, nombre, cuentaIndividual, pagos]) => ({
    idx, nombre, cuentaIndividual,
    cuotas: Object.fromEntries(MESES.map((m, i) => [m, pagos[i]])),
    reuniones: {}
  }));

  return {
    alumnos,
    resumen: { entregaAnterior: 357502, recaudado: 651580, gastos: 360550, saldo: 648532 },
    lastSync: null
  };
}

document.addEventListener('DOMContentLoaded', init);
