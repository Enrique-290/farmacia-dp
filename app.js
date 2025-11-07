console.log("App JS OK");

// ===== Utilidades =====
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const money = n => (n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const LS = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

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
let ventas = LS.get("fdp_ventas", []);
let cart = { items:[], extras:[], receta:null, pago:{metodo:"EFE", ref:""} };

// ===== Navegación =====
function showView(view){
  $$('.view').forEach(v => v.classList.add('hidden'));
  const tgt = $(`.view[data-view="${view}"]`);
  if(tgt) tgt.classList.remove('hidden');
  LS.set("fdp_last_view", view);
  if(view==="ventas"){ renderCatalogo($('#topSearch')?.value||""); renderCarrito(); }
  if(view==="dashboard"){ updateDashboard(); }
  if(view==="inventario"){ renderInventario(); }
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
      <button class="btn" data-add="${p.sku}">Agregar</button>
    </div>
  `).join('');
  $$('[data-add]').forEach(b=> b.onclick = ()=> addToCart(b.dataset.add,1));
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
      // opcional: descontar del primer lote (no fifo completo en esta etapa)
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
      fecha: new Date().toISOString(),
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

// ===== Inventario (CRUD + imagen local + lotes) =====
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
        <button class="btn danger ghost" data-del="${p.sku}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  $$('[data-addstock]').forEach(b=> b.onclick = ()=> openStockModal(b.dataset.addstock));
  $$('[data-edit]').forEach(b=> b.onclick     = ()=> openProdModal('edit', b.dataset.edit));
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

// ---- Modal Producto
let prodEditingSku = null;
function openProdModal(mode, sku=null){
  prodEditingSku = null;
  const modal = $('#modalProd');
  const title = $('#prodModalTitle');
  const p = mode==='edit' ? productos.find(x=>x.sku===sku) : null;

  title.textContent = (mode==='edit') ? 'Editar producto' : 'Nuevo producto';
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
function openModal(id){ const m = $('#'+id); if(!m) return; m.classList.remove('hidden'); }
function closeModal(id){ const m = $('#'+id); if(!m) return; m.classList.add('hidden'); }
$$('[data-close="modalProd"]').forEach(el=> el.onclick = ()=> closeModal('modalProd'));
$$('[data-close="modalStock"]').forEach(el=> el.onclick = ()=> closeModal('modalStock'));
$('.modal__backdrop[data-close="modalProd"]')?.addEventListener('click', ()=> closeModal('modalProd'));
$('.modal__backdrop[data-close="modalStock"]')?.addEventListener('click', ()=> closeModal('modalStock'));

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
  // limpiar preview guardada
  if($('#fPreview')) delete $('#fPreview').dataset.dataurl;
});

// ---- Modal +Stock (lote)
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
  if(!lote || pzas<=0){ alert('Completa Lote y Piezas'); return; }
  p.lotes = p.lotes||[];
  p.lotes.push({lote, cad, piezas:pzas});
  p.stock = (p.stock||0) + pzas;
  p.cadProx = calcCadProx(p);
  LS.set("fdp_productos", productos);
  closeModal('modalStock'); renderInventario(); renderCatalogo($('#topSearch')?.value||''); updateDashboard();
});

// ===== Inits =====
bindNav();
bindSearch();
bindVentas();
bindInventario();
updateDashboard();
