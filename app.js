// ---------- Estado & utilidades ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => (n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const db = {
  load(){ try { return JSON.parse(localStorage.getItem('farmacia-state')) } catch { return null } },
  save(s){ localStorage.setItem('farmacia-state', JSON.stringify(s)) }
};

let state = db.load() || {
  config:{ iva:0 },
  items:[
    {sku:'CONS-MED', nombre:'Consulta médica', tipo:'servicio', precio:100},
    {sku:'PARA-500', nombre:'Paracetamol 500mg', tipo:'producto', precio:25, stock_bodega:30, stock_inventario:10, lotes:[
      {lote:'L1', cad:'2026-06-30', stock:20},{lote:'L2', cad:'2027-01-31', stock:10}
    ]},
    {sku:'AMOX-500', nombre:'Amoxicilina 500mg', tipo:'producto', precio:60, stock_bodega:18, stock_inventario:8, lotes:[
      {lote:'A1', cad:'2026-02-28', stock:18}
    ]}
  ],
  cart:[],
  sales:[],
  solicitudes:[],  // {id, sku, qty, estado:'Pendiente'|'Atendida'|'Parcial'}
  kardex:[]        // {fecha, sku, tipo, detalle, cant}
};

function persist(){ db.save(state); refreshKPIs(); }

// ---------- Navegación ----------
$$('.sidebar nav button').forEach(b=>{
  b.onclick = ()=>{
    $$('.sidebar nav button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    ['ventas','inventario','bodega','reportes','config'].forEach(id=>{
      document.querySelector('#tab-'+id).style.display = (b.dataset.tab===id)?'block':'none';
    });
    if(b.dataset.tab==='ventas'){ renderCatalog(); renderCart(); }
    if(b.dataset.tab==='inventario'){ renderInventario(); }
    if(b.dataset.tab==='bodega'){ renderSolicitudes(); renderKardex(); }
    if(b.dataset.tab==='reportes'){ renderResumen(); }
    if(b.dataset.tab==='config'){ $('#iva').value = state.config.iva||0; }
  };
});

// ---------- KPIs ----------
function refreshKPIs(){
  const hoy = new Date().toISOString().slice(0,10);
  const ventasHoy = state.sales.filter(v=>v.fecha.startsWith(hoy));
  $('#kpiHoy').textContent = money(ventasHoy.reduce((a,v)=>a+v.total,0));
  $('#kpiTickets').textContent = ventasHoy.length;
  $('#kpiIVA').textContent = (state.config.iva||0)+'%';
  const cont = {};
  state.sales.forEach(v=> v.items.forEach(i=> cont[i.sku]=(cont[i.sku]||0)+i.cant ));
  const topSku = Object.entries(cont).sort((a,b)=>b[1]-a[1])[0]?.[0];
  $('#kpiTop').textContent = topSku ? (state.items.find(it=>it.sku===topSku)?.nombre||topSku) : '—';
}
refreshKPIs();

// ======================================================
// VENTAS
// ======================================================
function renderCatalog(){
  const q = ($('#buscador').value||'').toLowerCase();
  const filtro = $('#filtroTipo').value;
  const grid = $('#gridProductos'); grid.innerHTML='';
  state.items
    .filter(i => !q || i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
    .filter(i => filtro==='todos' || i.tipo===filtro)
    .forEach(i=>{
      const div = document.createElement('div');
      div.className='item';
      const stockTxt = i.tipo==='producto' ? ` · Stock piso: ${i.stock_inventario||0}` : '';
      div.innerHTML = `
        <h4>${i.nombre}</h4>
        <div class="tag">${i.sku} · ${i.tipo==='producto'?'Producto':'Servicio'}${stockTxt}</div>
        <div class="foot">
          <strong>${money(i.precio)}</strong>
          <div class="row">
            <button class="btn add" ${i.tipo==='producto' && (i.stock_inventario||0)<=0?'disabled':''}>Agregar</button>
            ${i.tipo==='producto'?`<button class="btn ghost solicitar">Solicitar</button>`:''}
          </div>
        </div>`;
      div.querySelector('.add').onclick = ()=> addToCart(i.sku);
      if(i.tipo==='producto') div.querySelector('.solicitar').onclick = ()=> solicitar(i.sku, 5);
      grid.appendChild(div);
    });
}
$('#buscador').oninput = renderCatalog; $('#filtroTipo').onchange = renderCatalog;

function addToCart(sku){
  const it = state.items.find(x=>x.sku===sku);
  if(!it) return;
  if(it.tipo==='producto' && (it.stock_inventario||0)<=0) return alert('Sin stock en piso.');
  const ex = state.cart.find(l=>l.sku===sku);
  if(ex){
    if(it.tipo==='producto' && ex.cant+1 > (it.stock_inventario||0)) return alert('No hay más stock en piso.');
    ex.cant++;
  }else{
    state.cart.push({sku:it.sku,nombre:it.nombre,precio:it.precio,tipo:it.tipo,cant:1});
  }
  renderCart();
}

$('#btnAddExtra').onclick = ()=>{
  const desc = ($('#extraDesc').value||'').trim();
  const monto = parseFloat($('#extraMonto').value||'');
  if(!desc || isNaN(monto) || monto<=0) return alert('Completa extra y monto.');
  state.cart.push({sku:'EXTRA',nombre:`Extra: ${desc}`,precio:monto,tipo:'servicio',cant:1});
  $('#extraDesc').value=''; $('#extraMonto').value='';
  renderCart();
};

$('#btnVaciar').onclick = ()=>{ state.cart=[]; renderCart(); };

function renderCart(){
  const cont = $('#lineas'); cont.innerHTML='';
  let sub=0;
  state.cart.forEach(l=>{
    sub += l.precio*l.cant;
    const row = document.createElement('div'); row.className='linea';
    row.innerHTML = `
      <div>
        <div><strong>${l.nombre}</strong></div>
        <div class="tipo">${l.tipo==='producto'?'Producto':'Servicio'}</div>
      </div>
      <input type="number" min="1" value="${l.cant}" class="input">
      <div>${money(l.precio)}</div>
      <button class="btn">✕</button>`;
    row.querySelector('input').onchange = e=>{ l.cant = Math.max(1, parseInt(e.target.value||1)); renderCart(); };
    row.querySelector('button').onclick = ()=>{ state.cart = state.cart.filter(x=>x!==l); renderCart(); };
    cont.appendChild(row);
  });
  const iva = sub*(state.config.iva||0)/100;
  const total = sub+iva;
  $('#resumen').innerHTML = `
    <div class="row"><span>Subtotal</span><strong class="right">${money(sub)}</strong></div>
    <div class="row"><span>IVA ${(state.config.iva||0)}%</span><strong class="right">${money(iva)}</strong></div>
    <div class="row"><span>Total</span><strong class="right">${money(total)}</strong></div>`;
}

$('#btnCobrar').onclick = ()=>{
  if(state.cart.length===0) return alert('Carrito vacío.');
  // validar stock de piso
  for(const l of state.cart){
    if(l.tipo==='producto'){
      const it = state.items.find(x=>x.sku===l.sku);
      if(!it || (it.stock_inventario||0) < l.cant) return alert(`Stock insuficiente en piso: ${l.nombre}`);
    }
  }
  // descontar stock de piso
  state.cart.forEach(l=>{
    if(l.tipo==='producto'){
      const it = state.items.find(x=>x.sku===l.sku);
      it.stock_inventario -= l.cant;
    }
  });
  const subtotal = state.cart.reduce((a,l)=>a+l.precio*l.cant,0);
  const iva = subtotal*(state.config.iva||0)/100;
  const total = subtotal+iva;
  const venta = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    items: JSON.parse(JSON.stringify(state.cart)),
    pago: $('#tipoPago').value,
    ref: ($('#referenciaPago').value||'').trim(),
    subtotal, iva, total
  };
  state.sales.push(venta);
  // limpiar carrito y reiniciar pago en Efectivo (como pediste)
  state.cart=[]; $('#tipoPago').value='Efectivo'; $('#referenciaPago').value='';
  renderCatalog(); renderCart(); persist();
  alert('Venta registrada.');
};

// Solicitar a bodega (desde inventario o tarjetas)
function solicitar(sku, qty){
  const it = state.items.find(x=>x.sku===sku);
  if(!it || it.tipo!=='producto') return;
  const id = Date.now();
  state.solicitudes.push({id, sku, qty, estado:'Pendiente'});
  persist(); renderSolicitudes();
  alert(`Solicitud creada (${it.nombre}) por ${qty}.`);
}

// ======================================================
// INVENTARIO (piso) — ver stocks de piso y bodega
// ======================================================
function renderInventario(){
  const tb = $('#tablaInventario tbody'); tb.innerHTML='';
  state.items.forEach(i=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i.sku}</td>
      <td>${i.nombre}</td>
      <td>${i.tipo}</td>
      <td>${i.tipo==='producto'?(i.stock_inventario||0):'—'}</td>
      <td>${i.tipo==='producto'?(i.stock_bodega||0):'—'}</td>
      <td>${money(i.precio)}</td>
      <td>${i.tipo==='producto'?`<button class="btn solicitar">Solicitar</button>`:''}</td>`;
    if(i.tipo==='producto') tr.querySelector('.solicitar').onclick = ()=> solicitar(i.sku, 10);
    tb.appendChild(tr);
  });
}

// (Modal para crear/editar ítems simples)
$('#btnNuevoItem').onclick = ()=>{
  const m = $('#modal'); $('#modalTitle').textContent='Nuevo ítem';
  $('#modalBody').innerHTML = `
    <div class="gridForm">
      <select id="mTipo" class="select"><option value="producto">Producto</option><option value="servicio">Servicio</option></select>
      <input id="mSku" class="input" placeholder="SKU">
      <input id="mNombre" class="input" placeholder="Nombre">
      <input id="mPrecio" class="input" type="number" step="0.01" placeholder="Precio">
      <input id="mStockPiso" class="input" type="number" placeholder="Stock piso (solo producto)">
    </div>`;
  m.showModal();
  m.addEventListener('close', ()=>{
    if(m.returnValue!=='ok') return;
    const tipo = $('#mTipo').value;
    const it = { sku:$('#mSku').value.trim(), nombre:$('#mNombre').value.trim(), tipo, precio:parseFloat($('#mPrecio').value||0) };
    if(!it.sku || !it.nombre || isNaN(it.precio)) return;
    if(tipo==='producto'){ it.stock_inventario=parseInt($('#mStockPiso').value||0); it.stock_bodega=0; it.lotes=[]; }
    state.items.push(it); persist(); renderInventario(); renderCatalog();
  }, {once:true});
};

// ======================================================
// BODEGA — ingresos, surtir FIFO por caducidad, solicitudes
// ======================================================
function addKardex(sku,tipo,detalle,cant){
  state.kardex.unshift({fecha:new Date().toLocaleString('es-MX'), sku, tipo, detalle, cant});
  renderKardex();
}

$('#btnIngresar').onclick = ()=>{
  const sku = $('#inSku').value.trim();
  const nombre = $('#inNombre').value.trim();
  const lote = $('#inLote').value.trim();
  const cad = $('#inCad').value;
  const cant = parseInt($('#inCant').value||0);
  if(!sku || !lote || !cad || !cant) return alert('Completa SKU, lote, caducidad y cantidad.');

  let it = state.items.find(x=>x.sku===sku);
  if(!it){
    if(!nombre) return alert('SKU nuevo: proporciona nombre.');
    it = {sku, nombre, tipo:'producto', precio:0, stock_bodega:0, stock_inventario:0, lotes:[]};
    state.items.push(it);
  }
  if(it.tipo!=='producto') return alert('Solo productos en bodega.');
  it.lotes = it.lotes||[];
  it.lotes.push({lote, cad, stock:cant});
  it.stock_bodega = (it.stock_bodega||0) + cant;
  persist(); renderInventario(); addKardex(sku,'Ingreso',`Lote ${lote} cad ${cad}`, cant);
  $('#inSku').value=$('#inNombre').value=$('#inLote').value=$('#inCad').value=$('#inCant').value='';
  alert('Ingreso registrado en bodega.');
};

$('#btnSurtir').onclick = ()=> surtir($('#suSku').value.trim(), parseInt($('#suCant').value||0));
$('#btnAtenderTodo').onclick = ()=>{
  state.solicitudes.filter(s=>s.estado==='Pendiente').forEach(s=> surtir(s.sku, s.qty, s.id));
};

function surtir(sku, qty, solicitudId=null){
  if(!sku || !qty || qty<=0) return alert('Completa SKU y cantidad.');
  const it = state.items.find(x=>x.sku===sku && x.tipo==='producto');
  if(!it) return alert('SKU no encontrado.');
  // FIFO por cad
  it.lotes = (it.lotes||[]).sort((a,b)=> a.cad.localeCompare(b.cad));
  let restante = qty;
  for(const L of it.lotes){
    if(restante<=0) break;
    const take = Math.min(L.stock, restante);
    L.stock -= take; restante -= take;
  }
  // limpiar lotes vacíos y validar disponible
  it.lotes = it.lotes.filter(L=>L.stock>0);
  const movido = qty - restante;
  if(movido<=0) return alert('No hay stock en bodega.');
  it.stock_bodega = (it.stock_bodega||0) - movido;
  it.stock_inventario = (it.stock_inventario||0) + movido;

  // actualizar solicitud si viene de una
  if(solicitudId){
    const s = state.solicitudes.find(x=>x.id===solicitudId);
    if(s){ s.estado = (movido>=s.qty)?'Atendida':'Parcial'; s.qty -= movido; if(s.qty<0) s.qty=0; }
  }
  persist(); renderInventario(); renderSolicitudes(); addKardex(sku,'Surtido',`Bodega → Piso`, movido);
  alert(`Surtido ${movido} a Inventario. ${restante>0?'(Faltó '+restante+')':''}`);
}

function renderSolicitudes(){
  const tb = $('#tablaSolicitudes tbody'); tb.innerHTML='';
  state.solicitudes.forEach(s=>{
    const it = state.items.find(i=>i.sku===s.sku);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${s.sku}</td>
      <td>${it?.nombre||''}</td>
      <td>${s.qty}</td>
      <td>${s.estado}</td>
      <td>${s.estado==='Pendiente'?'<button class="btn atender">Atender</button>':''}</td>`;
    if(s.estado==='Pendiente'){
      tr.querySelector('.atender').onclick = ()=> surtir(s.sku, s.qty, s.id);
    }
    tb.appendChild(tr);
  });
}

function renderKardex(){
  const tb = $('#tablaKardex tbody'); tb.innerHTML='';
  state.kardex.forEach(k=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k.fecha}</td><td>${k.sku}</td><td>${k.tipo}</td><td>${k.detalle}</td><td>${k.cant}</td>`;
    tb.appendChild(tr);
  });
}

// ======================================================
// REPORTES Y CONFIG
// ======================================================
function renderResumen(){
  const total = state.sales.reduce((a,v)=>a+v.total,0);
  const tickets = state.sales.length;
  const topMap = {};
  state.sales.forEach(v=> v.items.forEach(i=> topMap[i.sku]=(topMap[i.sku]||0)+i.cant ));
  const topSku = Object.entries(topMap).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topName = topSku ? (state.items.find(i=>i.sku===topSku)?.nombre || topSku) : '—';
  $('#resumenReporte').innerHTML = `
    <span class="chip">Total: <strong>${money(total)}</strong></span>
    <span class="chip">Tickets: <strong>${tickets}</strong></span>
    <span class="chip">Top: <strong>${topName}</strong></span>`;
}

$('#btnIVA').onclick = ()=>{ state.config.iva = parseFloat($('#iva').value||0); persist(); };
$('#btnGuardar').onclick = ()=>{ persist(); alert('Guardado.'); };
$('#btnRestaurar').onclick = ()=>{ state = db.load() || state; refreshKPIs(); renderCatalog(); renderInventario(); renderSolicitudes(); renderKardex(); };
$('#btnWipe').onclick = ()=>{ if(confirm('Borrar todos los datos locales?')){ localStorage.removeItem('farmacia-state'); location.reload(); } };

// Inicial
renderCatalog(); renderCart(); renderInventario(); renderSolicitudes(); renderKardex();
