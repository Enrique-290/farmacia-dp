// DASHBOARD
// ---------------------------
const elDashKpis           = document.getElementById('dashKpis');
const elChart7dias         = document.getElementById('chart7dias');
const elChartPagos         = document.getElementById('chartPagos');
const elLegendPagos        = document.getElementById('legendPagos');
const elListaUltimasVentas = document.getElementById('listaUltimasVentas');
const elListaKardex        = document.getElementById('listaKardex');

// normaliza fecha a yyyy-mm-dd
function normalizeDate(str){
  if(!str) return null;
  const d = new Date(str);
  if(isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a,b){
  return a.getFullYear()===b.getFullYear()
      && a.getMonth()===b.getMonth()
      && a.getDate()===b.getDate();
}

function renderDashboard(){
  const hoy = new Date();
  const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicio7 = new Date(hoyDia);
  inicio7.setDate(hoyDia.getDate()-6);

  const tickets = (state.historial || []).map(t => {
    // distintos nombres posibles de fecha/total/forma de pago
    const fechaStr = t.fecha || t.fechaHora || t.fechaTicket || t.date;
    const fecha    = normalizeDate(fechaStr) || hoyDia;
    const total    = Number(t.total || t.totalVenta || t.monto || t.totalTicket || 0);
    const forma    = (t.formaPago || t.metodoPago || t.pago || '').toLowerCase();
    return {...t, _fecha:fecha, _total:total, _forma:forma};
  });

  let ventasHoy = 0, ticketsHoy = 0;
  let ventasMes = 0, ticketsMes = 0;
  let totalHist = 0, totalTickets = 0;

  const pagosHoy = {efectivo:0, tarjeta:0, transferencia:0, otros:0};
  const ventasPorDia = {};  // yyyy-mm-dd -> total

  tickets.forEach(t => {
    const f = t._fecha;
    const tot = t._total;
    if(!f || !isFinite(tot)) return;

    totalHist += tot;
    totalTickets++;

    // hoy
    if(sameDay(f, hoyDia)){
      ventasHoy += tot;
      ticketsHoy++;

      if(t._forma.includes('tar'))      pagosHoy.tarjeta       += tot;
      else if(t._forma.includes('trans')) pagosHoy.transferencia += tot;
      else if(t._forma.includes('efec'))  pagosHoy.efectivo      += tot;
      else                               pagosHoy.otros         += tot;
    }

    // mes actual
    if(f.getMonth()===hoyDia.getMonth() && f.getFullYear()===hoyDia.getFullYear()){
      ventasMes += tot;
      ticketsMes++;
    }

    // últimos 7 días
    if(f>=inicio7 && f<=hoyDia){
      const key = f.toISOString().slice(0,10);
      ventasPorDia[key] = (ventasPorDia[key]||0)+tot;
    }
  });

  // ----- KPIs -----
  const ticketProm = totalTickets ? totalHist/totalTickets : 0;
  elDashKpis.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">VENTAS HOY</div>
      <div class="kpi-value">${money(ventasHoy)}</div>
      <div class="kpi-extra">${ticketsHoy} tickets hoy</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">VENTAS ESTE MES</div>
      <div class="kpi-value">${money(ventasMes)}</div>
      <div class="kpi-extra">${ticketsMes} tickets en el mes</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">TICKET PROMEDIO</div>
      <div class="kpi-value">${money(ticketProm)}</div>
      <div class="kpi-extra">${totalTickets} tickets históricos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">HISTÓRICO GENERAL</div>
      <div class="kpi-value">${money(totalHist)}</div>
      <div class="kpi-extra">Ventas totales en el sistema</div>
    </div>
  `;

  // ----- Ventas últimos 7 días -----
  const diasOrdenados = [];
  for(let i=0;i<7;i++){
    const d = new Date(inicio7);
    d.setDate(inicio7.getDate()+i);
    const key = d.toISOString().slice(0,10);
    diasOrdenados.push({
      label: `${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`,
      total: ventasPorDia[key] || 0
    });
  }
  if(diasOrdenados.every(d=>d.total===0)){
    elChart7dias.innerHTML = `<div class="chart-empty">Sin ventas en los últimos 7 días.</div>`;
  }else{
    elChart7dias.innerHTML = diasOrdenados.map(d=>`
      <div class="bar-row">
        <span class="bar-label">${d.label}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${Math.min(100, d.total===0?0:(d.total/Math.max(...diasOrdenados.map(x=>x.total)))*100)}%;"></div>
        </div>
        <span class="bar-value">${money(d.total)}</span>
      </div>
    `).join('');
  }

  // ----- Formas de pago hoy -----
  const totalPagosHoy = pagosHoy.efectivo + pagosHoy.tarjeta + pagosHoy.transferencia + pagosHoy.otros;
  if(!totalPagosHoy){
    elChartPagos.innerHTML  = `<div class="chart-empty">Sin ventas hoy.</div>`;
    elLegendPagos.innerHTML = '';
  }else{
    // solo armamos “donut” textual
    const entries = [
      {label:'Efectivo',       key:'efectivo'},
      {label:'Tarjeta',        key:'tarjeta'},
      {label:'Transferencia',  key:'transferencia'},
      {label:'Otros',          key:'otros'}
    ].filter(e => pagosHoy[e.key]>0);

    elChartPagos.innerHTML = `
      <div class="donut-text">
        ${entries.map(e=>{
          const pct = Math.round((pagosHoy[e.key]/totalPagosHoy)*100);
          return `<div class="donut-item"><span>${e.label}</span><strong>${pct}%</strong></div>`;
        }).join('')}
      </div>
    `;

    elLegendPagos.innerHTML = entries.map(e=>{
      return `<span class="donut-tag">${e.label}: ${money(pagosHoy[e.key])}</span>`;
    }).join('');
  }

  // ----- Últimas ventas -----
  if(!tickets.length){
    elListaUltimasVentas.innerHTML = `<div class="list-empty">Sin ventas registradas.</div>`;
  }else{
    const ultimas = [...tickets].sort((a,b)=>b._fecha-a._fecha).slice(0,5);
    elListaUltimasVentas.innerHTML = ultimas.map(t=>{
      const fechaTxt = t._fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'});
      return `
        <div class="list-row">
          <div>
            <div class="list-main">${money(t._total)}</div>
            <div class="list-sub">Ticket #${t.id || t.folio || '-'} · ${fechaTxt}</div>
          </div>
          <div class="list-right">${(t._forma || '').toUpperCase() || '---'}</div>
        </div>
      `;
    }).join('');
  }

  // ----- Kardex reciente (simple: últimos movimientos de inventario/bodega) -----
  const movs = (state.kardex || state.movimientos || []).slice(-5).reverse();
  if(!movs.length){
    elListaKardex.innerHTML = `<div class="list-empty">Sin movimientos recientes.</div>`;
  }else{
    elListaKardex.innerHTML = movs.map(m=>{
      const f = normalizeDate(m.fecha) || hoyDia;
      const fechaTxt = f.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit'});
      return `
        <div class="list-row">
          <div>
            <div class="list-main">${m.producto || m.sku || 'Producto'}</div>
            <div class="list-sub">${m.tipo || 'Movimiento'} · ${fechaTxt}</div>
          </div>
          <div class="list-right">${m.cantidad>0?`+${m.cantidad}`:m.cantidad || ''}</div>
        </div>
      `;
    }).join('');
  }
}

// ---------------------------
// Inicializar
// ---------------------------
elIvaPorc.value = state.config.ivaDefault || 0;
fillCategoriasSelect();
renderCatalog('');
paintCart();
renderDashboard();
renderClientes();
renderHistorial();
renderReportes();
renderInventario();
renderBodega();
