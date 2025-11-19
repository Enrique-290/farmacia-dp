// ---------------------------
// Estado y almacenamiento
// ---------------------------
const LS_KEY = 'farmacia_dp_demo_state_v2';
let state = {
  config: {
    negocio: 'Farmacia DP',
    ivaDefault: 0,
    mensajeTicket: '¡Gracias por su compra!'
  },
  categorias: ['Original','Genérico','Controlado','Perfumería'],
  inventario: [],
  clientes: [],
  ventas: [], // historial de tickets
};

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
    }
  }catch(e){console.error('loadState',e);}
  if(!Array.isArray(state.categorias) || !state.categorias.length){
    state.categorias = ['Original','Genérico','Controlado','Perfumería'];
  }
}
function saveState(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }catch(e){console.error('saveState',e);}
}
function money(v){return '$'+(Number(v)||0).toFixed(2);}

loadState();

// ---------------------------
// Navegación SPA
// ---------------------------
const navItems = document.querySelectorAll('.nav-item');
const pages = {
  dashboard: document.getElementById('page-dashboard'),
  ventas: document.getElementById('page-ventas'),
  inventario: document.getElementById('page-inventario'),
  bodega: document.getElementById('page-bodega'),
  clientes: document.getElementById('page-clientes'),
  historial: document.getElementById('page-historial'),
  reportes: document.getElementById('page-reportes'),
  config: document.getElementById('page-config'),
};
const pageTitle = document.getElementById('pageTitle');
const sidebar = document.getElementById('sidebar');
const btnBurger = document.getElementById('btnBurger');

navItems.forEach(item=>{
  item.addEventListener('click',()=>{
    const page = item.dataset.page;
    navItems.forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    Object.values(pages).forEach(p=>p.classList.remove('active'));
    pages[page].classList.add('active');
    pageTitle.textContent = item.textContent.trim();
    sidebar.classList.remove('open');

    if(page==='dashboard') renderDashboard();
    if(page==='ventas') { renderCatalog(currentFilter); paintCart(); }
    if(page==='inventario') renderInventario();
    if(page==='bodega') renderBodega();
    if(page==='clientes') renderClientes();
    if(page==='historial') renderHistorial();
    if(page==='reportes') renderReportes();
    if(page==='config') loadConfigForm();
  });
});

btnBurger.addEventListener('click',()=>{ sidebar.classList.toggle('open'); });

// ---------------------------
// VENTAS
// ---------------------------
let CART = [];
let currentFilter = '';

const elProductosGrid = document.getElementById('productosGrid');
const elProductosEmpty = document.getElementById('productosEmpty');
const elSearch = document.getElementById('search');
const elScan = document.getElementById('scan');
const elBtnClear = document.getElementById('btnClear');
const elBtnDemoInv = document.getElementById('btnDemoInv');
const elBtnVaciar = document.getElementById('btnVaciar');
const elTablaCarritoBody = document.getElementById('tablaCarritoBody');
const elDescPorc = document.getElementById('descPorc');
const elIvaPorc = document.getElementById('ivaPorc');
const elExtraConcepto = document.getElementById('extraConcepto');
const elExtraMonto = document.getElementById('extraMonto');
const elNotas = document.getElementById('notas');
const elClienteSelect = document.getElementById('clienteSelect');
const elFormaPago = document.getElementById('formaPago');
const elLblSubtotal = document.getElementById('lblSubtotal');
const elLblDesc = document.getElementById('lblDesc');
const elLblExtra = document.getElementById('lblExtra');
const elLblIva = document.getElementById('lblIva');
const elLblTotal = document.getElementById('lblTotal');
const elTicketPreview = document.getElementById('ticketPreview');
const elBtnCobrar = document.getElementById('btnCobrar');

function ensureDemoInventory(){
  if(!state.inventario || !state.inventario.length){
    state.inventario = [
      {
        id:'PARA-500', sku:'PARA-500', nombre:'Paracetamol 500 mg',
        precio:95, costo:60,
        stockPiso:10, stockBodega:20, stockMin:3,
        caducidad:'', lote:'L-001', categoria:'Genérico',
        imagen:null
      },
      {
        id:'IBU-400', sku:'IBU-400', nombre:'Ibuprofeno 400 mg',
        precio:120, costo:70,
        stockPiso:8, stockBodega:15, stockMin:3,
        caducidad:'', lote:'L-002', categoria:'Genérico',
        imagen:null
      },
      {
        id:'AMOX-500', sku:'AMOX-500', nombre:'Amoxicilina 500 mg',
        precio:180, costo:100,
        stockPiso:6, stockBodega:10, stockMin:2,
        caducidad:'', lote:'L-003', categoria:'Original',
        imagen:null
      },
      {
        id:'CONS-001', sku:'CONS-001', nombre:'Consulta médica',
        precio:100, costo:0,
        stockPiso:999, stockBodega:0, stockMin:0,
        caducidad:'', lote:'SERV', categoria:'Servicio',
        imagen:null
      },
    ];
    saveState();
    renderInventario();
  }
}

function renderCatalog(filter=''){
  currentFilter = filter;
  const q = filter.trim().toLowerCase();
  const items = state.inventario.filter(p=>{
    if(!q) return true;
    return (p.nombre||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
  });
  elProductosGrid.innerHTML = '';
  if(!items.length){
    elProductosEmpty.style.display='block';
    return;
  }
  elProductosEmpty.style.display='none';
  items.forEach(prod=>{
    const card = document.createElement('div');
    card.className='producto-card';
    const imgBox = document.createElement('div');
    imgBox.className='producto-img';
    if(prod.imagen){
      const im=document.createElement('img');
      im.src=prod.imagen;
      imgBox.appendChild(im);
    }else{
      imgBox.textContent='💊';
    }
    const nameEl = document.createElement('div');
    nameEl.className='producto-nombre';
    nameEl.textContent=prod.nombre;
    const skuEl = document.createElement('div');
    skuEl.className='producto-sku';
    skuEl.textContent=prod.sku;
    const priceEl = document.createElement('div');
    priceEl.className='producto-precio';
    priceEl.textContent = money(prod.precio);
    const stockVal = (prod.stockPiso ?? prod.stock ?? 0);
    const stockEl = document.createElement('div');
    stockEl.className='producto-stock';
    stockEl.textContent = 'Stock piso: '+stockVal;
    const footer = document.createElement('div');
    footer.className='producto-footer';
    const btnAdd = document.createElement('button');
    btnAdd.className='btn-add';
    btnAdd.innerHTML='<span>+</span><span>Agregar</span>';
    btnAdd.disabled = stockVal<=0;
    btnAdd.style.opacity = stockVal<=0 ? 0.5 : 1;
    btnAdd.addEventListener('click',()=>addToCart(prod.id));
    footer.appendChild(btnAdd);
    card.appendChild(imgBox);
    card.appendChild(nameEl);
    card.appendChild(skuEl);
    card.appendChild(priceEl);
    card.appendChild(stockEl);
    card.appendChild(footer);
    elProductosGrid.appendChild(card);
  });
}

function addToCart(prodId){
  const prod = state.inventario.find(p=>p.id===prodId);
  if(!prod){alert('Producto no encontrado');return;}
  const stockVal = (prod.stockPiso ?? prod.stock ?? 0);
  const currentQty = CART.find(i=>i.id===prodId)?.cant || 0;
  if(currentQty >= stockVal){
    alert('No hay suficiente stock en piso para agregar más piezas.');
    return;
  }
  let item = CART.find(i=>i.id===prodId);
  if(!item){
    item = {id:prod.id, sku:prod.sku, nombre:prod.nombre, precio:Number(prod.precio)||0, cant:0};
    CART.push(item);
  }
  item.cant++;
  paintCart();
}
function changeQty(prodId,delta){
  const item = CART.find(i=>i.id===prodId);
  if(!item) return;
  const prod = state.inventario.find(p=>p.id===prodId);
  const stockVal = prod ? (prod.stockPiso ?? prod.stock ?? 0) : Infinity;
  if(delta>0 && item.cant >= stockVal){
    alert('No hay más stock disponible.');
    return;
  }
  item.cant += delta;
  if(item.cant<=0){
    CART = CART.filter(i=>i.id!==prodId);
  }
  paintCart();
}
function removeFromCart(prodId){
  CART = CART.filter(i=>i.id!==prodId);
  paintCart();
}

function getTotals(){
  let subtotal = CART.reduce((acc,i)=>acc + i.precio*i.cant,0);
  const descPorc = Number(elDescPorc.value)||0;
  const ivaPorc = Number(elIvaPorc.value)||0;
  const extraMonto = Number(elExtraMonto.value)||0;
  const descMonto = subtotal*(descPorc/100);
  const base = subtotal - descMonto + extraMonto;
  const ivaMonto = base*(ivaPorc/100);
  const total = base + ivaMonto;
  return {subtotal,descPorc,descMonto,extraMonto,ivaPorc,ivaMonto,total};
}
function paintTotals(){
  const t = getTotals();
  elLblSubtotal.textContent = money(t.subtotal);
  elLblDesc.textContent = money(t.descMonto);
  elLblExtra.textContent = money(t.extraMonto);
  elLblIva.textContent = money(t.ivaMonto);
  elLblTotal.textContent = money(t.total);
  paintTicketPreview();
}

function paintCart(){
  elTablaCarritoBody.innerHTML='';
  if(!CART.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=5;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Carrito vacío';
    tr.appendChild(td);elTablaCarritoBody.appendChild(tr);
  }else{
    CART.forEach(item=>{
      const tr=document.createElement('tr');
      const tdProd=document.createElement('td');tdProd.textContent=item.nombre;
      const tdCant=document.createElement('td');
      const cantWrap=document.createElement('div');cantWrap.className='carrito-actions';
      const btnMenos=document.createElement('button');btnMenos.className='qty-btn';btnMenos.textContent='−';
      btnMenos.addEventListener('click',()=>changeQty(item.id,-1));
      const spanCant=document.createElement('span');spanCant.textContent=item.cant;
      const btnMas=document.createElement('button');btnMas.className='qty-btn';btnMas.textContent='+';
      btnMas.addEventListener('click',()=>changeQty(item.id,1));
      cantWrap.appendChild(btnMenos);cantWrap.appendChild(spanCant);cantWrap.appendChild(btnMas);
      tdCant.appendChild(cantWrap);
      const tdPrecio=document.createElement('td');tdPrecio.textContent=money(item.precio);
      const tdSub=document.createElement('td');tdSub.textContent=money(item.precio*item.cant);
      const tdAcc=document.createElement('td');
      const btnDel=document.createElement('button');btnDel.className='qty-btn';btnDel.style.background='#fee2e2';btnDel.textContent='🗑';
      btnDel.addEventListener('click',()=>removeFromCart(item.id));
      tdAcc.appendChild(btnDel);
      tr.appendChild(tdProd);tr.appendChild(tdCant);tr.appendChild(tdPrecio);tr.appendChild(tdSub);tr.appendChild(tdAcc);
      elTablaCarritoBody.appendChild(tr);
    });
  }
  paintTotals();
}

function buildTicketObject(){
  const t = getTotals();
  const now = new Date();
  const idNum = (state.ventas.length || 0) + 1;
  const ticketId = 'T'+String(idNum).padStart(4,'0');
  return {
    id:ticketId,
    fechaISO:now.toISOString(),
    fechaTexto:now.toLocaleString('es-MX'),
    negocio:state.config.negocio || 'Farmacia DP',
    cliente:elClienteSelect.value || '',
    items:CART.map(i=>({sku:i.sku,nombre:i.nombre,precio:i.precio,cant:i.cant})),
    subtotal:t.subtotal,
    descPorc:t.descPorc,
    descMonto:t.descMonto,
    extraConcepto:elExtraConcepto.value||'',
    extraMonto:t.extraMonto,
    ivaPorc:t.ivaPorc,
    ivaMonto:t.ivaMonto,
    total:t.total,
    formaPago:elFormaPago.value,
    notas:elNotas.value||'',
    mensajeFinal:state.config.mensajeTicket||'¡Gracias por su compra!'
  };
}

function buildTicketText(ticket){
  const lines=[];
  lines.push(ticket.negocio);
  lines.push('----------------------------------------');
  lines.push('Ticket: '+ticket.id);
  lines.push('Fecha: '+ticket.fechaTexto);
  if(ticket.cliente){lines.push('Cliente: '+ticket.cliente);}
  lines.push('----------------------------------------');
  ticket.items.forEach(it=>{
    lines.push(`${it.nombre}`);
    lines.push(`  ${it.cant} x ${money(it.precio)} = ${money(it.cant*it.precio)}`);
  });
  if(ticket.extraConcepto && ticket.extraMonto>0){
    lines.push('----------------------------------------');
    lines.push(`${ticket.extraConcepto}: ${money(ticket.extraMonto)}`);
  }
  lines.push('----------------------------------------');
  lines.push('Subtotal: '+money(ticket.subtotal));
  lines.push('Descuento: '+money(ticket.descMonto));
  if(ticket.ivaPorc>0){lines.push(`IVA (${ticket.ivaPorc}%): ${money(ticket.ivaMonto)}`);}
  if(ticket.extraMonto>0){lines.push('Extra: '+money(ticket.extraMonto));}
  lines.push('TOTAL:   '+money(ticket.total));
  lines.push('Pago: '+ticket.formaPago);
  if(ticket.notas){
    lines.push('----------------------------------------');
    lines.push('Notas: '+ticket.notas);
  }
  lines.push('----------------------------------------');
  lines.push(ticket.mensajeFinal);
  return lines.join('\n');
}

function paintTicketPreview(){
  if(!CART.length){
    elTicketPreview.textContent='(Vacío)';
    return;
  }
  const ticket=buildTicketObject();
  elTicketPreview.textContent=buildTicketText(ticket);
}

function printTicket(ticket){
  const text = buildTicketText(ticket);
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>${ticket.negocio} - ${ticket.id}</title>
<style>
@page { size: 58mm auto; margin: 4mm; }
body{font-family:"Consolas","SF Mono",ui-monospace,monospace;font-size:11px;margin:0;padding:0;}
pre{white-space:pre-wrap;}
</style>
</head><body>
<pre>${text}</pre>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 500); };
<\/script>
</body></html>`;
  const w = window.open('','ticket','width=380,height=600');
  if(!w){alert('No se pudo abrir ventana de impresión. Revisa bloqueador de popups.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

elSearch.addEventListener('input',()=>renderCatalog(elSearch.value));
elScan.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const code = elScan.value.trim();
    if(!code) return;
    const prod = state.inventario.find(p=>(p.sku||'').toLowerCase()===code.toLowerCase());
    if(prod){addToCart(prod.id);}else{alert('SKU no encontrado: '+code);}
    elScan.value = '';
    setTimeout(()=>elScan.focus(),0);
  }
});
elBtnClear.addEventListener('click',()=>{
  elSearch.value='';elScan.value='';renderCatalog('');
});
elBtnDemoInv.addEventListener('click',()=>{
  ensureDemoInventory();renderCatalog(elSearch.value);saveState();alert('Inventario demo cargado.');
});
elBtnVaciar.addEventListener('click',()=>{CART=[];paintCart();});

[elDescPorc,elIvaPorc,elExtraMonto,elExtraConcepto,elNotas,elFormaPago,elClienteSelect].forEach(ctrl=>{
  ctrl.addEventListener('input',paintTotals);
  ctrl.addEventListener('change',paintTotals);
});

elBtnCobrar.addEventListener('click',()=>{
  if(!CART.length){alert('Carrito vacío.');return;}
  const ticket=buildTicketObject();

  // Descontar stock en inventario (stock piso)
  CART.forEach(item=>{
    const prod = state.inventario.find(p=>p.id===item.id);
    if(prod){
      const actual = Number(prod.stockPiso || prod.stock || 0);
      let nuevo = actual - item.cant;
      if(nuevo<0) nuevo=0;
      prod.stockPiso = nuevo;
    }
  });

  state.ventas.push(ticket);
  saveState();
  printTicket(ticket);
  CART=[];
  elDescPorc.value=0;
  elExtraConcepto.value='';
  elExtraMonto.value=0;
  elNotas.value='';
  elClienteSelect.value='';
  elIvaPorc.value = state.config.ivaDefault || 0;
  paintCart();
  renderCatalog(currentFilter);
  renderDashboard();
  renderHistorial();
  renderReportes();
  renderInventario();
});

// ---------------------------
// INVENTARIO
// ---------------------------
const elInvImagen = document.getElementById('invImagen');
const elInvImagenPreview = document.getElementById('invImagenPreview');
const elInvSku = document.getElementById('invSku');
const elInvNombre = document.getElementById('invNombre');
const elInvPrecio = document.getElementById('invPrecio');
const elInvCosto = document.getElementById('invCosto');
const elInvStockPiso = document.getElementById('invStockPiso');
const elInvStockBodega = document.getElementById('invStockBodega');
const elInvStockMin = document.getElementById('invStockMin');
const elInvLote = document.getElementById('invLote');
const elInvCaducidad = document.getElementById('invCaducidad');
const elInvCategoria = document.getElementById('invCategoria');
const elInvCategoriaNueva = document.getElementById('invCategoriaNueva');
const elBtnInvAgregarCategoria = document.getElementById('btnInvAgregarCategoria');
const elBtnInvGuardar = document.getElementById('btnInvGuardar');
const elBtnInvNuevo = document.getElementById('btnInvNuevo');
const elBtnInvCargarDemo = document.getElementById('btnInvCargarDemo');
const elBtnInvExportCsv = document.getElementById('btnInvExportCsv');
const elBtnInvExportPdf = document.getElementById('btnInvExportPdf');
const elTablaInventario = document.getElementById('tablaInventario');

let invEditId = null;
let invImagenData = null;

function fillCategoriasSelect(){
  elInvCategoria.innerHTML='';
  const optVacio=document.createElement('option');
  optVacio.value='';optVacio.textContent='Sin categoría';
  elInvCategoria.appendChild(optVacio);
  state.categorias.forEach(cat=>{
    const opt=document.createElement('option');
    opt.value=cat;opt.textContent=cat;
    elInvCategoria.appendChild(opt);
  });
}

function clearInvForm(){
  invEditId = null;
  invImagenData = null;
  elInvImagen.value='';
  elInvImagenPreview.innerHTML='💊';
  elInvSku.value='';
  elInvNombre.value='';
  elInvPrecio.value='';
  elInvCosto.value='';
  elInvStockPiso.value='';
  elInvStockBodega.value='';
  elInvStockMin.value='';
  elInvLote.value='';
  elInvCaducidad.value='';
  elInvCategoria.value='';
}

elInvImagen.addEventListener('change',()=>{
  const file = elInvImagen.files[0];
  if(!file){invImagenData=null;elInvImagenPreview.innerHTML='💊';return;}
  const reader = new FileReader();
  reader.onload = e=>{
    invImagenData = e.target.result;
    elInvImagenPreview.innerHTML='';
    const img = document.createElement('img');
    img.src = invImagenData;
    elInvImagenPreview.appendChild(img);
  };
  reader.readAsDataURL(file);
});

elBtnInvAgregarCategoria.addEventListener('click',()=>{
  const nueva = elInvCategoriaNueva.value.trim();
  if(!nueva){alert('Escribe una categoría.');return;}
  if(!state.categorias.includes(nueva)){
    state.categorias.push(nueva);
    saveState();
    fillCategoriasSelect();
    elInvCategoria.value = nueva;
  }else{
    elInvCategoria.value = nueva;
  }
  elInvCategoriaNueva.value='';
});

elBtnInvNuevo.addEventListener('click',clearInvForm);

elBtnInvGuardar.addEventListener('click',()=>{
  const sku = elInvSku.value.trim();
  const nombre = elInvNombre.value.trim();
  const precio = Number(elInvPrecio.value)||0;
  const costo = Number(elInvCosto.value)||0;
  const stockPiso = Number(elInvStockPiso.value)||0;
  const stockBodega = Number(elInvStockBodega.value)||0;
  const stockMin = Number(elInvStockMin.value)||0;
  const lote = elInvLote.value.trim();
  const caducidad = elInvCaducidad.value;
  const categoria = elInvCategoria.value;

  if(!sku){alert('SKU es obligatorio.');return;}
  if(!nombre){alert('Nombre es obligatorio.');return;}
  if(precio<=0){alert('Precio debe ser mayor a 0.');return;}

  if(!invEditId){
    // nuevo
    if(state.inventario.some(p=>p.sku===sku)){
      alert('Ya existe un producto con ese SKU.');
      return;
    }
    const nuevo = {
      id: sku,
      sku,
      nombre,
      precio,
      costo,
      stockPiso,
      stockBodega,
      stockMin,
      lote,
      caducidad,
      categoria,
      imagen: invImagenData || null
    };
    state.inventario.push(nuevo);
  }else{
    // editar
    const prod = state.inventario.find(p=>p.id===invEditId);
    if(!prod){alert('Producto no encontrado.');return;}
    // si cambia SKU, validar duplicado
    if(prod.sku !== sku && state.inventario.some(p=>p.sku===sku)){
      alert('Ya existe un producto con ese SKU.');
      return;
    }
    prod.sku = sku;
    prod.id = sku; // usamos SKU como id
    prod.nombre = nombre;
    prod.precio = precio;
    prod.costo = costo;
    prod.stockPiso = stockPiso;
    prod.stockBodega = stockBodega;
    prod.stockMin = stockMin;
    prod.lote = lote;
    prod.caducidad = caducidad;
    prod.categoria = categoria;
    if(invImagenData!==null){
      prod.imagen = invImagenData;
    }
  }
  saveState();
  clearInvForm();
  renderInventario();
  renderCatalog(currentFilter);
  alert('Producto guardado.');
});

elBtnInvCargarDemo.addEventListener('click',()=>{
  ensureDemoInventory();
  renderInventario();
  renderCatalog(currentFilter);
  alert('Inventario demo cargado.');
});

function exportInventarioCsv(){
  if(!state.inventario.length){
    alert('No hay productos en inventario.');
    return;
  }
  const header = ['SKU','Nombre','Precio','Costo','StockPiso','StockBodega','StockMin','Lote','Caducidad','Categoria'];
  const rows = state.inventario.map(p=>[
    p.sku||'',
    p.nombre||'',
    Number(p.precio||0).toFixed(2),
    Number(p.costo||0).toFixed(2),
    (p.stockPiso ?? p.stock ?? 0),
    (p.stockBodega ?? 0),
    (p.stockMin ?? 0),
    p.lote||'',
    p.caducidad||'',
    p.categoria||''
  ]);
  const csvLines = [
    header.join(','),
    ...rows.map(r=>r.map(v=>{
      const s = String(v ?? '');
      return '"'+s.replace(/"/g,'""')+'"';
    }).join(','))
  ];
  const blob = new Blob([csvLines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inventario_farmacia_dp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportInventarioPdf(){
  if(!state.inventario.length){
    alert('No hay productos en inventario.');
    return;
  }
  let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Inventario Farmacia</title>
<style>
@page { size: A4; margin: 15mm; }
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:11px;color:#111827;margin:0;padding:0;}
h1{font-size:16px;margin-bottom:8px;}
table{width:100%;border-collapse:collapse;font-size:10px;}
th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;}
th{background:#f3f4f6;}
tr:nth-child(even){background:#f9fafb;}
</style>
</head><body>
<h1>Inventario - ${state.config.negocio||'Farmacia DP'}</h1>
<table><thead><tr>
<th>SKU</th><th>Nombre</th><th>Precio</th><th>Costo</th><th>Piso</th><th>Bodega</th><th>Mín</th><th>Lote</th><th>Caducidad</th><th>Categoría</th>
</tr></thead><tbody>`;
  state.inventario.forEach(p=>{
    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockBod = p.stockBodega ?? 0;
    const stockMin = p.stockMin ?? 0;
    html += `<tr>
<td>${p.sku||''}</td>
<td>${p.nombre||''}</td>
<td>${Number(p.precio||0).toFixed(2)}</td>
<td>${Number(p.costo||0).toFixed(2)}</td>
<td>${stockPiso}</td>
<td>${stockBod}</td>
<td>${stockMin}</td>
<td>${p.lote||''}</td>
<td>${p.caducidad||''}</td>
<td>${p.categoria||''}</td>
</tr>`;
  });
  html += `</tbody></table>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 600); };
<\/script>
</body></html>`;
  const w = window.open('','inv','width=900,height=700');
  if(!w){alert('No se pudo abrir ventana para PDF.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

elBtnInvExportCsv.addEventListener('click',exportInventarioCsv);
elBtnInvExportPdf.addEventListener('click',exportInventarioPdf);

function renderInventario(){
  fillCategoriasSelect();
  elTablaInventario.innerHTML='';
  if(!state.inventario.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=9;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Sin productos. Usa "Cargar demo" o agrega uno nuevo.';
    tr.appendChild(td);elTablaInventario.appendChild(tr);
    return;
  }
  state.inventario.forEach((p,idx)=>{
    const tr=document.createElement('tr');

    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockMin = p.stockMin ?? 0;

    if(stockPiso <= 0){
      tr.style.backgroundColor = '#fee2e2'; // rojo claro sin stock
    }else if(stockMin > 0 && stockPiso <= stockMin){
      tr.style.backgroundColor = '#fef9c3'; // amarillo cuando está en mínimo
    }

    const tdImg=document.createElement('td');
    const box=document.createElement('div');box.className='inv-img-mini';
    if(p.imagen){
      const im=document.createElement('img');im.src=p.imagen;box.appendChild(im);
    }else{
      box.textContent='💊';
    }
    tdImg.appendChild(box);

    const tdSku=document.createElement('td');tdSku.textContent=p.sku||'';
    const tdNom=document.createElement('td');tdNom.textContent=p.nombre||'';
    const tdPre=document.createElement('td');tdPre.textContent=money(p.precio||0);
    const tdPiso=document.createElement('td');tdPiso.textContent=stockPiso;
    const tdBod=document.createElement('td');tdBod.textContent=p.stockBodega ?? 0;
    const tdCat=document.createElement('td');tdCat.textContent=p.categoria||'';

    const tdLC=document.createElement('td');
    const cad=p.caducidad||'';const lote=p.lote||'';
    tdLC.textContent = `${lote}${cad?(' · '+cad):''}`;

    const tdAcc=document.createElement('td');
    tdAcc.style.whiteSpace='nowrap';
    const btnEdit=document.createElement('button');btnEdit.className='qty-btn';btnEdit.textContent='✏';
    const btnMas=document.createElement('button');btnMas.className='qty-btn';btnMas.textContent='➕';
    const btnDel=document.createElement('button');btnDel.className='qty-btn';btnDel.textContent='🗑';
    btnDel.style.background='#fee2e2';

    btnEdit.addEventListener('click',()=>{
      invEditId = p.id;
      invImagenData = p.imagen || null;
      elInvSku.value = p.sku||'';
      elInvNombre.value = p.nombre||'';
      elInvPrecio.value = p.precio||'';
      elInvCosto.value = p.costo||'';
      elInvStockPiso.value = p.stockPiso ?? p.stock ?? 0;
      elInvStockBodega.value = p.stockBodega ?? 0;
      elInvStockMin.value = p.stockMin ?? 0;
      elInvLote.value = p.lote || '';
      elInvCaducidad.value = p.caducidad || '';
      elInvCategoria.value = p.categoria || '';
      if(p.imagen){
        elInvImagenPreview.innerHTML='';
        const im=document.createElement('img');im.src=p.imagen;elInvImagenPreview.appendChild(im);
      }else{
        elInvImagenPreview.innerHTML='💊';
      }
    });
    btnMas.addEventListener('click',()=>{
      const addPiso = Number(prompt('¿Cuántas piezas agregar a PISO?', '0')||'0');
      const addBod = Number(prompt('¿Cuántas piezas agregar a BODEGA?', '0')||'0');
      if(!isNaN(addPiso)&&addPiso>0){
        p.stockPiso = (p.stockPiso ?? p.stock ?? 0) + addPiso;
      }
      if(!isNaN(addBod)&&addBod>0){
        p.stockBodega = (p.stockBodega ?? 0) + addBod;
      }
      saveState();
      renderInventario();
      renderCatalog(currentFilter);
      renderBodega();
    });
    btnDel.addEventListener('click',()=>{
      if(!confirm('¿Eliminar producto del inventario?')) return;
      state.inventario.splice(idx,1);
      saveState();
      renderInventario();
      renderCatalog(currentFilter);
      renderBodega();
    });

    tdAcc.appendChild(btnEdit);
    tdAcc.appendChild(btnMas);
    tdAcc.appendChild(btnDel);

    tr.appendChild(tdImg);
    tr.appendChild(tdSku);
    tr.appendChild(tdNom);
    tr.appendChild(tdPre);
    tr.appendChild(tdPiso);
    tr.appendChild(tdBod);
    tr.appendChild(tdCat);
    tr.appendChild(tdLC);
    tr.appendChild(tdAcc);

    elTablaInventario.appendChild(tr);
  });
}

// ---------------------------
// BODEGA
// ---------------------------
const elBodSku = document.getElementById('bodSku');
const elBodCant = document.getElementById('bodCant');
const elBodCosto = document.getElementById('bodCosto');
const elBodLote = document.getElementById('bodLote');
const elBodCaducidad = document.getElementById('bodCaducidad');
const elBtnBodAgregarLote = document.getElementById('btnBodAgregarLote');
const elBtnBodCargarDemo = document.getElementById('btnBodCargarDemo');
const elTablaBodega = document.getElementById('tablaBodega');

function fillBodegaSelect(){
  if(!elBodSku) return;
  elBodSku.innerHTML='';
  const opt0 = document.createElement('option');
  opt0.value='';opt0.textContent='Selecciona producto';
  elBodSku.appendChild(opt0);
  state.inventario.forEach(p=>{
    const opt = document.createElement('option');
    opt.value=p.id;
    opt.textContent=`${p.sku} · ${p.nombre}`;
    elBodSku.appendChild(opt);
  });
}

function renderBodega(){
  fillBodegaSelect();
  if(!elTablaBodega){return;}
  elTablaBodega.innerHTML='';
  if(!state.inventario.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=6;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Sin productos. Usa "Cargar demo" o agrega inventario.';
    tr.appendChild(td);elTablaBodega.appendChild(tr);
    return;
  }
  state.inventario.forEach(p=>{
    const tr=document.createElement('tr');
    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockBod = p.stockBodega ?? 0;
    const lote = p.lote || '';
    const cad = p.caducidad || '';

    const tdSku=document.createElement('td');tdSku.textContent=p.sku||'';
    const tdNom=document.createElement('td');tdNom.textContent=p.nombre||'';
    const tdBod=document.createElement('td');tdBod.textContent=stockBod;
    const tdPiso=document.createElement('td');tdPiso.textContent=stockPiso;
    const tdLC=document.createElement('td');tdLC.textContent=`${lote}${cad?(' · '+cad):''}`;

    const tdAcc=document.createElement('td');
    tdAcc.style.whiteSpace='nowrap';
    const btnToPiso=document.createElement('button');
    btnToPiso.className='qty-btn';
    btnToPiso.textContent='⇩';
    btnToPiso.title='Surtir a piso';
    btnToPiso.dataset.action='toPiso';
    btnToPiso.dataset.id=p.id;

    const btnToBod=document.createElement('button');
    btnToBod.className='qty-btn';
    btnToBod.textContent='⇧';
    btnToBod.title='Regresar a bodega';
    btnToBod.dataset.action='toBodega';
    btnToBod.dataset.id=p.id;

    tdAcc.appendChild(btnToPiso);
    tdAcc.appendChild(btnToBod);

    tr.appendChild(tdSku);
    tr.appendChild(tdNom);
    tr.appendChild(tdBod);
    tr.appendChild(tdPiso);
    tr.appendChild(tdLC);
    tr.appendChild(tdAcc);
    elTablaBodega.appendChild(tr);
  });
}

if(elTablaBodega){
  elTablaBodega.addEventListener('click',e=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const prod = state.inventario.find(p=>p.id===id);
    if(!prod) return;

    if(action==='toPiso'){
      const max = prod.stockBodega ?? 0;
      if(max<=0){alert('No hay stock en bodega para este producto.');return;}
      const cant = Number(prompt(`¿Cuántas piezas mover de BODEGA a PISO? (max ${max})`,'0')||'0');
      if(isNaN(cant) || cant<=0) return;
      if(cant>max){alert('No puedes mover más de lo que hay en bodega.');return;}
      prod.stockBodega = max - cant;
      prod.stockPiso = (prod.stockPiso ?? prod.stock ?? 0) + cant;
    }else if(action==='toBodega'){
      const maxPiso = prod.stockPiso ?? prod.stock ?? 0;
      if(maxPiso<=0){alert('No hay stock en piso para devolver.');return;}
      const cant = Number(prompt(`¿Cuántas piezas mover de PISO a BODEGA? (max ${maxPiso})`,'0')||'0');
      if(isNaN(cant) || cant<=0) return;
      if(cant>maxPiso){alert('No puedes mover más de lo que hay en piso.');return;}
      prod.stockPiso = maxPiso - cant;
      prod.stockBodega = (prod.stockBodega ?? 0) + cant;
    }
    saveState();
    renderInventario();
    renderBodega();
    renderCatalog(currentFilter);
  });
}

if(elBtnBodAgregarLote){
  elBtnBodAgregarLote.addEventListener('click',()=>{
    const id = elBodSku.value;
    const cant = Number(elBodCant.value)||0;
    if(!id){alert('Selecciona un producto.');return;}
    if(cant<=0){alert('Cantidad debe ser mayor a 0.');return;}
    const prod = state.inventario.find(p=>p.id===id);
    if(!prod){alert('Producto no encontrado.');return;}
    prod.stockBodega = (prod.stockBodega ?? 0) + cant;

    const costoNuevo = Number(elBodCosto.value);
    if(!isNaN(costoNuevo) && costoNuevo>0){
      prod.costo = costoNuevo;
    }
    const lote = elBodLote.value.trim();
    const cad = elBodCaducidad.value;
    if(lote) prod.lote = lote;
    if(cad) prod.caducidad = cad;

    saveState();
    elBodCant.value='0';
    elBodCosto.value='';
    elBodLote.value='';
    elBodCaducidad.value='';
    renderInventario();
    renderBodega();
    alert('Lote agregado a bodega.');
  });
}

if(elBtnBodCargarDemo){
  elBtnBodCargarDemo.addEventListener('click',()=>{
    ensureDemoInventory();
    renderInventario();
    renderBodega();
    renderCatalog(currentFilter);
    alert('Inventario demo cargado en bodega.');
  });
}

// ---------------------------
// CLIENTES
// ---------------------------
const elCliNombre = document.getElementById('cliNombre');
const elCliTel = document.getElementById('cliTel');
const elCliCorreo = document.getElementById('cliCorreo');
const elBtnAgregarCliente = document.getElementById('btnAgregarCliente');
const elListaClientes = document.getElementById('listaClientes');

function renderClientes(){
  elListaClientes.innerHTML='';
  if(!state.clientes.length){
    elListaClientes.textContent='Sin clientes registrados.';
  }else{
    state.clientes.forEach((c,idx)=>{
      const row=document.createElement('div');
      row.style.display='flex';
      row.style.justifyContent='space-between';
      row.style.borderBottom='1px dashed #e5e7eb';
      row.style.padding='3px 0';
      row.innerHTML=`<span>${c.nombre} (${c.telefono||'s/tel'})</span><button data-idx="${idx}" class="btn btn-outline" style="padding:2px 8px;font-size:11px;">Eliminar</button>`;
      elListaClientes.appendChild(row);
    });
    elListaClientes.querySelectorAll('button[data-idx]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i=Number(btn.dataset.idx);
        state.clientes.splice(i,1);
        saveState();
        renderClientes();
        fillClientesSelect();
      });
    });
  }
  fillClientesSelect();
}
function fillClientesSelect(){
  elClienteSelect.innerHTML='<option value="">Sin cliente</option>';
  state.clientes.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.nombre;opt.textContent=c.nombre;
    elClienteSelect.appendChild(opt);
  });
}
elBtnAgregarCliente.addEventListener('click',()=>{
  const nombre=elCliNombre.value.trim();
  if(!nombre){alert('Nombre es obligatorio');return;}
  state.clientes.push({nombre,telefono:elCliTel.value.trim(),correo:elCliCorreo.value.trim()});
  elCliNombre.value='';elCliTel.value='';elCliCorreo.value='';
  saveState();
  renderClientes();
});

// ---------------------------
// HISTORIAL
// ---------------------------
const elHistDesde   = document.getElementById('histDesde');
const elHistHasta   = document.getElementById('histHasta');
const elHistForma   = document.getElementById('histFormaPago');
const elHistCliente = document.getElementById('histCliente');
const elHistTabla   = document.getElementById('historialTabla');
const elHistResumen = document.getElementById('historialResumen');
const elBtnHistLimpiar    = document.getElementById('btnHistLimpiar');
const elBtnHistExportCsv  = document.getElementById('btnHistExportCsv');
const elBtnHistExportPdf  = document.getElementById('btnHistExportPdf');

function getVentasFiltradas(){
  let arr = state.ventas.slice();
  const dDesde = elHistDesde.value;
  const dHasta = elHistHasta.value;
  const forma  = elHistForma.value;
  const cliQ   = elHistCliente.value.trim().toLowerCase();

  if(dDesde){
    arr = arr.filter(v=> v.fechaISO.slice(0,10) >= dDesde);
  }
  if(dHasta){
    arr = arr.filter(v=> v.fechaISO.slice(0,10) <= dHasta);
  }
  if(forma){
    arr = arr.filter(v=> v.formaPago === forma);
  }
  if(cliQ){
    arr = arr.filter(v=> (v.cliente||'').toLowerCase().includes(cliQ));
  }
  return arr;
}

function renderHistorial(){
  const ventas = getVentasFiltradas();
  elHistTabla.innerHTML='';
  if(!ventas.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=6;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Sin ventas para los filtros seleccionados.';
    tr.appendChild(td);elHistTabla.appendChild(tr);
    elHistResumen.textContent='';
    return;
  }
  let total = 0;
  ventas.slice().reverse().forEach(v=>{
    total += v.total;
    const tr=document.createElement('tr');
    const fechaCorta = v.fechaTexto;
    const tdId = document.createElement('td'); tdId.textContent = v.id;
    const tdFecha = document.createElement('td'); tdFecha.textContent = fechaCorta;
    const tdCli = document.createElement('td'); tdCli.textContent = v.cliente || 'Sin cliente';
    const tdPago = document.createElement('td'); tdPago.textContent = v.formaPago;
    const tdTotal = document.createElement('td'); tdTotal.textContent = money(v.total);
    const tdAcc = document.createElement('td'); tdAcc.style.whiteSpace='nowrap';

    const btnVer = document.createElement('button');
    btnVer.className='qty-btn'; btnVer.textContent='👁';
    btnVer.title='Ver detalle';
    btnVer.addEventListener('click',()=>{
      const txt = buildTicketText(v);
      alert(txt);
    });

    const btnReimp = document.createElement('button');
    btnReimp.className='qty-btn'; btnReimp.textContent='🖨';
    btnReimp.title='Reimprimir ticket';
    btnReimp.addEventListener('click',()=>printTicket(v));

    tdAcc.appendChild(btnVer);
    tdAcc.appendChild(btnReimp);

    tr.appendChild(tdId);
    tr.appendChild(tdFecha);
    tr.appendChild(tdCli);
    tr.appendChild(tdPago);
    tr.appendChild(tdTotal);
    tr.appendChild(tdAcc);
    elHistTabla.appendChild(tr);
  });
  elHistResumen.textContent = `Mostrando ${ventas.length} venta(s) · Total: ${money(total)}`;
}

function exportHistorialCsv(){
  const ventas = getVentasFiltradas();
  if(!ventas.length){
    alert('No hay ventas para exportar con los filtros actuales.');
    return;
  }
  const header = ['Ticket','Fecha','Cliente','FormaPago','Subtotal','Descuento','Extra','IVA','Total','Notas'];
  const rows = ventas.map(v=>[
    v.id,
    v.fechaTexto,
    v.cliente || '',
    v.formaPago || '',
    v.subtotal.toFixed(2),
    v.descMonto.toFixed(2),
    v.extraMonto.toFixed(2),
    v.ivaMonto.toFixed(2),
    v.total.toFixed(2),
    v.notas || ''
  ]);
  const csvLines = [
    header.join(','),
    ...rows.map(r=>r.map(v=>{
      const s = String(v ?? '');
      return '"'+s.replace(/"/g,'""')+'"';
    }).join(','))
  ];
  const blob = new Blob([csvLines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial_ventas_farmacia_dp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportHistorialPdf(){
  const ventas = getVentasFiltradas();
  if(!ventas.length){
    alert('No hay ventas para exportar con los filtros actuales.');
    return;
  }
  let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Historial de ventas</title>
<style>
@page { size: A4; margin: 15mm; }
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:11px;color:#111827;margin:0;padding:0;}
h1{font-size:16px;margin-bottom:8px;}
table{width:100%;border-collapse:collapse;font-size:10px;}
th,td{border:1px solid #e5e7eb;padding:4px 6px;text-align:left;}
th{background:#f3f4f6;}
tr:nth-child(even){background:#f9fafb;}
</style>
</head><body>
<h1>Historial de ventas - ${state.config.negocio||'Farmacia DP'}</h1>
<table><thead><tr>
<th>Ticket</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Subtotal</th><th>Desc</th><th>Extra</th><th>IVA</th><th>Total</th>
</tr></thead><tbody>`;
  ventas.forEach(v=>{
    html += `<tr>
<td>${v.id}</td>
<td>${v.fechaTexto}</td>
<td>${v.cliente||''}</td>
<td>${v.formaPago||''}</td>
<td>${v.subtotal.toFixed(2)}</td>
<td>${v.descMonto.toFixed(2)}</td>
<td>${v.extraMonto.toFixed(2)}</td>
<td>${v.ivaMonto.toFixed(2)}</td>
<td>${v.total.toFixed(2)}</td>
</tr>`;
  });
  html += `</tbody></table>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 600); };
<\/script>
</body></html>`;
  const w = window.open('','hist','width=900,height=700');
  if(!w){alert('No se pudo abrir ventana para PDF.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

[elHistDesde, elHistHasta, elHistForma, elHistCliente].forEach(ctrl=>{
  ctrl.addEventListener('input',renderHistorial);
  ctrl.addEventListener('change',renderHistorial);
});

elBtnHistLimpiar.addEventListener('click',()=>{
  elHistDesde.value='';
  elHistHasta.value='';
  elHistForma.value='';
  elHistCliente.value='';
  renderHistorial();
});

elBtnHistExportCsv.addEventListener('click',exportHistorialCsv);
elBtnHistExportPdf.addEventListener('click',exportHistorialPdf);

// ---------------------------
// REPORTES simples
// ---------------------------
const elReportesResumen = document.getElementById('reportesResumen');
function renderReportes(){
  const hoy = new Date().toISOString().slice(0,10);
  const ventasHoy = state.ventas.filter(v=>v.fechaISO.slice(0,10)===hoy);
  const totalHoy = ventasHoy.reduce((a,v)=>a+v.total,0);
  const ticketsHoy = ventasHoy.length;
  const ivaHoy = ventasHoy.reduce((a,v)=>a+v.ivaMonto,0);
  const descuentosHoy = ventasHoy.reduce((a,v)=>a+v.descMonto,0);
  const totalGeneral = state.ventas.reduce((a,v)=>a+v.total,0);
  const ticketsGeneral = state.ventas.length;
  elReportesResumen.innerHTML = `
    <p><strong>Hoy:</strong> ${money(totalHoy)} en ${ticketsHoy} tickets.</p>
    <p>IVA hoy: ${money(ivaHoy)} · Descuentos hoy: ${money(descuentosHoy)}</p>
    <p style="margin-top:6px;"><strong>Histórico:</strong> ${money(totalGeneral)} en ${ticketsGeneral} tickets.</p>
  `;
}

// ---------------------------
// CONFIG
// ---------------------------
const elCfgNegocio = document.getElementById('cfgNegocio');
const elCfgIva = document.getElementById('cfgIva');
const elCfgMensaje = document.getElementById('cfgMensaje');
const elBtnGuardarCfg = document.getElementById('btnGuardarCfg');
const elBtnExportJson = document.getElementById('btnExportJson');
const elInputImportJson = document.getElementById('inputImportJson');

function loadConfigForm(){
  elCfgNegocio.value = state.config.negocio || '';
  elCfgIva.value = state.config.ivaDefault || 0;
  elCfgMensaje.value = state.config.mensajeTicket || '';
}
elBtnGuardarCfg.addEventListener('click',()=>{
  state.config.negocio = elCfgNegocio.value.trim() || 'Farmacia DP';
  state.config.ivaDefault = Number(elCfgIva.value)||0;
  state.config.mensajeTicket = elCfgMensaje.value.trim() || '¡Gracias por su compra!';
  saveState();
  alert('Configuración guardada.');
});
elBtnExportJson.addEventListener('click',()=>{
  const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='farmacia_dp_backup.json';a.click();
  URL.revokeObjectURL(url);
});
elInputImportJson.addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const imported=JSON.parse(ev.target.result);
      state = Object.assign(state, imported);
      if(!Array.isArray(state.categorias) || !state.categorias.length){
        state.categorias=['Original','Genérico','Controlado','Perfumería'];
      }
      saveState();
      alert('Backup restaurado. Recarga la página para aplicar todo.');
    }catch(err){
      alert('Error al importar JSON');
    }
  };
  reader.readAsText(file);
});

// ---------------------------
// DASHBOARD simple
// ---------------------------
const elDashKpis = document.getElementById('dashKpis');
const elChart7dias = document.getElementById('chart7dias');
const elChartPagos = document.getElementById('chartPagos');
const elLegendPagos = document.getElementById('legendPagos');
const elListaUltimasVentas = document.getElementById('listaUltimasVentas');
const elListaKardex = document.getElementById('listaKardex');

function renderDashboard(){
  const hoyStr = new Date().toISOString().slice(0,10);
  const ventasHoy = state.ventas.filter(v=>v.fechaISO.slice(0,10)===hoyStr);
  const montoHoy = ventasHoy.reduce((a,v)=>a+v.total,0);
  const ivaHoy = ventasHoy.reduce((a,v)=>a+v.ivaMonto,0);
  const ticketsHoy = ventasHoy.length;
  const ticketProm = ticketsHoy ? (montoHoy/ticketsHoy) : 0;

  const mesStr = hoyStr.slice(0,7);
  const ventasMes = state.ventas.filter(v=>v.fechaISO.slice(0,7)===mesStr);
  const montoMes = ventasMes.reduce((a,v)=>a+v.total,0);

  elDashKpis.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Ventas hoy</div>
      <div class="kpi-value">${money(montoHoy)}</div>
      <div class="kpi-extra">${ticketsHoy} tickets</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ticket promedio hoy</div>
      <div class="kpi-value">${money(ticketProm)}</div>
      <div class="kpi-extra">Con base en ventas de hoy</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">IVA hoy</div>
      <div class="kpi-value">${money(ivaHoy)}</div>
      <div class="kpi-extra">Calculado sobre ventas con IVA</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Ventas del mes</div>
      <div class="kpi-value">${money(montoMes)}</div>
      <div class="kpi-extra">${mesStr}</div>
    </div>
  `;

  // Ventas últimos 7 días
  const hoy = new Date();
  const data7 = [];
  for(let i=6;i>=0;i--){
    const d = new Date(hoy);
    d.setDate(hoy.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const totalDia = state.ventas.filter(v=>v.fechaISO.slice(0,10)===key)
      .reduce((a,v)=>a+v.total,0);
    data7.push({fecha:key.slice(5), total:totalDia});
  }
  const maxDia = Math.max(...data7.map(d=>d.total),1);
  elChart7dias.innerHTML = '';
  data7.forEach(d=>{
    const row=document.createElement('div');row.className='bar-row';
    const lbl=document.createElement('div');lbl.className='bar-label';lbl.textContent=d.fecha;
    const track=document.createElement('div');track.className='bar-track';
    const fill=document.createElement('div');fill.className='bar-fill';
    fill.style.width = (d.total/maxDia*100)+'%';
    track.appendChild(fill);row.appendChild(lbl);row.appendChild(track);
    elChart7dias.appendChild(row);
  });

  // Formas de pago hoy
  const pagos = {Efectivo:0,Tarjeta:0,Transferencia:0,Mixto:0};
  ventasHoy.forEach(v=>{
    if(pagos[v.formaPago]!=null){pagos[v.formaPago]+=v.total;}
  });
  elChartPagos.innerHTML='';
  elLegendPagos.innerHTML='';
  const totalPagos = Object.values(pagos).reduce((a,v)=>a+v,0) || 1;
  Object.entries(pagos).forEach(([medio,valor])=>{
    const row=document.createElement('div');row.className='bar-row';
    const lbl=document.createElement('div');lbl.className='bar-label';lbl.textContent=medio;
    const track=document.createElement('div');track.className='bar-track';
    const fill=document.createElement('div');fill.className='bar-fill';
    fill.style.width=(valor/totalPagos*100)+'%';
    track.appendChild(fill);row.appendChild(lbl);row.appendChild(track);
    elChartPagos.appendChild(row);
    const pill=document.createElement('span');pill.className='pill';
    pill.textContent=`${medio}: ${money(valor)}`;
    elLegendPagos.appendChild(pill);
  });

  // Últimas ventas
  elListaUltimasVentas.innerHTML='';
  const ultimas = state.ventas.slice(-5).reverse();
  if(!ultimas.length){
    elListaUltimasVentas.textContent='Sin ventas aún.';
  }else{
    ultimas.forEach(v=>{
      const row=document.createElement('div');
      row.innerHTML=`<span>${v.id} · ${v.fechaTexto.slice(11,16)}</span><span>${money(v.total)}</span>`;
      elListaUltimasVentas.appendChild(row);
    });
  }
  // Kardex simple (por ahora solo ventas)
  elListaKardex.innerHTML='';
  const lineas=[];
  state.ventas.forEach(v=>{
    v.items.forEach(it=>{
      lineas.push({fecha:v.fechaISO,item:it});
    });
  });
  lineas.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  lineas.slice(0,8).forEach(l=>{
    const row=document.createElement('div');
    row.innerHTML=`<span>${l.item.nombre}</span><span>-${l.item.cant}</span>`;
    elListaKardex.appendChild(row);
  });
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
