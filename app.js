console.log("App JS OK");

// ---------- Utilidades ----------
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const money = n => (n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});

// ---------- Estado (localStorage) ----------
const LS = {
  get(k, def){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch{ return def; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// Productos demo si no hay
let productos = LS.get("fdp_productos", null);
if(!productos){
  productos = [
    {sku:"CONS-001", nombre:"Consulta médica", etiqueta:"Servicio", precio:100, stock:null, min:0, lotes:0, cadProx:null, img:null},
    {sku:"P-001", nombre:"Paracetamol 500mg", etiqueta:"Generico", precio:25, stock:9, min:5, lotes:1, cadProx:"2026-01-20", img:null},
    {sku:"A-010", nombre:"Amoxicilina 500mg", etiqueta:"Marca", precio:60, stock:4, min:3, lotes:1, cadProx:"2026-09-10", img:null},
  ];
  LS.set("fdp_productos", productos);
}

let ventas = LS.get("fdp_ventas", []);
let cart = { items:[], extras:[], receta:null, pago:{metodo:"EFE", ref:""} };

// ---------- Navegación ----------
function showView(view){
  $$('.view').forEach(v => v.classList.add('hidden'));
  const tgt = $(`.view[data-view="${view}"]`);
  if(tgt) tgt.classList.remove('hidden');
  // guardar última vista
  LS.set("fdp_last_view", view);
  // refrescar secciones clave
  if(view==="ventas"){ renderCatalogo(); renderCarrito(); }
  if(view==="dashboard"){ updateDashboard(); }
  if(view==="inventario"){ renderInventario(); }
}

function bindNav(){
  $$('.nav [data-go]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const v = a.getAttribute('data-go');
      showView(v);
    });
  });
  // arrancar en última vista o dashboard
  showView(LS.get("fdp_last_view","dashboard"));
}

// ---------- Dashboard ----------
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

  // Alertas básicas
  const low = productos.filter(p => Number.isFinite(p.stock) && p.stock<= (p.min||0));
  const near = productos.filter(p => p.cadProx && (new Date(p.cadProx) - new Date())/86400000 <= 30);
  const aS = $('#alertStockBajo'); const aC = $('#alertCad');
  aS.innerHTML = low.length ? low.map(p=>`• ${p.nombre} — Stock: ${p.stock}`).join('<br>') : '(Vacío)';
  aC.innerHTML = near.length? near.map(p=>`• ${p.nombre} — Cad.: ${p.cadProx}`).join('<br>') : '(Vacío)';
}

// ---------- Buscador + Escáner (super rápido) ----------
function bindSearch(){
  const topSearch = $('#topSearch');
  if(topSearch){
    topSearch.addEventListener('input', ()=> renderCatalogo(topSearch.value.trim()));
  }
  const scanner = $('#scannerInput');
  const reAct = $('#scannerReactivate');
  if(scanner){
    const handler = ()=>{
      const code = scanner.value.trim();
      if(!code) return;
      // buscar por SKU exacto
      const p = productos.find(x => x.sku.toLowerCase() === code.toLowerCase());
      if(p){ addToCart(p.sku, 1); }
      scanner.value = "";
    };
    // muchos lectores envían Enter
    scanner.addEventListener('keydown', e=>{
      if(e.key==="Enter"){ e.preventDefault(); handler(); }
    });
    scanner.addEventListener('change', handler);
  }
  if(reAct){
    reAct.addEventListener('click', ()=>{
      $('#scannerInput')?.focus();
    });
  }
}

// ---------- Ventas (catálogo + carrito) ----------
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

  // botones agregar
  $$('[data-add]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const sku = b.getAttribute('data-add');
      addToCart(sku,1);
    });
  });
}

function addToCart(sku, cant){
  const p = productos.find(x=>x.sku===sku); if(!p) return;
  // servicios (stock null) siempre disponibles
  if(Number.isFinite(p.stock) && p.stock < cant){
    alert('Sin stock suficiente');
    return;
  }
  const item = cart.items.find(i=>i.sku===sku);
  if(item){ item.cant += cant; }
  else { cart.items.push({sku:p.sku, nombre:p.nombre, precio:p.precio, cant: cant}); }
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
  // totales
  const t = cart.items.reduce((s,i)=> s + i.precio*i.cant, 0) + cart.extras.reduce((s,e)=>s+e.monto,0);
  $('#cartTotal').textContent = money(t);

  // binds
  $$('[data-mas]').forEach(b=> b.onclick = ()=>{ cart.items[+b.dataset.mas].cant++; renderCarrito(); });
  $$('[data-menos]').forEach(b=> b.onclick = ()=>{ const it=cart.items[+b.dataset.menos]; it.cant=Math.max(1, it.cant-1); renderCarrito(); });
  $$('[data-del]').forEach(b=> b.onclick = ()=>{ cart.items.splice(+b.dataset.del,1); renderCarrito(); });
  $$('[data-delx]').forEach(b=> b.onclick = ()=>{ cart.extras.splice(+b.dataset.delx,1); renderCarrito(); });
}

function bindVentas(){
  $('#btnAddExtra')?.addEventListener('click', ()=>{
    const d = ($('#extraDesc')?.value||'').trim();
    const m = parseFloat($('#extraMonto')?.value||'0');
    if(!d || !isFinite(m) || m<=0) return;
    cart.extras.push({desc:d, monto:m});
    $('#extraDesc').value=''; $('#extraMonto').value='';
    renderCarrito();
  });

  $('#btnVaciar')?.addEventListener('click', ()=>{
    cart = { items:[], extras:[], receta:null, pago:{metodo: $('#paymentMethod')?.value || 'EFE', ref: $('#paymentRef')?.value || ''} };
    renderCarrito();
  });

  $('#paymentMethod')?.addEventListener('change', e=>{
    cart.pago.metodo = e.target.value;
  });
  $('#paymentRef')?.addEventListener('input', e=>{
    cart.pago.ref = e.target.value;
  });

  $('#btnCobrar')?.addEventListener('click', ()=>{
    const total = cart.items.reduce((s,i)=> s + i.precio*i.cant, 0) + cart.extras.reduce((s,e)=>s+e.monto,0);
    if(total<=0){ alert('Carrito vacío'); return; }

    // baja stock para productos con stock finito
    cart.items.forEach(i=>{
      const p = productos.find(x=>x.sku===i.sku);
      if(p && Number.isFinite(p.stock)) p.stock = Math.max(0, p.stock - i.cant);
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
    // reset carrito
    cart = { items:[], extras:[], receta:null, pago:{metodo: $('#paymentMethod')?.value || 'EFE', ref: ''} };
    renderCarrito();
    updateDashboard();
    renderCatalogo($('#topSearch')?.value || '');
  });
}

// ---------- Inventario (listado simple) ----------
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
      <td>${p.lotes ?? 0}</td>
      <td>${p.cadProx ?? '—'}</td>
      <td><button class="btn ghost" data-addstock="${p.sku}">+Stock</button></td>
    </tr>
  `).join('');

  // sumar stock rápido (sin modal, para probar navegación)
  $$('[data-addstock]').forEach(b=>{
    b.onclick = ()=>{
      const sku = b.dataset.addstock;
      const p = productos.find(x=>x.sku===sku);
      if(!p) return;
      const n = Number(prompt(`Piezas a sumar para ${p.nombre}:`, "1"));
      if(!Number.isFinite(n) || n<=0) return;
      if(!Number.isFinite(p.stock)){
        alert('Este artículo es de tipo Servicio (sin stock).'); return;
      }
      p.stock += n;
      LS.set("fdp_productos", productos);
      renderInventario();
      updateDashboard();
    };
  });
}

function bindInventario(){
  $('#invSearch')?.addEventListener('input', renderInventario);
  $('#invFilterTag')?.addEventListener('change', renderInventario);
  $('#btnNuevoProd')?.addEventListener('click', ()=>{
    const sku = prompt("SKU:"); if(!sku) return;
    const nombre = prompt("Nombre:") || "Nuevo producto";
    const etiqueta = prompt("Etiqueta (Generico/Marca/Controlado/Servicio):") || "Generico";
    const precio = Number(prompt("Precio:", "0")) || 0;
    const esServicio = (etiqueta.toLowerCase()==="servicio");
    const stock = esServicio? null : (Number(prompt("Stock inicial:", "0"))||0);
    productos.push({sku, nombre, etiqueta, precio, stock, min:0, lotes: esServicio? 0:1, cadProx:null, img:null});
    LS.set("fdp_productos", productos);
    renderInventario();
    renderCatalogo($('#topSearch')?.value || '');
  });
}

// ---------- Init ----------
bindNav();
bindSearch();
bindVentas();
bindInventario();
updateDashboard();
