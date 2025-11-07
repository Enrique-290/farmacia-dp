console.log("App JS OK");

// ===== Utilidades =====
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const money = n => (n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const LS = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const todayISO = ()=> new Date().toISOString();

// ===== Estado =====
let productos = LS.get("fdp_productos", null);
if(!productos){
  productos = [
    {sku:"CONS-001", nombre:"Consulta médica", etiqueta:"Servicio", precio:100, stock:null, min:0, lotes:[], cadProx:null, img:null},
    {sku:"P-001", nombre:"Paracetamol 500mg", etiqueta:"Generico", precio:25, stock:9, min:5, lotes:[{lote:"L001", cad:"2026-01-20", piezas:9}], cadProx:"2026-01-20", img:null},
    {sku:"A-010", nombre:"Amoxicilina 500mg", etiqueta:"Marca", precio:60, stock:4, min:3, lotes:[{lote:"L010", cad:"2026-09-10", piezas:4}], cadProx:"2026-09-10", img:null},
  ];
  LS.set("fdp_productos", productos);
}
let ventas   = LS.get("fdp_ventas",   []);
let bodReqs  = LS.get("fdp_bodega_reqs", []);     // {folio, fecha, sku, nombre, solicitadas, recibidas, solicitante, nota, estado}
let bodMovs  = LS.get("fdp_bodega_movs", []);     // {fecha, sku, nombre, pzas, lote, cad, solicitante, receptor, folioReq, nota}
let cart     = { items:[], extras:[], receta:null, pago:{metodo:"EFE", ref:""} };

// ===== Navegación =====
function showView(view){
  $$('.view').forEach(v => v.classList.add('hidden'));
  const tgt = $(`.view[data-view="${view}"]`);
  if(tgt) tgt.classList.remove('hidden');
  LS.set("fdp_last_view", view);
  if(view==="ventas"){ renderCatalogo($('#topSearch')?.value||""); renderCarrito(); }
  if(view==="dashboard"){ updateDashboard(); }
  if(view==="inventario"){ renderInventario(); }
  if(view==="bodega"){ renderBodega(); }
}
function bindNav(){
  $$('.nav [data-go]').forEach(a=>a.addEventListener('click', e=>{
    e.preventDefault(); showView(a.getAttribute('data-go'));
  }));
  showView(LS.get("fdp_last_view","dashboard"));
}

// ===== Dashboard =====
function updateDashboard(){
  const hoy = new Date().toISOString().slice(0,10);
  const hoyVentas = ventas.filter(v => (v.fecha||"").startsWith(hoy));
  const total = hoyVentas.reduce((s,v)=>s+v.total,0);
  const tickets = hoyVentas.length;
  const vendidos = hoyVentas.reduce((s,v)=>s+v.items.reduce((a,i)=>a+i.cant,0),0);
  const ticketProm = tickets? total/tickets : 0;

  $('#kpiVentasHoy').textContent = money(total);
  $('#kpiTicketsHoy').textContent = tickets;
  $('#kpiProdHoy').textContent = vendidos;
  $('#kpiTicketProm').textContent = money(ticketProm);

  const low  = productos.filter(p => Number.isFinite(p.stock) && p.stock <= (p.min||0));
  const near = productos.filter(p => p.cadProx && (new Date(p.cadProx) - new Date())/86400000 <= 30);
  $('#alertStockBajo').innerHTML = low.length ? low.map(p=>`• ${p.nombre} — Stock: ${p.stock}`).join('<br>') : '(Vacío)';
  $('#alertCad').innerHTML      = near.length? near.map(p=>`• ${p.nombre} — Cad.: ${p.cadProx}`).join('<br>') : '(Vacío)';
}

// ===== Buscador + Escáner =====
function bindSearch(){
  $('#topSearch')?.addEventListener('input', e=> renderCatalogo(e.target.value.trim()));
  const scanner = $('#scannerInput');
  const reAct   = $('#scannerReactivate');
  if(scanner){
    const handler = ()=>{
      const code = scanner.value.trim();
      if(!code) return;
      const p = productos.find(x => x.sku.toLowerCase() === code.toLowerCase());
      if(p){ addToCart(p.sku, 1); }
      scanner.value="";
    };
    scanner.addEventListener('keydown', e=>{ if(e.key==="Enter"){ e.preventDefault(); handler(); }});
    scanner.addEventListener('change', handler);
  }
  reAct?.addEventListener('click', ()=> scanner?.focus());
}

// ===== Ventas =====
function renderCatalogo(filtro=""){
  const cont = $('#catalogo'); if(!cont) return;
  const q = filtro.toLowerCase();
  let list = productos.slice();
  if(q){
    list = list.filter(p =>
      (p.nombre||"").toLowerCase().includes(q) ||
      (p.sku||"").toLowerCase().includes(q) ||
      (p.etiqueta||"").toLowerCase().includes(q)
    );
  }
  cont.innerHTML = list.map(p=>`
    <div class="prod-card">
      <div class="thumb">${p.img? `<img src="${p.img}" alt="">` : '🧴'}</div>
      <div class="name">${p.nombre}</div>
      <div class="sku">SKU: ${p.sku}</div>
      <div class="row">
        <div class="price">${money(p.precio)}</div>
        <div class="sku" style="margin-left:auto;">Stock: ${p.stock ?? '—'}</div>
      </div>
      <div class="row">
        <button class="btn" data-add="${p.sku}">Agregar</button>
        <button class="btn ghost" data-req="${p.sku}" title="Solicitar a bodega">Solicitar</button>
      </div>
    </div>
  `).join('');
  $$('[data-add]').forEach(b=> b.onclick = ()=> addToCart(b.dataset.add,1));
  $$('[data-req]').forEach(b=> b.onclick = ()=> openReqModal(b.dataset.req));
}
function addToCart(sku, cant){
  const p = productos.find(x=>x.sku===sku); if(!p) return;
  if(Number.isFinite(p.stock) && p.stock < cant){ alert('Sin stock suficiente'); return; }
  const item = cart.items.find(i=>i.sku===sku);
  if(item){ item.cant += cant; } else { cart.items.push({sku:p.sku, nombre:p.nombre, precio:p.precio, cant:cant}); }
  renderCarrito();
}
function renderCarrito(){
  const list = $('#cartList'); if(!list) return;
  if(cart.items.length===0 && cart.extras.length===0){
    list.classList.add('empty'); list.textContent='(Vacío)';
  } else {
    list.classList.remove('empty');
    list.innerHTML = `
      ${cart.items.map((i,idx)=>`
        <div class="row" style="justify-content:space-between;">
          <div>${i.nombre} <span class="sku">x${i.cant}</span></div>
          <div class="row">
            <button class="btn ghost" data-menos="${idx}">−</button>
            <button class="btn ghost" data-mas="${idx}">+</button>
            <button class="btn danger ghost" data-del="${idx}">✕</button>
          </div>
        </div>
      `).join('')}
      ${cart.extras.map((e,idx)=>`
        <div class="row" style="justify-content:space-between;">
          <div>${e.desc}</div>
          <div class="row">
            <strong>${money(e.monto)}</strong>
            <button class="btn danger ghost" data-delx="${idx}" title="Quitar">✕</button>
          </div>
        </div>
      `).join('')}
    `;
  }
  const t = cart.items.reduce((s,i)=> s + i.precio*i.cant, 0) + cart.extras.reduce((s,e)=>s+e.monto,0);
  $('#cartTotal').textContent = money(t);

  $$('[data-mas]').forEach(b=> b.onclick = ()=>{ cart.items[+b.dataset.mas].cant++; renderCarrito(); });
  $$('[data-menos]').forEach(b=> b.onclick = ()=>{ const it=cart.items[+b.dataset.menos]; it.cant=Math.max(1,it.cant-1); renderCarrito(); });
  $$('[data-del]').forEach(b=> b.onclick = ()=>{ cart.items.splice(+b.dataset.del,1); renderCarrito(); });
  $$('[data-delx]').forEach(b=> b.onclick = ()=>{ cart.extras.splice(+b.dataset.delx,1); renderCarrito(); });
}
function bindVentas(){
  $('#btnAddExtra')?.addEventListener('click', ()=>{
    const d = ($('#extraDesc')?.value||'').trim();
    const m = parseFloat($('#extraMonto')?.value||'0');
    if(!d || !isFinite(m) || m<=0) return;
    cart.extras.push({desc:d, monto:m}); $('#extraDesc').value=''; $('#extraMonto').value=''; renderCarrito();
  });
  $('#btnVaciar')?.addEventListener('click', ()=>{
    cart = { items:[], extras:[], receta:null, pago:{metodo: $('#paymentMethod')?.value || 'EFE', ref: $('#paymentRef')?.value || ''} };
    renderCarrito();
  });
  $('#paymentMethod')?.addEventListener('change', e=> cart.pago.metodo = e.target.value);
  $('#paymentRef')?.addEventListener('input',  e=> cart.pago.ref    = e.target.value);

  $('#btnCobrar')?.addEventListener('click', ()=>{
    const total = cart.items.reduce((s,i)=> s + i.precio*i.cant, 0) + cart.extras.reduce((s,e)=>s+e.monto,0);
    if(total<=0){ alert('Carrito vacío'); return; }

    // bajar stock (solo productos con stock)
    cart.items.forEach(i=>{
      const p = productos.find(x=>x.sku===i.sku);
      if(p && Number.isFinite(p.stock)) p.stock = Math.max(0, p.stock - i.cant);
      if(p && p.lotes && p.lotes.length){
        let qty = i.cant;
        for(const lote of p.lotes){
          if(qty<=0) break;
          const take = Math.min(lote.piezas, qty);
          lote.piezas -= take; qty -= take;
        }
        p.lotes = p.lotes.filter(l=>l.piezas>0);
        p.cadProx = calcCadProx(p);
      }
    });
    LS.set("fdp_productos", productos);

    const venta = {
      folio: "F-" + Math.random().toString(36).slice(2,8).toUpperCase(),
      fecha: todayISO(),
      items: JSON.parse(JSON.stringify(cart.items)),
      extras: JSON.parse(JSON.stringify(cart.extras)),
      pago: {...cart.pago},
      total
    };
    ventas.unshift(venta);
    LS.set("fdp_ventas", ventas);

    alert(`Cobro registrado\nMétodo: ${cart.pago.metodo}\nTotal: ${money(total)}\nFolio: ${venta.folio}`);
    cart = { items:[], extras:[], receta:null, pago:{metodo: $('#paymentMethod')?.value || 'EFE', ref: ''} };
    renderCarrito(); updateDashboard(); renderCatalogo($('#topSearch')?.value || '');
  });
}

// ===== Inventario (CRUD básico usado antes) =====
function calcCadProx(p){
  const cads = (p.lotes||[]).filter(l=>l.piezas>0 && l.cad).map(l=>l.cad);
  if(!cads.length) return null;
  cads.sort(); return cads[0];
}
function renderInventario(){
  const tbody = $('#invTable tbody'); if(!tbody) return;
  const q = ($('#invSearch')?.value||'').toLowerCase();
  const tag = $('#invFilterTag')?.value||'';

  const list = productos.filter(p=>{
    const hit = (p.nombre||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
    const t = !tag || (p.etiqueta||'').toLowerCase() === tag.toLowerCase();
    return hit && t;
  });

  tbody.innerHTML = list.map(p=>`
    <tr>
      <td>${p.img? `<img src="${p.img}" alt="">`: '—'}</td>
      <td>${p.sku}</td>
      <td>${p.nombre}</td>
      <td>${p.etiqueta||''}</td>
      <td>${money(p.precio)}</td>
      <td>${p.stock ?? '—'}</td>
      <td>${p.min ?? 0}</td>
      <td>${(p.lotes||[]).length}</td>
      <td>${p.cadProx ?? '—'}</td>
      <td class="row">
        <button class="btn ghost" data-edit="${p.sku}">Editar</button>
        <button class="btn ghost" data-addstock="${p.sku}">+Stock</button>
        <button class="btn ghost" data-req="${p.sku}">Solicitar</button>
        <button class="btn danger ghost" data-del="${p.sku}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  $$('[data-addstock]').forEach(b=> b.onclick = ()=> openStockModal(b.dataset.addstock));
  $$('[data-edit]').forEach(b=> b.onclick     = ()=> openProdModal('edit', b.dataset.edit));
  $$('[data-req]').forEach(b=> b.onclick      = ()=> openReqModal(b.dataset.req));
  $$('[data-del]').forEach(b=> b.onclick      = ()=>{
    const sku = b.dataset.del;
    const p = productos.find(x=>x.sku===sku);
    if(!p) return;
    if(!confirm(`Eliminar "${p.nombre}" (${p.sku})?`)) return;
    productos = productos.filter(x=>x.sku!==sku);
    LS.set("fdp_productos", productos);
    renderInventario(); renderCatalogo($('#topSearch')?.value||''); updateDashboard();
  });
}
function bindInventario(){
  $('#invSearch')?.addEventListener('input', renderInventario);
  $('#invFilterTag')?.addEventListener('change', renderInventario);
  $('#btnNuevoProd')?.addEventListener('click', ()=> openProdModal('new'));
}

// ---- Modal Producto (igual etapa anterior)
let prodEditingSku = null;
function openProdModal(mode, sku=null){
  prodEditingSku = null;
  const p = mode==='edit' ? productos.find(x=>x.sku===sku) : null;

  $('#prodModalTitle').textContent = (mode==='edit') ? 'Editar producto' : 'Nuevo producto';
  $('#fSku').value     = p?.sku     || '';
  $('#fNombre').value  = p?.nombre  || '';
  $('#fEtiqueta').value= p?.etiqueta|| 'Generico';
  $('#fPrecio').value  = p?.precio  ?? 0;
  $('#fStock').value   = Number.isFinite(p?.stock) ? p.stock : 0;
  $('#fMin').value     = p?.min ?? 0;
  $('#fImg').value     = '';
  $('#fPreview').innerHTML = p?.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">` : 'Sin imagen';

  prodEditingSku = (mode==='edit') ? (p?.sku||null) : null;
  openModal('modalProd');
}
function openModal(id){ $('#'+id)?.classList.remove('hidden'); }
function closeModal(id){ $('#'+id)?.classList.add('hidden'); }
$$('[data-close="modalProd"]').forEach(el=> el.onclick = ()=> closeModal('modalProd'));
$$('[data-close="modalStock"]').forEach(el=> el.onclick = ()=> closeModal('modalStock'));
$$('[data-close="modalReq"]').forEach(el=> el.onclick = ()=> closeModal('modalReq'));
$$('[data-close="modalRec"]').forEach(el=> el.onclick = ()=> closeModal('modalRec'));
$('.modal__backdrop[data-close="modalProd"]')?.addEventListener('click', ()=> closeModal('modalProd'));
$('.modal__backdrop[data-close="modalStock"]')?.addEventListener('click', ()=> closeModal('modalStock'));
$('.modal__backdrop[data-close="modalReq"]')?.addEventListener('click', ()=> closeModal('modalReq'));
$('.modal__backdrop[data-close="modalRec"]')?.addEventListener('click', ()=> closeModal('modalRec'));

// file -> dataURL
$('#fImg')?.addEventListener('change', e=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { $('#fPreview').innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`; $('#fPreview').dataset.dataurl = reader.result; };
  reader.readAsDataURL(file);
});
$('#btnProdGuardar')?.addEventListener('click', ()=>{
  const data = {
    sku:     $('#fSku').value.trim(),
    nombre:  $('#fNombre').value.trim(),
    etiqueta:$('#fEtiqueta').value,
    precio:  parseFloat($('#fPrecio').value||'0')||0,
    min:     parseInt($('#fMin').value||'0')||0,
  };
  if(!data.sku || !data.nombre){ alert('SKU y Nombre son obligatorios'); return; }

  const img = $('#fPreview').dataset?.dataurl || null;
  const stockInicial = parseInt($('#fStock').value||'0')||0;

  if(prodEditingSku){ // editar
    const p = productos.find(x=>x.sku===prodEditingSku);
    if(!p) return;
    p.sku = data.sku; p.nombre=data.nombre; p.etiqueta=data.etiqueta; p.precio=data.precio; p.min=data.min;
    if(img) p.img = img;
    if(data.etiqueta==='Servicio'){ p.stock=null; p.lotes=[]; p.cadProx=null; }
    LS.set("fdp_productos", productos);
  }else{ // nuevo
    const esServicio = data.etiqueta==='Servicio';
    const nuevo = {
      sku:data.sku, nombre:data.nombre, etiqueta:data.etiqueta,
      precio:data.precio, min:data.min,
      stock: esServicio? null : stockInicial,
      lotes: esServicio? [] : (stockInicial>0 ? [{lote:"INI", cad:null, piezas:stockInicial}] : []),
      cadProx:null, img: img
    };
    nuevo.cadProx = calcCadProx(nuevo);
    productos.push(nuevo);
    LS.set("fdp_productos", productos);
  }
  closeModal('modalProd'); renderInventario(); renderCatalogo($('#topSearch')?.value||''); updateDashboard();
  if($('#fPreview')) delete $('#fPreview').dataset.dataurl;
});

// +Stock directo
let stockSku = null;
function openStockModal(sku){
  stockSku = sku;
  $('#sLote').value = ''; $('#sCad').value=''; $('#sPzas').value=1;
  openModal('modalStock');
}
$('#btnAddLote')?.addEventListener('click', ()=>{
  const p = productos.find(x=>x.sku===stockSku); if(!p) return;
  if(p.etiqueta==='Servicio'){ alert('Este artículo es Servicio (sin stock).'); return; }
  const lote = $('#sLote').value.trim();
  const cad  = $('#sCad').value || null;
  const pzas = parseInt($('#sPzas').value||'0')||0;
  if(!lote || !cad || pzas<=0){ alert('Lote y Caducidad obligatorios, piezas > 0'); return; }
  p.lotes = p.lotes||[]; p.lotes.push({lote, cad, piezas:pzas});
  p.stock = (p.stock||0) + pzas;
  p.cadProx = calcCadProx(p);
  LS.set("fdp_productos", productos);
  closeModal('modalStock'); renderInventario(); renderCatalogo($('#topSearch')?.value||''); updateDashboard();
});

// ===== Bodega =====

// — Solicitar desde inventario o catálogo
let reqSku = null;
function openReqModal(sku){
  const p = productos.find(x=>x.sku===sku); if(!p) return;
  reqSku = sku;
  $('#rqSku').value = p.sku; $('#rqNombre').value = p.nombre;
  $('#rqPzas').value = 1; $('#rqUser').value = ''; $('#rqNota').value = '';
  openModal('modalReq');
}
$('#btnReqGuardar')?.addEventListener('click', ()=>{
  const p = productos.find(x=>x.sku===reqSku); if(!p) return;
  const piezas = parseInt($('#rqPzas').value||'0')||0;
  const solicitante = ($('#rqUser').value||'').trim() || 'Recepción';
  const nota = ($('#rqNota').value||'').trim() || null;
  if(piezas<=0){ alert('Piezas debe ser > 0'); return; }
  const folio = 'RQ-' + Math.random().toString(36).slice(2,7).toUpperCase();
  const req = {folio, fecha:todayISO(), sku:p.sku, nombre:p.nombre, solicitadas:piezas, recibidas:0, solicitante, nota, estado:'Solicitado'};
  bodReqs.unshift(req); LS.set('fdp_bodega_reqs', bodReqs);
  closeModal('modalReq'); renderBodega();
  alert(`Solicitud creada: ${folio}`);
});

// — Bodega: tabs
function bindBodegaTabs(){
  $$('.tabs .tab').forEach(t=>{
    t.onclick = ()=>{
      $$('.tabs .tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      const show = t.dataset.tab;
      $$('.tabpanel').forEach(p=>p.classList.add('hidden'));
      $(`.tabpanel[data-panel="${show}"]`)?.classList.remove('hidden');
    };
  });
}

// — Render solicitudes e historial
function renderBodega(){
  renderBodSolicitudes();
  renderBodMovs();
}
function renderBodSolicitudes(){
  const q = ($('#bodSearch')?.value||'').toLowerCase();
  const est = $('#bodEstado')?.value||'';
  const tbody = $('#bodTable tbody'); if(!tbody) return;

  const list = bodReqs.filter(r=>{
    const hit = (r.sku||'').toLowerCase().includes(q) || (r.nombre||'').toLowerCase().includes(q) || (r.folio||'').toLowerCase().includes(q);
    const eok = !est || r.estado===est;
    return hit && eok;
  });

  tbody.innerHTML = list.map(r=>{
    const pend = r.solicitadas - r.recibidas;
    const canRecibir = pend>0 && r.estado!=='Cancelado';
    return `
      <tr>
        <td>${r.folio}</td>
        <td>${new Date(r.fecha).toLocaleString('es-MX')}</td>
        <td>${r.sku}</td>
        <td>${r.nombre}</td>
        <td>${r.solicitadas}</td>
        <td>${r.recibidas}</td>
        <td>${pend}</td>
        <td>${r.solicitante||''}</td>
        <td>${r.estado}</td>
        <td class="row">
          ${canRecibir? `<button class="btn" data-rec="${r.folio}">Recibir</button>`:''}
          ${r.estado==='Solicitado' || r.estado==='Parcial' ? `<button class="btn danger ghost" data-cancel="${r.folio}">Cancelar</button>`:''}
        </td>
      </tr>
    `;
  }).join('');

  $$('[data-rec]').forEach(b=> b.onclick = ()=> openRecModal(b.dataset.rec));
  $$('[data-cancel]').forEach(b=> b.onclick = ()=>{
    const folio = b.dataset.cancel;
    const r = bodReqs.find(x=>x.folio===folio); if(!r) return;
    if(!confirm(`Cancelar solicitud ${folio}?`)) return;
    r.estado = 'Cancelado';
    LS.set('fdp_bodega_reqs', bodReqs);
    renderBodSolicitudes();
  });
}
function renderBodMovs(){
  const q = ($('#movSearch')?.value||'').toLowerCase();
  const tbody = $('#movTable tbody'); if(!tbody) return;

  const list = bodMovs.filter(m=>{
    return (m.sku||'').toLowerCase().includes(q) ||
           (m.nombre||'').toLowerCase().includes(q) ||
           (m.lote||'').toLowerCase().includes(q) ||
           (m.folioReq||'').toLowerCase().includes(q);
  });

  tbody.innerHTML = list.map(m=>`
    <tr>
      <td>${new Date(m.fecha).toLocaleString('es-MX')}</td>
      <td>${m.sku}</td>
      <td>${m.nombre}</td>
      <td>${m.pzas}</td>
      <td>${m.lote||''}</td>
      <td>${m.cad||''}</td>
      <td>${m.solicitante||''}</td>
      <td>${m.receptor||''}</td>
      <td>${m.folioReq||''}</td>
    </tr>
  `).join('');
}

// — Recepción
let recFolio = null;
function openRecModal(folio){
  const r = bodReqs.find(x=>x.folio===folio); if(!r) return;
  recFolio = folio;
  const pend = r.solicitadas - r.recibidas;
  $('#rcFolio').value  = r.folio;
  $('#rcSku').value    = r.sku;
  $('#rcNombre').value = r.nombre;
  $('#rcPend').value   = pend;
  $('#rcLote').value   = '';
  $('#rcCad').value    = '';
  $('#rcPzas').value   = pend;
  $('#rcUser').value   = '';
  $('#rcNota').value   = '';
  openModal('modalRec');
}
$('#btnRecibir')?.addEventListener('click', ()=>{
  const r = bodReqs.find(x=>x.folio===recFolio); if(!r) return;
  const lote = $('#rcLote').value.trim();
  const cad  = $('#rcCad').value;
  const pzas = parseInt($('#rcPzas').value||'0')||0;
  const receptor = ($('#rcUser').value||'').trim() || 'Bodega';
  const nota = ($('#rcNota').value||'').trim() || null;
  const pend = r.solicitadas - r.recibidas;

  if(!lote || !cad || pzas<=0){ alert('Lote y Caducidad obligatorios, piezas > 0'); return; }
  if(pzas > pend){ alert(`No puedes recibir más de lo pendiente (${pend}).`); return; }

  const prod = productos.find(x=>x.sku===r.sku);
  if(!prod){ alert('Producto no encontrado'); return; }
  if(prod.etiqueta==='Servicio'){ alert('El artículo es Servicio (sin stock).'); return; }

  // Actualiza inventario
  prod.lotes = prod.lotes||[];
  prod.lotes.push({lote, cad, piezas:pzas});
  prod.stock = (prod.stock||0) + pzas;
  prod.cadProx = calcCadProx(prod);
  LS.set('fdp_productos', productos);

  // Actualiza solicitud
  r.recibidas += pzas;
  r.estado = (r.recibidas >= r.solicitadas) ? 'Recibido' : 'Parcial';
  LS.set('fdp_bodega_reqs', bodReqs);

  // Movimiento
  const mov = {fecha: todayISO(), sku:r.sku, nombre:r.nombre, pzas, lote, cad, solicitante:r.solicitante, receptor, folioReq:r.folio, nota};
  bodMovs.unshift(mov); LS.set('fdp_bodega_movs', bodMovs);

  closeModal('modalRec');
  renderBodega(); renderInventario(); updateDashboard();
  alert(`Recibidas ${pzas} pzas de ${r.nombre} — estado: ${r.estado}`);
});

// ===== TABS y Filtros bodega =====
$('#bodSearch')?.addEventListener('input', renderBodSolicitudes);
$('#bodEstado')?.addEventListener('change', renderBodSolicitudes);
$('#movSearch')?.addEventListener('input', renderBodMovs);

// ===== Helpers modales =====
function bindModalBackdrops(){
  ['modalProd','modalStock','modalReq','modalRec'].forEach(id=>{
    $(`#${id} .modal__backdrop`)?.addEventListener('click', ()=> closeModal(id));
  });
}

// ===== Init =====
bindNav();
bindSearch();
bindVentas();
bindInventario();
bindBodegaTabs();
bindModalBackdrops();
updateDashboard();
renderBodega();
