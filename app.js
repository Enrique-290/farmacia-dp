/* ====== Limpieza de SW + versión de build ====== */
(function(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then(list=>list.forEach(r=>r.unregister()));
  }
  window.__DP_BUILD = 'dp-1.5';
  console.log('Farmacia DP build:', window.__DP_BUILD);
})();

/* ================== Utils ================== */
const $  = (s, c=document)=>c.querySelector(s);
const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));
const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(+n||0);
const todayISO = () => new Date().toISOString().slice(0,10);
const addDays = (d, n)=>{ const t=new Date(d); t.setDate(t.getDate()+n); return t; };

/* ================== Layout/Nav ================== */
function setActiveSection(id){
  $$('.nav-link').forEach(b=> b.classList.toggle('active', b.dataset.section===id));
  $$('.view').forEach(v=> v.classList.toggle('active', v.id===id));
  $('#sectionTitle').textContent = $('#'+id)?.id
    ? $('#'+id).id.charAt(0).toUpperCase() + id.slice(1)
    : 'Farmacia';
  window.scrollTo(0,0);
}
function initLayout(){
  $$('.nav-link').forEach(btn=> btn.addEventListener('click', ()=> setActiveSection(btn.dataset.section)));
  $('#btnToggle')?.addEventListener('click', ()=> $('#sidebar').classList.toggle('collapsed'));
  $('#btnOpen')?.addEventListener('click', ()=> $('#sidebar').classList.toggle('open'));
}

/* ================== Datos (Inventario) ================== */
/** Cada producto:
 * { sku, name, etiqueta, price, cost, stockMin, img, batches:[{lote,cad,piezas}] }
 * Si etiqueta === "Servicio", no usa batches (stock = '—').
 */
const state = {
  productos: [
    {
      sku:'P-001', name:'Paracetamol 500mg', etiqueta:'Genérico', price:25, cost:10, stockMin:5, img:'',
      batches:[ {lote:'L-01', cad:'2026-01-20', piezas:10} ]
    },
    {
      sku:'A-010', name:'Amoxicilina 500mg', etiqueta:'Marca', price:60, cost:25, stockMin:3, img:'',
      batches:[ {lote:'AMX-01', cad:'2026-09-10', piezas:5} ]
    },
    { // Consulta como servicio
      sku:'CONS-001', name:'Consulta médica', etiqueta:'Servicio', price:100, cost:0, stockMin:0, img:'',
      batches:[]
    }
  ],
  bodegaSolicitudes: [] // se llenará en el módulo de Bodega
};

const getStock = p => (p.etiqueta==='Servicio') ? '—' : (p.batches||[]).reduce((s,b)=>s+Number(b.piezas||0),0);

function nextCadProxima(p){
  if(p.etiqueta==='Servicio') return '—';
  const futuras = (p.batches||[])
    .filter(b=> b.cad)
    .map(b=> ({...b, t: new Date(b.cad).getTime()}))
    .filter(b=> b.t >= Date.now())
    .sort((a,b)=> a.t-b.t);
  return futuras[0]?.cad || '—';
}

/* ================== Inventario UI ================== */
const inv = {
  editIndex: -1, // para saber si es edición
  stockSku: null
};

function renderInvTable(){
  const tbody = $('#tablaInv tbody');
  const txt = ($('#invBuscar').value||'').toLowerCase();
  const tag = $('#invEtiqueta').value||'';

  // alertas
  let low=0, cad=0;
  const rows = state.productos.filter(p=>{
    const matchesText = p.name.toLowerCase().includes(txt) || p.sku.toLowerCase().includes(txt);
    const matchesTag  = !tag || p.etiqueta===tag;
    return matchesText && matchesTag;
  });

  tbody.innerHTML = '';
  rows.forEach((p,i)=>{
    const stock = getStock(p);
    const proxCad = nextCadProxima(p);
    const isLow = (stock!=='—' && Number(stock)<=Number(p.stockMin));
    const soon = (proxCad!=='—' && new Date(proxCad) <= addDays(new Date(), 30));
    if(isLow) low++;
    if(soon) cad++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="img-thumb" src="${p.img||''}" alt="" onerror="this.style.background='#eef2ff';this.src='';" /></td>
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td><span class="tag">${p.etiqueta}</span></td>
      <td>${money(p.price)}</td>
      <td>${stock}</td>
      <td>${p.stockMin||0}</td>
      <td>${p.etiqueta==='Servicio' ? '—' : (p.batches?.length||0)}</td>
      <td>${proxCad}</td>
      <td>
        <button class="btn btn-sm" data-act="edit" data-i="${i}">Editar</button>
        ${p.etiqueta!=='Servicio' ? `<button class="btn btn-sm" data-act="stock" data-i="${i}">+Stock</button>`:''}
        <button class="btn btn-sm" data-act="del" data-i="${i}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $('#badgeStock').textContent = `Stock bajo: ${low}`;
  $('#badgeCad').textContent   = `Próximas caducidades: ${cad}`;
}

function openProdDialog(editIndex=-1){
  inv.editIndex = editIndex;
  const isEdit = editIndex>-1;
  $('#dlgProdTitle').textContent = isEdit ? 'Editar producto' : 'Nuevo producto';

  if(isEdit){
    const p = state.productos[editIndex];
    $('#fSku').value = p.sku;
    $('#fNombre').value = p.name;
    $('#fEtiqueta').value = p.etiqueta;
    $('#fPrecio').value = p.price;
    $('#fCosto').value = p.cost||0;
    $('#fMin').value   = p.stockMin||0;
    $('#fImg').value   = p.img||'';
  }else{
    $('#fSku').value = '';
    $('#fNombre').value = '';
    $('#fEtiqueta').value = 'Genérico';
    $('#fPrecio').value = '';
    $('#fCosto').value = '';
    $('#fMin').value   = 0;
    $('#fImg').value   = '';
  }
  $('#dlgProd').showModal();
}

function saveProd(){
  const p = {
    sku: $('#fSku').value.trim().toUpperCase(),
    name: $('#fNombre').value.trim(),
    etiqueta: $('#fEtiqueta').value,
    price: +$('#fPrecio').value,
    cost: +$('#fCosto').value || 0,
    stockMin: +$('#fMin').value || 0,
    img: $('#fImg').value.trim(),
    batches: (inv.editIndex>-1) ? (state.productos[inv.editIndex].batches||[]) : []
  };
  if(!p.sku || !p.name || !p.price){ alert('SKU, Nombre y Precio son obligatorios'); return; }

  if(inv.editIndex>-1){
    state.productos[inv.editIndex] = p;
  }else{
    // evitar duplicado
    if(state.productos.some(x=>x.sku===p.sku)){ alert('SKU ya existe'); return; }
    state.productos.push(p);
  }
  $('#dlgProd').close();
  renderInvTable();
  renderCatalogo();
}

function openStockDialog(i){
  inv.stockSku = state.productos[i].sku;
  $('#sLote').value = '';
  $('#sCad').value  = '';
  $('#sPiezas').value = '';
  $('#dlgStock').showModal();
}
function saveStock(){
  const lote = $('#sLote').value.trim();
  const cad  = $('#sCad').value ? $('#sCad').value : '';
  const piezas = +$('#sPiezas').value;
  if(!lote || !piezas){ alert('Lote y piezas son obligatorios'); return; }
  const p = state.productos.find(x=>x.sku===inv.stockSku);
  p.batches = p.batches||[];
  p.batches.push({lote, cad, piezas});
  $('#dlgStock').close();
  renderInvTable();
  renderCatalogo();
}

function deleteProd(i){
  const p = state.productos[i];
  if(!confirm(`Eliminar ${p.name}?`)) return;
  state.productos.splice(i,1);
  renderInvTable();
  renderCatalogo();
}

function importCSV(file){
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(Boolean);
    // Espera encabezados: sku,nombre,etiqueta,precio,costo,min,lote,caducidad,piezas,img
    const out = [];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(',').map(x=>x.trim());
      if(cols.length<10) continue;
      const [sku,nombre,etiqueta,precio,costo,min,lote,cad,piezas,img] = cols;
      let prod = out.find(p=>p.sku===sku);
      if(!prod){
        prod = { sku: sku.toUpperCase(), name:nombre, etiqueta, price:+precio, cost:+costo, stockMin:+min, img, batches:[] };
        out.push(prod);
      }
      if(etiqueta!=='Servicio'){
        prod.batches.push({ lote, cad, piezas:+piezas });
      }
    }
    // Merge con existentes (por SKU)
    out.forEach(nuevo=>{
      const i = state.productos.findIndex(p=>p.sku===nuevo.sku);
      if(i>-1) state.productos[i] = nuevo; else state.productos.push(nuevo);
    });
    renderInvTable();
    renderCatalogo();
    alert(`Importados: ${out.length}`);
  };
  reader.readAsText(file);
}

/* ================== Ventas (catálogo usa inventario) ================== */
const cart = { items: [], extras: [] };

function renderCatalogo(){
  const wrap = $('#catalogoProductos');
  const tag = $('#ventaEtiqueta').value||'';
  const txt = ($('#ventaBuscar').value||'').toLowerCase();
  wrap.innerHTML = '';

  state.productos
    .filter(p=>{
      const matchesText = p.name.toLowerCase().includes(txt) || p.sku.toLowerCase().includes(txt);
      const matchesTag  = !tag || p.etiqueta===tag;
      return matchesText && matchesTag;
    })
    .forEach(p=>{
      const card = document.createElement('div');
      card.className = 'prod-card';
      card.innerHTML = `
        <div class="prod-img" style="${p.img?`background-image:url('${p.img}');background-size:cover;background-position:center;`:''}"></div>
        <div class="prod-info">
          <div class="prod-name">${p.name}</div>
          <div class="prod-sku">SKU: ${p.sku}</div>
          <div class="prod-meta">
            <span>${money(p.price)}</span>
            <span>${p.etiqueta==='Servicio' ? 'Stock: —' : 'Stock: '+getStock(p)}</span>
          </div>
          <button class="btn add-to-cart" data-sku="${p.sku}" data-name="${p.name}" data-price="${p.price}">Agregar</button>
        </div>
      `;
      wrap.appendChild(card);
    });

  // enganchar botones
  $$('.add-to-cart', wrap).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      addItem(btn.dataset.sku, btn.dataset.name, btn.dataset.price);
    });
  });
}

function renderCart(){
  const list = $('#carritoLista');
  list.innerHTML = '';
  let total = 0;

  if(cart.items.length===0) list.innerHTML = '<li>(Vacío)</li>';
  cart.items.forEach(p=>{
    total += p.price * p.qty;
    const li = document.createElement('li');
    li.innerHTML = `${p.name} x${p.qty} — ${money(p.price*p.qty)}`;
    const del = document.createElement('button');
    del.className='btn'; del.textContent='✕';
    del.onclick = ()=>{ removeItem(p.sku); };
    li.appendChild(del);
    list.appendChild(li);
  });

  // extras
  const exList = $('#extrasLista');
  exList.innerHTML = '';
  cart.extras.forEach((e,i)=>{
    total += e.amount;
    const li = document.createElement('li');
    li.innerHTML = `${e.desc} — ${money(e.amount)}`;
    const del = document.createElement('button');
    del.className='btn'; del.textContent='✕';
    del.onclick=()=>{ cart.extras.splice(i,1); renderCart(); };
    li.appendChild(del);
    exList.appendChild(li);
  });

  $('#total').textContent = money(total);
}

function addItem(sku,name,price){
  const f = cart.items.find(p=>p.sku===sku);
  if(f) f.qty++;
  else cart.items.push({ sku, name, price:+price, qty:1 });
  renderCart();
}
function removeItem(sku){
  const i = cart.items.findIndex(p=>p.sku===sku);
  if(i>-1){ cart.items.splice(i,1); renderCart(); }
}
function clearCart(){
  cart.items.length = 0;
  cart.extras.length = 0;
  $('#extrasLista').innerHTML='';
  renderCart();
}

/* ================== Ventas: UI handlers ================== */
function initVentas(){
  // Filtros catálogo
  $('#ventaBuscar')?.addEventListener('input', renderCatalogo);
  $('#ventaEtiqueta')?.addEventListener('change', renderCatalogo);

  // Escáner
  const scan = $('#barcodeInput');
  const focusScan = ()=>{ scan.focus(); scan.select?.(); };
  $('#reactivarScanner')?.addEventListener('click', focusScan);
  scan?.addEventListener('keydown', e=>{
    if(e.key!=='Enter') return;
    const code = (scan.value||'').trim().toUpperCase(); scan.value='';
    const p = state.productos.find(x=>x.sku===code);
    if(p) addItem(p.sku,p.name,p.price);
    else alert(`SKU no encontrado: ${code}`);
  });
  focusScan();

  // Extras
  $('#btnAgregarExtra')?.addEventListener('click', ()=>{
    const d = $('#extraDesc').value.trim();
    const m = parseFloat($('#extraMonto').value);
    if(!d || isNaN(m)) return;
    cart.extras.push({ desc:d, amount:+m });
    $('#extraDesc').value=''; $('#extraMonto').value='';
    renderCart();
  });

  // Receta preview
  $('#recetaFile')?.addEventListener('change', e=>{
    const f = e.target.files?.[0];
    const prev = $('#recetaPreview');
    if(!f){ prev.style.display='none'; return; }
    if(f.type.startsWith('image/')){
      const fr = new FileReader();
      fr.onload = ()=>{ prev.src = fr.result; prev.style.display='block'; };
      fr.readAsDataURL(f);
    }else{
      prev.style.display='none';
    }
  });

  // Acciones
  $('#btnVaciar')?.addEventListener('click', clearCart);
  $('#btnCobrar')?.addEventListener('click', ()=>{
    if(cart.items.length===0 && cart.extras.length===0) return alert('Carrito vacío');
    alert(`Cobro demo — Total: ${$('#total').textContent}\n(En siguiente etapa: guardar venta, afectar stock y ticket)`);
    clearCart();
  });

  // Carrito móvil
  $('#btnCarritoMovil')?.addEventListener('click', ()=> $('#carritoPanel').classList.toggle('open'));

  renderCatalogo();
  renderCart();
}

/* ================== Inventario: handlers ================== */
function initInventario(){
  $('#btnNuevoProd')?.addEventListener('click', ()=> openProdDialog(-1));
  $('#btnGuardarProd')?.addEventListener('click', (e)=>{ e.preventDefault(); saveProd(); });
  $('#btnGuardarStock')?.addEventListener('click', (e)=>{ e.preventDefault(); saveStock(); });
  $('#invBuscar')?.addEventListener('input', renderInvTable);
  $('#invEtiqueta')?.addEventListener('change', renderInvTable);
  $('#fileImport')?.addEventListener('change', e=>{
    if(e.target.files?.[0]) importCSV(e.target.files[0]);
    e.target.value='';
  });

  // Acciones de la tabla (delegación)
  $('#tablaInv').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const act = btn.dataset.act;
    const i = +btn.dataset.i;
    if(act==='edit') openProdDialog(i);
    if(act==='stock') openStockDialog(i);
    if(act==='del') deleteProd(i);
  });

  renderInvTable();
}

/* ================== Inicio ================== */
document.addEventListener('DOMContentLoaded', ()=>{
  initLayout();
  initInventario();
  initVentas();
  setActiveSection('dashboard');
});
