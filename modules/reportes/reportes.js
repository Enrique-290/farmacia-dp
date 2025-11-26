// REPORTES avanzados
  // ---------------------------
  const elReportesResumen = document.getElementById('reportesResumen');
  const elRepDesde       = document.getElementById('repDesde');
  const elRepHasta       = document.getElementById('repHasta');
  const elRepFormaPago   = document.getElementById('repFormaPago');
  const elRepChartDias   = document.getElementById('repChartDias');
  const elRepChartPagos  = document.getElementById('repChartPagos');
  const elRepLegendPagos = document.getElementById('repLegendPagos');
  const elRepTopProductos = document.getElementById('repTopProductos');
  const btnRepHoy        = document.getElementById('btnRepHoy');
  const btnRepMes        = document.getElementById('btnRepMes');
  const btnRepTodo       = document.getElementById('btnRepTodo');

  // Filtro base de reportes (se apoya en state.ventas)
  function getVentasPeriodo() {
    let arr = state.ventas.slice();

    const dDesde = elRepDesde.value;
    const dHasta = elRepHasta.value;
    const forma  = elRepFormaPago.value;

    if (dDesde) {
      arr = arr.filter(v => v.fechaISO.slice(0, 10) >= dDesde);
    }
    if (dHasta) {
      arr = arr.filter(v => v.fechaISO.slice(0, 10) <= dHasta);
    }
    if (forma) {
      arr = arr.filter(v => v.formaPago === forma);
    }
    return arr;
  }

  function renderReportes() {
    const ventas = getVentasPeriodo();
    const total = ventas.reduce((a, v) => a + v.total, 0);
    const tickets = ventas.length;
    const iva = ventas.reduce((a, v) => a + (v.ivaMonto || 0), 0);
    const descuentos = ventas.reduce((a, v) => a + (v.descMonto || 0), 0);
    const promedio = tickets ? total / tickets : 0;

    const totalHistorico = state.ventas.reduce((a, v) => a + v.total, 0);
    const ticketsHistorico = state.ventas.length;

    // KPIs en el contenedor reportesResumen (reutilizamos estilos de dashboard)
    elReportesResumen.innerHTML = `
      <div class="dash-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total periodo</div>
          <div class="kpi-value">${money(total)}</div>
          <div class="kpi-extra">${tickets} tickets</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ticket promedio</div>
          <div class="kpi-value">${money(promedio)}</div>
          <div class="kpi-extra">Con base en el filtro actual</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">IVA en periodo</div>
          <div class="kpi-value">${money(iva)}</div>
          <div class="kpi-extra">Descuentos: ${money(descuentos)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Histórico general</div>
          <div class="kpi-value">${money(totalHistorico)}</div>
          <div class="kpi-extra">${ticketsHistorico} tickets acumulados</div>
        </div>
      </div>
    `;

    // --- Gráfica: ventas por día ---
    elRepChartDias.innerHTML = '';
    if (!ventas.length) {
      const p = document.createElement('p');
      p.style.fontSize = '12px';
      p.style.color = '#6b7280';
      p.textContent = 'Sin ventas para los filtros seleccionados.';
      elRepChartDias.appendChild(p);

      elRepChartPagos.innerHTML = '';
      elRepLegendPagos.innerHTML = '';
      elRepTopProductos.innerHTML = '';
      return;
    }

    // Agrupar por día
    const mapaDias = {};
    ventas.forEach(v => {
      const d = v.fechaISO.slice(0, 10); // YYYY-MM-DD
      mapaDias[d] = (mapaDias[d] || 0) + v.total;
    });
    const diasOrdenados = Object.keys(mapaDias).sort();
    const datosDias = diasOrdenados.map(d => ({
      fecha: d.slice(5), // MM-DD
      total: mapaDias[d]
    }));
    const maxDia = Math.max(...datosDias.map(d => d.total), 1);

    datosDias.forEach(d => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = d.fecha;
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = (d.total / maxDia * 100) + '%';
      track.appendChild(fill);
      row.appendChild(lbl);
      row.appendChild(track);
      elRepChartDias.appendChild(row);
    });

    // --- Gráfica: formas de pago ---
    const pagos = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Mixto: 0 };
    ventas.forEach(v => {
      if (pagos[v.formaPago] != null) {
        pagos[v.formaPago] += v.total;
      }
    });
    elRepChartPagos.innerHTML = '';
    elRepLegendPagos.innerHTML = '';
    const totalPagos = Object.values(pagos).reduce((a, v) => a + v, 0) || 1;

    Object.entries(pagos).forEach(([medio, valor]) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = medio;
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = (valor / totalPagos * 100) + '%';
      track.appendChild(fill);
      row.appendChild(lbl);
      row.appendChild(track);
      elRepChartPagos.appendChild(row);

      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = `${medio}: ${money(valor)}`;
      elRepLegendPagos.appendChild(pill);
    });

    // --- Top productos (por total de venta) ---
    const mapaProd = {};
    ventas.forEach(v => {
      (v.items || []).forEach(it => {
        const key = it.nombre || it.sku || 'SIN NOMBRE';
        if (!mapaProd[key]) {
          mapaProd[key] = { nombre: key, cant: 0, total: 0 };
        }
        mapaProd[key].cant += it.cant || 0;
        mapaProd[key].total += (it.cant || 0) * (it.precio || 0);
      });
    });

    const listaProd = Object.values(mapaProd)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    elRepTopProductos.innerHTML = '';
    listaProd.forEach(p => {
      const tr = document.createElement('tr');
      const tdNom = document.createElement('td');
      tdNom.textContent = p.nombre;
      const tdCant = document.createElement('td');
      tdCant.textContent = p.cant;
      const tdTotal = document.createElement('td');
      tdTotal.textContent = money(p.total);
      tr.appendChild(tdNom);
      tr.appendChild(tdCant);
      tr.appendChild(tdTotal);
      elRepTopProductos.appendChild(tr);
    });
  }

  // Listeners de filtros de reportes
  [elRepDesde, elRepHasta, elRepFormaPago].forEach(ctrl => {
    if (!ctrl) return;
    ctrl.addEventListener('input', renderReportes);
    ctrl.addEventListener('change', renderReportes);
  });

  if (btnRepHoy) {
    btnRepHoy.addEventListener('click', () => {
      const hoy = new Date().toISOString().slice(0, 10);
      elRepDesde.value = hoy;
      elRepHasta.value = hoy;
      renderReportes();
    });
  }
  if (btnRepMes) {
    btnRepMes.addEventListener('click', () => {
      const ahora = new Date();
      const y = ahora.getFullYear();
      const m = String(ahora.getMonth() + 1).padStart(2, '0');
      elRepDesde.value = `${y}-${m}-01`;
      // último día del mes
      const ultimoDia = new Date(y, ahora.getMonth() + 1, 0).getDate();
      elRepHasta.value = `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`;
      renderReportes();
    });
  }
  if (btnRepTodo) {
    btnRepTodo.addEventListener('click', () => {
      elRepDesde.value = '';
      elRepHasta.value = '';
      elRepFormaPago.value = '';
      renderReportes();
    });
  } 

// ---------------------------
// CONFIG
// ---------------------------
const elCfgNegocio      = document.getElementById('cfgNegocio');
const elCfgRFC          = document.getElementById('cfgRFC');
const elCfgDireccion    = document.getElementById('cfgDireccion');
const elCfgTelefono     = document.getElementById('cfgTelefono');
const elCfgIva          = document.getElementById('cfgIva');
const elCfgMensaje      = document.getElementById('cfgMensaje');
const elBtnGuardarCfg   = document.getElementById('btnGuardarCfg');
const elBtnExportJson   = document.getElementById('btnExportJson');
const elInputImportJson = document.getElementById('inputImportJson');

function loadConfigForm(){
  elCfgNegocio.value   = state.config.negocio   || '';
  elCfgRFC.value       = state.config.rfc       || '';
  elCfgDireccion.value = state.config.direccion || '';
  elCfgTelefono.value  = state.config.telefono  || '';
  elCfgIva.value       = state.config.ivaDefault || 0;
  elCfgMensaje.value   = state.config.mensajeTicket || '';
}

elBtnGuardarCfg.addEventListener('click', () => {
  state.config.negocio       = elCfgNegocio.value.trim()   || 'Farmacia DP';
  state.config.rfc           = elCfgRFC.value.trim()       || '';
  state.config.direccion     = elCfgDireccion.value.trim() || '';
  state.config.telefono      = elCfgTelefono.value.trim()  || '';
  state.config.ivaDefault    = Number(elCfgIva.value) || 0;
  state.config.mensajeTicket = elCfgMensaje.value.trim() || '¡Gracias por su compra!';

  saveState();
  alert('Configuración guardada.');
});

elBtnExportJson.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state,null,2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'farmacia_dp_backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

elInputImportJson.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    try {
      const imported = JSON.parse(ev.target.result);
      state = Object.assign(state, imported);
      ensureLotesStructure();
      if (!Array.isArray(state.categorias) || !state.categorias.length){
        state.categorias = ['Original','Genérico','Controlado','Perfumería'];
      }
      saveState();
      alert('Backup restaurado. Recarga la página para aplicar todo.');
    } catch(err){
      alert('Error al importar JSON');
    }
  };
  reader.readAsText(file);
});

// ---------------------------
