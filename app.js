// ======= Parámetros Dashboard =======
const DB_DIAS_CAD = 30;            // umbral caducidad
const DB_STOCK_CRITICO = 5;        // badge crítico fijo (rojo). Stock bajo usa item.stock_min si existe

// ======= Helpers comunes =======
const fmtDate = iso => new Date(iso).toLocaleString('es-MX');
const todayISO = () => new Date().toISOString().slice(0,10);
const firstDayOfMonthISO = () => { const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); };

// ======= Navegación rápida (Accesos rápidos) =======
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('.dash-actions .btn');
  if(!btn) return;
  const tab = btn.getAttribute('data-goto');
  if(!tab) return;
  // Activa tab (usa tu manejador existente si tienes)
  document.querySelectorAll('nav button[data-tab]').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===tab);
  });
  ['dashboard','ventas','inventario','bodega','clientes','historial','reportes','config'].forEach(id=>{
    const sec = document.querySelector('#tab-'+id);
    if(sec) sec.style.display = (id===tab)?'block':'none';
  });
});

// ======= Render principal =======
function renderDashboard(){
  renderKPIs();
  renderAlertas();
  renderGrafica7d();
  renderGraficaPago();
  renderGraficaSurtidos();
  renderUltimasVentas();
  renderKardexReciente();
}

// --- KPIs
function renderKPIs(){
  const hoy = todayISO();
  const ventasHoy = (state.sales||[]).filter(v=> (v.fecha||'').startsWith(hoy));
  const totalHoy = ventasHoy.reduce((a,v)=>a+v.total,0);
  const ivaHoy = ventasHoy.reduce((a,v)=>a+v.iva,0);
  const prom = ventasHoy.length? totalHoy/ventasHoy.length : 0;

  const mesIni = firstDayOfMonthISO();
  const ventasMes = (state.sales||[]).filter(v=> (v.fecha||'')>=mesIni);
  const totalMes = ventasMes.reduce((a,v)=>a+v.total,0);

  // Top producto/servicio HOY
  let mapProd={}, mapServ={};
  ventasHoy.forEach(v=> v.items.forEach(it=>{
    const tipo = (state.items.find(p=>p.sku===it.sku)?.tipo)||'producto';
    if(tipo==='servicio') mapServ[it.sku]=(mapServ[it.sku]||0)+it.cant;
    else mapProd[it.sku]=(mapProd[it.sku]||0)+it.cant;
  }));
  const topP = Object.entries(mapProd).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topS = Object.entries(mapServ).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const nombre = sku => state.items.find(i=>i.sku===sku)?.nombre || '—';

  document.getElementById('db_ventas_hoy').textContent = money(totalHoy);
  document.getElementById('db_tickets_hoy').textContent = ventasHoy.length;
  document.getElementById('db_prom_ticket').textContent = money(prom);
  document.getElementById('db_iva_hoy').textContent = money(ivaHoy);
  document.getElementById('db_ventas_mes').textContent = money(totalMes);
  document.getElementById('db_top_prod').textContent = topP ? nombre(topP) : '—';
  document.getElementById('db_top_serv').textContent = topS ? nombre(topS) : '—';
}

// --- Alertas
function renderAlertas(){
  const UL = document.getElementById('db_alertas'); UL.innerHTML='';
  const alertas = [];

  // 1) Solicitudes pendientes/parciales
  const pend = (state.solicitudes||[]).filter(s=> s.estado==='Pendiente' || s.estado==='Parcial').length;
  if(pend>0) alertas.push(`🔔 Solicitudes sin atender: ${pend}`);

  // 2) Stock bajo (usa stock_min si existe, de lo contrario 5)
  (state.items||[]).forEach(it=>{
    if(it.tipo==='producto'){
      const min = Number.isFinite(it.stock_min)? it.stock_min : 5;
      if((it.stock_inventario||0) > 0 && (it.stock_inventario||0) <= min){
        alertas.push(`⚠️ Stock bajo en piso: ${it.nombre} (piso ${it.stock_inventario} / min ${min})`);
      }
      if((it.stock_inventario||0) === 0 && (it.stock_bodega||0) > 0){
        alertas.push(`🟡 Sin piso con bodega disponible: ${it.nombre} (sugerir Surtir)`);
      }
      if((it.stock_inventario||0) <= DB_STOCK_CRITICO){
        alertas.push(`🟥 Stock crítico: ${it.nombre} (piso ${it.stock_inventario ?? 0})`);
      }
    }
  });

  // 3) Próximos a caducar (≤ 30 días) y caducados (bodega y/o piso si manejas lotes de piso)
  const hoy = new Date();
  const ms30 = DB_DIAS_CAD*24*60*60*1000;
  (state.items||[]).forEach(it=>{
    if(it.tipo!=='producto') return;
    const lotes = (it.lotes||[]);
    lotes.forEach(L=>{
      const d = new Date(L.cad);
      const diff = d - hoy;
      if(L.stock>0){
        if(diff<0) alertas.push(`🛑 Caducado: ${it.nombre} (lote ${L.lote}, ${L.cad})`);
        else if(diff<=ms30) alertas.push(`⏳ Próximo a caducar: ${it.nombre} (lote ${L.lote}, ${L.cad})`);
      }
    });
  });

  if(alertas.length===0) alertas.push('✅ Sin alertas por ahora.');
  alertas.slice(0,20).forEach(t=>{
    const li = document.createElement('li'); li.textContent = t; UL.appendChild(li);
  });
}

// --- Gráfica 7 días (barras)
function renderGrafica7d(){
  const cvs = document.getElementById('db_chart_7d'); const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const days = [...Array(7)].map((_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(6-i)); return d;
  });
  const sums = days.map(d=>{
    const k = d.toISOString().slice(0,10);
    return (state.sales||[]).filter(v=> (v.fecha||'').startsWith(k)).reduce((a,v)=>a+v.total,0);
  });
  const max = Math.max(...sums,1);
  const W=cvs.width, H=cvs.height, pad=20, bw=(W-2*pad)/7*0.7;
  days.forEach((d,i)=>{
    const x = pad + i*((W-2*pad)/7);
    const h = (H-2*pad)*(sums[i]/max);
    ctx.fillRect(x, H-pad-h, bw, h);   // usa el color por defecto del canvas
    ctx.fillText((d.getDate()), x+2, H-5);
  });
}

// --- Gráfica formas de pago (donut simple)
function renderGraficaPago(){
  const cvs = document.getElementById('db_chart_pago'); const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const hoy = todayISO();
  const pagos = {Efectivo:0, Tarjeta:0, Transferencia:0, Mixto:0};
  (state.sales||[]).filter(v=> (v.fecha||'').startsWith(hoy)).forEach(v=>{
    pagos[v.pago] = (pagos[v.pago]||0) + v.total;
  });
  const vals = Object.values(pagos); const total = vals.reduce((a,b)=>a+b,0)||1;
  let ang= -Math.PI/2; const cx=cvs.width/2, cy=cvs.height/2, r=Math.min(cx,cy)-10, r2=r*0.6;
  Object.keys(pagos).forEach(k=>{
    const frac = pagos[k]/total;
    const a2 = ang + frac*2*Math.PI;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,ang,a2); ctx.closePath(); ctx.fill();
    ang = a2;
  });
  // agujero
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath(); ctx.arc(cx,cy,r2,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation='source-over';
  ctx.textAlign='center'; ctx.fillText('Hoy', cx, cy+4);
}

// --- Gráfica Surtidos (solicitado vs atendido últimos 7 días)
function renderGraficaSurtidos(){
  const cvs = document.getElementById('db_chart_surtidos'); const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
  const solicitado = days.map(k=> (state.solicitudes||[]).filter(s=> (new Date(s.id)).toISOString().slice(0,10)===k).reduce((a,s)=>a+s.qty,0));
  const atendido = days.map(k=> (state.kardex||[]).filter(m=> m.tipo==='Surtido' && (new Date(m.fecha.replace(/\//g,'-')) || new Date()).toDateString()=== new Date(k).toDateString()).reduce((a,m)=>a+m.cant,0));

  const max = Math.max(...solicitado, ...atendido, 1);
  const W=cvs.width,H=cvs.height,pad=20, step=(W-2*pad)/7, bw=step*0.35;
  days.forEach((k,i)=>{
    const x = pad + i*step;
    const h1 = (H-2*pad)*(solicitado[i]/max);
    const h2 = (H-2*pad)*(atendido[i]/max);
    // serie 1
    ctx.fillRect(x, H-pad-h1, bw, h1);
    // serie 2
    ctx.fillRect(x+bw+4, H-pad-h2, bw, h2);
  });
}

// --- Listas recientes
function renderUltimasVentas(){
  const tb = document.getElementById('db_ult_ventas'); tb.innerHTML='';
  const ult = (state.sales||[]).slice(-10).reverse();
  ult.forEach(v=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(v.fecha)}</td><td>${v.pago||''}</td><td>${money(v.total)}</td>
      <td><button class="btn btn-xs" data-reimprimir="${v.id}">Reimprimir</button></td>`;
    tr.querySelector('[data-reimprimir]').onclick = ()=> reimprimirTicket(v);
    tb.appendChild(tr);
  });
}
function reimprimirTicket(venta){
  // Llama tu función actual de ticket. Si no la tienes aislada, puedes reutilizar la de Ventas.
  alert('Reimprimir (conecta aquí tu función de ticket existente).');
}

function renderKardexReciente(){
  const tb = document.getElementById('db_kardex'); tb.innerHTML='';
  (state.kardex||[]).slice(0,10).forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.fecha}</td><td>${m.sku}</td><td>${m.tipo}</td><td>${m.detalle}</td><td>${m.cant}</td>`;
    tb.appendChild(tr);
  });
}

// ======= Inicializar cuando entres a Dashboard =======
if (document.querySelector('#tab-dashboard')) {
  renderDashboard();
}
