// ========================================
// FARMACIA DP - TPV DEMO - APP.JS
// ========================================

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
  categorias: ['Original', 'Genérico', 'Controlado', 'Perfumería'],
  inventario: [],
  clientes: [],
  ventas: [],
  bodegaTransferencias: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
    }
  } catch (e) { console.error('loadState', e); }
  
  if (!Array.isArray(state.categorias) || !state.categorias.length) {
    state.categorias = ['Original', 'Genérico', 'Controlado', 'Perfumería'];
  }
}

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) { console.error('saveState', e); }
}

function money(v) { return '$' + (Number(v) || 0).toFixed(2); }

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

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[page].classList.add('active');
    pageTitle.textContent = item.textContent.trim();
    sidebar.classList.remove('open');

    if (page === 'dashboard') renderDashboard();
    if (page === 'ventas') { renderCatalog(currentFilter); paintCart(); }
    if (page === 'inventario') renderInventario();
    if (page === 'bodega') renderBodega();
    if (page === 'clientes') renderClientes();
    if (page === 'historial') renderHistorial();
    if (page === 'reportes') renderReportes();
    if (page === 'config') loadConfigForm();
  });
});

btnBurger.addEventListener('click', () => { sidebar.classList.toggle('open'); });

// ---------------------------
// SISTEMA DE MODALES
// ---------------------------
function confirmarAccion(titulo, mensaje, onConfirm) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalMessage').textContent = mensaje;
  modal.style.display = 'block';
  
  const handler = () => {
    modal.style.display = 'none';
    document.getElementById('modalConfirm').removeEventListener('click', handler);
    onConfirm();
  };
  
  document.getElementById('modalConfirm').addEventListener('click', handler);
}

document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('confirmModal').style.display = 'none';
});

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
const audioBeep = document.getElementById('audioBeep');

function ensureDemoInventory() {
  if (!state.inventario || !state.inventario.length) {
    state.inventario = [
      {
        id: 'PARA-500', sku: 'PARA-500', nombre: 'Paracetamol 500 mg',
        precio: 95, costo: 60,
        stockPiso: 10, stockBodega: 0, stockMin: 3,
        caducidad: '', lote: 'L-001', categoria: 'Genérico',
        imagen: null
      },
      {
        id: 'IBU-400', sku: 'IBU-400', nombre: 'Ibuprofeno 400 mg',
        precio: 120, costo: 70,
        stockPiso: 8, stockBodega: 0, stockMin: 3,
        caducidad: '', lote: 'L-002', categoria: 'Genérico',
        imagen: null
      },
      {
        id: 'AMOX-500', sku: 'AMOX-500', nombre: 'Amoxicilina 500 mg',
        precio: 180, costo: 100,
        stockPiso: 6, stockBodega: 0, stockMin: 2,
        caducidad: '', lote: 'L-003', categoria: 'Original',
        imagen: null
      },
      {
        id: 'CONS-001', sku: 'CONS-001', nombre: 'Consulta médica',
        precio: 100, costo: 0,
        stockPiso: 999, stockBodega: 0, stockMin: 0,
        caducidad: '', lote: 'SERV', categoria: 'Servicio',
        imagen: null
      },
    ];
    saveState();
    renderInventario();
  }
}

function renderCatalog(filter = '') {
  currentFilter = filter;
  const q = filter.trim().toLowerCase();
  const items = state.inventario.filter(p => {
    if (!q) return true;
    return (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
  });
  
  elProductosGrid.innerHTML = '';
  if (!items.length) {
    elProductosEmpty.style.display = 'block';
    return;
  }
  
  elProductosEmpty.style.display = 'none';
  items.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'producto-card';
    
    const imgBox = document.createElement('div');
    imgBox.className = 'producto-img';
    if (prod.imagen) {
      const im = document.createElement('img');
      im.src = prod.imagen;
      imgBox.appendChild(im);
    } else {
      imgBox.textContent = '💊';
    }
    
    const nameEl = document.createElement('div');
    nameEl.className = 'producto-nombre';
    nameEl.textContent = prod.nombre;
    
    const skuEl = document.createElement('div');
    skuEl.className = 'producto-sku';
    skuEl.textContent = prod.sku;
    
    const priceEl = document.createElement('div');
    priceEl.className = 'producto-precio';
    priceEl.textContent = money(prod.precio);
    
    const stockVal = (prod.stockPiso ?? prod.stock ?? 0);
    const stockEl = document.createElement('div');
    stockEl.className = 'producto-stock';
    stockEl.textContent = 'Stock piso: ' + stockVal;
    
    const footer = document.createElement('div');
    footer.className = 'producto-footer';
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn-add';
    btnAdd.innerHTML = '<span>+</span><span>Agregar</span>';
    btnAdd.disabled = stockVal <= 0;
    btnAdd.style.opacity = stockVal <= 0 ? 0.5 : 1;
    btnAdd.addEventListener('click', () => addToCart(prod.id));
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

function addToCart(prodId) {
  const prod = state.inventario.find(p => p.id === prodId);
  if (!prod) { alert('Producto no encontrado'); return; }
  
  const stockVal = (prod.stockPiso ?? prod.stock ?? 0);
  const currentQty = CART.find(i => i.id === prodId)?.cant || 0;
  
  if (currentQty >= stockVal) {
    alert('No hay suficiente stock en piso para agregar más piezas.');
    return;
  }
  
  let item = CART.find(i => i.id === prodId);
  if (!item) {
    item = { id: prod.id, sku: prod.sku, nombre: prod.nombre, precio: Number(prod.precio) || 0, cant: 0 };
    CART.push(item);
  }
  
  item.cant++;
  paintCart();
  
  // Reproducir sonido
  audioBeep.currentTime = 0;
  audioBeep.play().catch(() => {});
}

function changeQty(prodId, delta) {
  const item = CART.find(i => i.id === prodId);
  if (!item) return;
  
  const prod = state.inventario.find(p => p.id === prodId);
  const stockVal = prod ? (prod.stockPiso ?? prod.stock ?? 0) : Infinity;
  
  if (delta > 0 && item.cant >= stockVal) {
    alert('No hay más stock disponible.');
    return;
  }
  
  item.cant += delta;
  if (item.cant <= 0) {
    CART = CART.filter(i => i.id !== prodId);
  }
  paintCart();
}

function removeFromCart(prodId) {
  CART = CART.filter(i => i.id !== prodId);
  paintCart();
}

function getTotals() {
  let subtotal = CART.reduce((acc, i) => acc + i.precio * i.cant, 0);
  const descPorc = Number(elDescPorc.value) || 0;
  const ivaPorc = Number(elIvaPorc.value) || 0;
  const extraMonto = Number(elExtraMonto.value) || 0;
  const descMonto = subtotal * (descPorc / 100);
  const base = subtotal - descMonto + extraMonto;
  const ivaMonto = base * (ivaPorc / 100);
  const total = base + ivaMonto;
  return { subtotal, descPorc, descMonto, extraMonto, ivaPorc, ivaMonto, total };
}

function paintTotals() {
  const t = getTotals();
  elLblSubtotal.textContent = money(t.subtotal);
  elLblDesc.textContent = money(t.descMonto);
  elLblExtra.textContent = money(t.extraMonto);
  elLblIva.textContent = money(t.ivaMonto);
  elLblTotal.textContent = money(t.total);
  paintTicketPreview();
}

function paintCart() {
  elTablaCarritoBody.innerHTML = '';
  if (!CART.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.color = '#9ca3af';
    td.textContent = 'Carrito vacío';
    tr.appendChild(td);
    elTablaCarritoBody.appendChild(tr);
  } else {
    CART.forEach(item => {
      const tr = document.createElement('tr');
      
      const tdProd = document.createElement('td');
      tdProd.textContent = item.nombre;
      
      const tdCant = document.createElement('td');
      const cantWrap = document.createElement('div');
      cantWrap.className = 'carrito-actions';
      const btnMenos = document.createElement('button');
      btnMenos.className = 'qty-btn';
      btnMenos.textContent = '−';
      btnMenos.addEventListener('click', () => changeQty(item.id, -1));
      const spanCant = document.createElement('span');
      spanCant.textContent = item.cant;
      const btnMas = document.createElement('button');
      btnMas.className = 'qty-btn';
      btnMas.textContent = '+';
      btnMas.addEventListener('click', () => changeQty(item.id, 1));
      
      cantWrap.appendChild(btnMenos);
      cantWrap.appendChild(spanCant);
      cantWrap.appendChild(btnMas);
      tdCant.appendChild(cantWrap);
      
      const tdPrecio = document.createElement('td');
      tdPrecio.textContent = money(item.precio);
      
      const tdSub = document.createElement('td');
      tdSub.textContent = money(item.precio * item.cant);
      
      const tdAcc = document.createElement('td');
      const btnDel = document.createElement('button');
      btnDel.className = 'qty-btn';
      btnDel.style.background = '#fee2e2';
      btnDel.textContent = '🗑';
      btnDel.addEventListener('click', () => removeFromCart(item.id));
      tdAcc.appendChild(btnDel);
      
      tr.appendChild(tdProd);
      tr.appendChild(tdCant);
      tr.appendChild(tdPrecio);
      tr.appendChild(tdSub);
      tr.appendChild(tdAcc);
      elTablaCarritoBody.appendChild(tr);
    });
  }
  paintTotals();
}

function buildTicketObject() {
  const t = getTotals();
  const now = new Date();
  const idNum = (state.ventas.length || 0) + 1;
  const ticketId = 'T' + String(idNum).padStart(4, '0');
  
  return {
    id: ticketId,
    fechaISO: now.toISOString(),
    fechaTexto: now.toLocaleString('es-MX'),
    negocio: state.config.negocio || 'Farmacia DP',
    cliente: elClienteSelect.value || '',
    items: CART.map(i => ({ sku: i.sku, nombre: i.nombre, precio: i.precio, cant: i.cant })),
    subtotal: t.subtotal,
    descPorc: t.descPorc,
    descMonto: t.descMonto,
    extraConcepto: elExtraConcepto.value || '',
    extraMonto: t.extraMonto,
    ivaPorc: t.ivaPorc,
    ivaMonto: t.ivaMonto,
    total: t.total,
    formaPago: elFormaPago.value,
    notas: elNotas.value || '',
    mensajeFinal: state.config.mensajeTicket || '¡Gracias por su compra!',
    cancelado: false
  };
}

function buildTicketText(ticket) {
  const lines = [];
  lines.push(ticket.negocio);
  lines.push('----------------------------------------');
  lines.push('Ticket: ' + ticket.id);
  lines.push('Fecha: ' + ticket.fechaTexto);
  
  if (ticket.cliente) {
    lines.push('Cliente: ' + ticket.cliente);
  }
  
  lines.push('----------------------------------------');
  ticket.items.forEach(it => {
    lines.push(`${it.nombre}`);
    lines.push(`  ${it.cant} x ${money(it.precio)} = ${money(it.cant * it.precio)}`);
  });
  
  if (ticket.extraConcepto && ticket.extraMonto > 0) {
    lines.push('----------------------------------------');
    lines.push(`${ticket.extraConcepto}: ${money(ticket.extraMonto)}`);
  }
  
  lines.push('----------------------------------------');
  lines.push('Subtotal: ' + money(ticket.subtotal));
  lines.push('Descuento: ' + money(ticket.descMonto));
  
  if (ticket.ivaPorc > 0) {
    lines.push(`IVA (${ticket.ivaPorc}%): ${money(ticket.ivaMonto)}`);
  }
  
  if (ticket.extraMonto > 0) {
    lines.push('Extra: ' + money(ticket.extraMonto));
  }
  
  lines.push('TOTAL:   ' + money(ticket.total));
  lines.push('Pago: ' + ticket.formaPago);
  
  if (ticket.notas) {
    lines.push('----------------------------------------');
    lines.push('Notas: ' + ticket.notas);
  }
  
  lines.push('----------------------------------------');
  lines.push(ticket.mensajeFinal);
  return lines.join('\n');
}

function paintTicketPreview() {
  if (!CART.length) {
    elTicketPreview.textContent = '(Vacío)';
    return;
  }
  const ticket = buildTicketObject();
  elTicketPreview.textContent = buildTicketText(ticket);
}

function printTicket(ticket) {
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
  const w = window.open('', 'ticket', 'width=380,height=600');
  if (!w) { alert('No se pudo abrir ventana de impresión. Revisa bloqueador de popups.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// Event Listeners Ventas
elSearch.addEventListener('input', () => renderCatalog(elSearch.value));
elScan.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const code = elScan.value.trim();
    if (!code) return;
    const prod = state.inventario.find(p => (p.sku || '').toLowerCase() === code.toLowerCase());
    if (prod) { addToCart(prod.id); } else { alert('SKU no encontrado: ' + code); }
    elScan.value = '';
    setTimeout(() => elScan.focus(), 0);
  }
});
elBtnClear.addEventListener('click', () => {
  elSearch.value = '';
  elScan.value = '';
  renderCatalog('');
});
elBtnDemoInv.addEventListener('click', () => {
  ensureDemoInventory();
  renderCatalog(elSearch.value);
  saveState();
  alert('Inventario demo cargado.');
});
elBtnVaciar.addEventListener('click', () => {
  if (CART.length === 0) return;
  confirmarAccion('Vaciar carrito', '¿Seguro que quieres vaciar el carrito?', () => {
    CART = [];
    paintCart();
  });
});

[elDescPorc, elIvaPorc, elExtraMonto, elExtraConcepto, elNotas, elFormaPago, elClienteSelect].forEach(ctrl => {
  ctrl.addEventListener('input', paintTotals);
  ctrl.addEventListener('change', paintTotals);
});

elBtnCobrar.addEventListener('click', () => {
  if (!CART.length) { alert('Carrito vacío.'); return; }
  const ticket = buildTicketObject();

  // Descontar stock en inventario (stock piso)
  CART.forEach(item => {
    const prod = state.inventario.find(p => p.id === item.id);
    if (prod) {
      const actual = Number(prod.stockPiso || prod.stock || 0);
      let nuevo = actual - item.cant;
      if (nuevo < 0) nuevo = 0;
      prod.stockPiso = nuevo;
    }
  });

  state.ventas.push(ticket);
  saveState();
  printTicket(ticket);
  CART = [];
  elDescPorc.value = 0;
  elExtraConcepto.value = '';
  elExtraMonto.value = 0;
  elNotas.value = '';
  elClienteSelect.value = '';
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
const elBtnInvExportExcel = document.getElementById('btnInvExportExcel');
const elBtnInvExportPdf = document.getElementById('btnInvExportPdf');
const elTablaInventario = document.getElementById('tablaInventario');

let invEditId = null;
let invImagenData = null;

function fillCategoriasSelect() {
  elInvCategoria.innerHTML = '';
  const optVacio = document.createElement('option');
  optVacio.value = '';
  optVacio.textContent = 'Sin categoría';
  elInvCategoria.appendChild(optVacio);
  
  state.categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    elInvCategoria.appendChild(opt);
  });
}

function clearInvForm() {
  invEditId = null;
  invImagenData = null;
  elInvImagen.value = '';
  elInvImagenPreview.innerHTML = '💊';
  elInvSku.value = '';
  elInvNombre.value = '';
  elInvPrecio.value = '';
  elInvCosto.value = '';
  elInvStockPiso.value = '';
  elInvStockBodega.value = '';
  elInvStockMin.value = '';
  elInvLote.value = '';
  elInvCaducidad.value = '';
  elInvCategoria.value = '';
}

elInvImagen.addEventListener('change', () => {
  const file = elInvImagen.files[0];
  if (!file) { invImagenData = null; elInvImagenPreview.innerHTML = '💊'; return; }
  const reader = new FileReader();
  reader.onload = e => {
    invImagenData = e.target.result;
    elInvImagenPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = invImagenData;
    elInvImagenPreview.appendChild(img);
  };
  reader.readAsDataURL(file);
});

elBtnInvAgregarCategoria.addEventListener('click', () => {
  const nueva = elInvCategoriaNueva.value.trim();
  if (!nueva) { alert('Escribe una categoría.'); return; }
  if (!state.categorias.includes(nueva)) {
    state.categorias.push(nueva);
    saveState();
    fillCategoriasSelect();
    elInvCategoria.value = nueva;
  } else {
    elInvCategoria.value = nueva;
  }
  elInvCategoriaNueva.value = '';
});

elBtnInvNuevo.addEventListener('click', clearInvForm);

elBtnInvGuardar.addEventListener('click', () => {
  const sku = elInvSku.value.trim();
  const nombre = elInvNombre.value.trim();
  const precio = Number(elInvPrecio.value) || 0;
  const costo = Number(elInvCosto.value) || 0;
  const stockPiso = Number(elInvStockPiso.value) || 0;
  const stockBodega = Number(elInvStockBodega.value) || 0;
  const stockMin = Number(elInvStockMin.value) || 0;
  const lote = elInvLote.value.trim();
  const caducidad = elInvCaducidad.value;
  const categoria = elInvCategoria.value;

  if (!sku) { alert('SKU es obligatorio.'); return; }
  if (!nombre) { alert('Nombre es obligatorio.'); return; }
  if (precio <= 0) { alert('Precio debe ser mayor a 0.'); return; }

  if (!invEditId) {
    // Nuevo producto
    if (state.inventario.some(p => p.sku === sku)) {
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
  } else {
    // Editar producto
    const prod = state.inventario.find(p => p.id === invEditId);
    if (!prod) { alert('Producto no encontrado.'); return; }
    if (prod.sku !== sku && state.inventario.some(p => p.sku === sku)) {
      alert('Ya existe un producto con ese SKU.');
      return;
    }
    prod.sku = sku;
    prod.id = sku;
    prod.nombre = nombre;
    prod.precio = precio;
    prod.costo = costo;
    prod.stockPiso = stockPiso;
    prod.stockBodega = stockBodega;
    prod.stockMin = stockMin;
    prod.lote = lote;
    prod.caducidad = caducidad;
    prod.categoria = categoria;
    if (invImagenData !== null) {
      prod.imagen = invImagenData;
    }
  }
  
  saveState();
  clearInvForm();
  renderInventario();
  renderCatalog(currentFilter);
  alert('Producto guardado.');
});

elBtnInvCargarDemo.addEventListener('click', () => {
  ensureDemoInventory();
  renderInventario();
  renderCatalog(currentFilter);
  alert('Inventario demo cargado.');
});

function exportInventarioExcel() {
  if (!state.inventario.length) {
    alert('No hay productos en inventario.');
    return;
  }
  
  const wsData = [
    ['SKU', 'Nombre', 'Precio Venta', 'Costo', 'Stock Piso', 'Stock Bodega', 'Stock Mínimo', 'Lote', 'Caducidad', 'Categoría']
  ];
  
  state.inventario.forEach(p => {
    wsData.push([
      p.sku || '',
      p.nombre || '',
      Number(p.precio || 0),
      Number(p.costo || 0),
      p.stockPiso ?? p.stock ?? 0,
      p.stockBodega ?? 0,
      p.stockMin ?? 0,
      p.lote || '',
      p.caducidad || '',
      p.categoria || ''
    ]);
  });
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportInventarioPdf() {
  if (!state.inventario.length) {
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
<h1>Inventario - ${state.config.negocio || 'Farmacia DP'}</h1>
<table><thead><tr>
<th>SKU</th><th>Nombre</th><th>Precio</th><th>Costo</th><th>Piso</th><th>Bodega</th><th>Mín</th><th>Lote</th><th>Caducidad</th><th>Categoría</th>
</tr></thead><tbody>`;
  
  state.inventario.forEach(p => {
    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockBod = p.stockBodega ?? 0;
    const stockMin = p.stockMin ?? 0;
    html += `<tr>
<td>${p.sku || ''}</td>
<td>${p.nombre || ''}</td>
<td>${Number(p.precio || 0).toFixed(2)}</td>
<td>${Number(p.costo || 0).toFixed(2)}</td>
<td>${stockPiso}</td>
<td>${stockBod}</td>
<td>${stockMin}</td>
<td>${p.lote || ''}</td>
<td>${p.caducidad || ''}</td>
<td>${p.categoria || ''}</td>
</tr>`;
  });
  
  html += `</tbody></table>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 600); };
<\/script>
</body></html>`;
  const w = window.open('', 'inv', 'width=900,height=700');
  if (!w) { alert('No se pudo abrir ventana para PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

elBtnInvExportExcel.addEventListener('click', exportInventarioExcel);
elBtnInvExportPdf.addEventListener('click', exportInventarioPdf);

function renderInventario() {
  fillCategoriasSelect();
  elTablaInventario.innerHTML = '';
  
  if (!state.inventario.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.style.textAlign = 'center';
    td.style.color = '#9ca3af';
    td.textContent = 'Sin productos. Usa "Cargar demo" o agrega uno nuevo.';
    tr.appendChild(td);
    elTablaInventario.appendChild(tr);
    return;
  }
  
  state.inventario.forEach((p, idx) => {
    const tr = document.createElement('tr');
    
    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockMin = p.stockMin ?? 0;

    // Colores de alerta
    if (stockPiso <= 0) {
      tr.style.backgroundColor = '#fee2e2'; // Sin stock
    } else if (stockMin > 0 && stockPiso <= stockMin) {
      tr.style.backgroundColor = '#fef9c3'; // Stock bajo
    }

    const tdImg = document.createElement('td');
    const box = document.createElement('div');
    box.className = 'inv-img-mini';
    if (p.imagen) {
      const im = document.createElement('img');
      im.src = p.imagen;
      box.appendChild(im);
    } else {
      box.textContent = '💊';
    }
    tdImg.appendChild(box);

    const tdSku = document.createElement('td');
    tdSku.textContent = p.sku || '';
    
    const tdNom = document.createElement('td');
    tdNom.textContent = p.nombre || '';
    
    const tdPre = document.createElement('td');
    tdPre.textContent = money(p.precio || 0);
    
    const tdPiso = document.createElement('td');
    tdPiso.textContent = stockPiso;
    
    const tdBod = document.createElement('td');
    tdBod.textContent = p.stockBodega ?? 0;
    
    const tdCat = document.createElement('td');
    tdCat.textContent = p.categoria || '';
    
    const tdLC = document.createElement('td');
    const cad = p.caducidad || '';
    const lote = p.lote || '';
    tdLC.textContent = `${lote}${cad ? (' · ' + cad) : ''}`;
    
    const tdAcc = document.createElement('td');
    tdAcc.style.whiteSpace = 'nowrap';
    
    const btnEdit = document.createElement('button');
    btnEdit.className = 'qty-btn';
    btnEdit.textContent = '✏';
    
    const btnMas = document.createElement('button');
    btnMas.className = 'qty-btn';
    btnMas.textContent = '➕';
    
    const btnDel = document.createElement('button');
    btnDel.className = 'qty-btn';
    btnDel.textContent = '🗑';
    btnDel.style.background = '#fee2e2';

    btnEdit.addEventListener('click', () => {
      invEditId = p.id;
      invImagenData = p.imagen || null;
      elInvSku.value = p.sku || '';
      elInvNombre.value = p.nombre || '';
      elInvPrecio.value = p.precio || '';
      elInvCosto.value = p.costo || '';
      elInvStockPiso.value = p.stockPiso ?? p.stock ?? 0;
      elInvStockBodega.value = p.stockBodega ?? 0;
      elInvStockMin.value = p.stockMin ?? 0;
      elInvLote.value = p.lote || '';
      elInvCaducidad.value = p.caducidad || '';
      elInvCategoria.value = p.categoria || '';
      
      if (p.imagen) {
        elInvImagenPreview.innerHTML = '';
        const im = document.createElement('img');
        im.src = p.imagen;
        elInvImagenPreview.appendChild(im);
      } else {
        elInvImagenPreview.innerHTML = '💊';
      }
    });
    
    btnMas.addEventListener('click', () => {
      const addPiso = Number(prompt('¿Cuántas piezas agregar a PISO?', '0') || '0');
      const addBod = Number(prompt('¿Cuántas piezas agregar a BODEGA?', '0') || '0');
      
      if (!isNaN(addPiso) && addPiso > 0) {
        p.stockPiso = (p.stockPiso ?? p.stock ?? 0) + addPiso;
      }
      if (!isNaN(addBod) && addBod > 0) {
        p.stockBodega = (p.stockBodega ?? 0) + addBod;
      }
      
      saveState();
      renderInventario();
      renderCatalog(currentFilter);
    });
    
    btnDel.addEventListener('click', () => {
      confirmarAccion('Eliminar producto', `¿Eliminar ${p.nombre}?`, () => {
        state.inventario.splice(idx, 1);
        saveState();
        renderInventario();
        renderCatalog(currentFilter);
      });
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
// CLIENTES
// ---------------------------
const elCliNombre = document.getElementById('cliNombre');
const elCliTel = document.getElementById('cliTel');
const elCliCorreo = document.getElementById('cliCorreo');
const elBtnAgregarCliente = document.getElementById('btnAgregarCliente');
const elListaClientes = document.getElementById('listaClientes');

function renderClientes() {
  elListaClientes.innerHTML = '';
  if (!state.clientes.length) {
    elListaClientes.textContent = 'Sin clientes registrados.';
  } else {
    state.clientes.forEach((c, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.borderBottom = '1px dashed #e5e7eb';
      row.style.padding = '3px 0';
      row.innerHTML = `<span>${c.nombre} (${c.telefono || 's/tel'})</span><button data-idx="${idx}" class="btn btn-outline" style="padding:2px 8px;font-size:11px;">Eliminar</button>`;
      elListaClientes.appendChild(row);
    });
    
    elListaClientes.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        state.clientes.splice(i, 1);
        saveState();
        renderClientes();
        fillClientesSelect();
      });
    });
  }
  fillClientesSelect();
}

function fillClientesSelect() {
  elClienteSelect.innerHTML = '<option value="">Sin cliente</option>';
  state.clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    opt.textContent = c.nombre;
    elClienteSelect.appendChild(opt);
  });
}

elBtnAgregarCliente.addEventListener('click', () => {
  const nombre = elCliNombre.value.trim();
  if (!nombre) { alert('Nombre es obligatorio'); return; }
  
  state.clientes.push({
    nombre,
    telefono: elCliTel.value.trim(),
    correo: elCliCorreo.value.trim()
  });
  
  elCliNombre.value = '';
  elCliTel.value = '';
  elCliCorreo.value = '';
  saveState();
  renderClientes();
});

// ---------------------------
// BODEGA
// ---------------------------
const elBodegaProductoSelect = document.getElementById('bodegaProductoSelect');
const elBodegaCantidad = document.getElementById('bodegaCantidad');
const elBodegaTipo = document.getElementById('bodegaTipo');
const elBtnBodegaTransferir = document.getElementById('btnBodegaTransferir');
const elBodegaSolicitudes = document.getElementById('bodegaSolicitudes');
const elBodegaHistorial = document.getElementById('bodegaHistorial');

function renderBodega() {
  // Llenar selector de productos
  elBodegaProductoSelect.innerHTML = '<option value="">Selecciona producto</option>';
  state.inventario.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.nombre} (Piso: ${p.stockPiso ?? 0}, Bodega: ${p.stockBodega ?? 0})`;
    elBodegaProductoSelect.appendChild(opt);
  });

  // Mostrar solicitudes automáticas
  elBodegaSolicitudes.innerHTML = '';
  const solicitudes = state.inventario.filter(p => {
    const stockPiso = p.stockPiso ?? p.stock ?? 0;
    const stockMin = p.stockMin ?? 0;
    return stockMin > 0 && stockPiso <= stockMin;
  });

  if (solicitudes.length === 0) {
    elBodegaSolicitudes.innerHTML = '<p style="color:#6b7280; font-size:12px;">No hay solicitudes pendientes.</p>';
  } else {
    solicitudes.forEach(p => {
      const div = document.createElement('div');
      div.className = 'alert-item';
      div.innerHTML = `
        <span class="label">${p.nombre}</span>
        <span class="badge badge-amber">Stock bajo: ${p.stockPiso ?? 0}/${p.stockMin ?? 0}</span>
      `;
      elBodegaSolicitudes.appendChild(div);
    });
  }

  // Mostrar historial reciente
  elBodegaHistorial.innerHTML = '';
  const recientes = state.bodegaTransferencias.slice(-5).reverse();
  
  if (recientes.length === 0) {
    elBodegaHistorial.innerHTML = '<p style="color:#6b7280; font-size:12px;">Sin transferencias recientes.</p>';
  } else {
    recientes.forEach(t => {
      const div = document.createElement('div');
      div.className = 'list-mini';
      div.style.padding = '4px 0';
      div.innerHTML = `<span>${t.fecha} · ${t.tipo === 'piso' ? '📤' : '📥'} ${t.producto}</span><span>${t.cantidad} pzs</span>`;
      elBodegaHistorial.appendChild(div);
    });
  }
}

elBtnBodegaTransferir.addEventListener('click', () => {
  const prodId = elBodegaProductoSelect.value;
  const cantidad = Number(elBodegaCantidad.value);
  const tipo = elBodegaTipo.value;

  if (!prodId) { alert('Selecciona un producto'); return; }
  if (!cantidad || cantidad <= 0) { alert('Cantidad inválida'); return; }

  const prod = state.inventario.find(p => p.id === prodId);
  if (!prod) { alert('Producto no encontrado'); return; }

  const stockOrigen = tipo === 'piso' ? (prod.stockBodega ?? 0) : (prod.stockPiso ?? 0);
  
  if (cantidad > stockOrigen) {
    alert(`No hay suficiente stock. Disponible: ${stockOrigen}`);
    return;
  }

  // Ejecutar transferencia
  if (tipo === 'piso') {
    prod.stockBodega = stockOrigen - cantidad;
    prod.stockPiso = (prod.stockPiso ?? 0) + cantidad;
  } else {
    prod.stockPiso = (prod.stockPiso ?? 0) - cantidad;
    prod.stockBodega = stockOrigen - cantidad;
  }

  // Registrar en historial
  state.bodegaTransferencias.push({
    fecha: new Date().toLocaleString('es-MX'),
    producto: prod.nombre,
    cantidad: cantidad,
    tipo: tipo
  });

  saveState();
  renderBodega();
  renderInventario();
  renderCatalog(currentFilter);
  
  // Limpiar formulario
  elBodegaCantidad.value = '';
  elBodegaProductoSelect.value = '';
  
  alert('Transferencia realizada correctamente');
});

// ---------------------------
// HISTORIAL
// ---------------------------
const elHistDesde = document.getElementById('histDesde');
const elHistHasta = document.getElementById('histHasta');
const elHistForma = document.getElementById('histFormaPago');
const elHistCliente = document.getElementById('histCliente');
const elHistTabla = document.getElementById('historialTabla');
const elHistResumen = document.getElementById('historialResumen');
const elBtnHistLimpiar = document.getElementById('btnHistLimpiar');
const elBtnHistExportExcel = document.getElementById('btnHistExportExcel');
const elBtnHistExportPdf = document.getElementById('btnHistExportPdf');

function getVentasFiltradas() {
  let arr = state.ventas.filter(v => !v.cancelado).slice();
  const dDesde = elHistDesde.value;
  const dHasta = elHistHasta.value;
  const forma = elHistForma.value;
  const cliQ = elHistCliente.value.trim().toLowerCase();

  if (dDesde) {
    arr = arr.filter(v => v.fechaISO.slice(0, 10) >= dDesde);
  }
  if (dHasta) {
    arr = arr.filter(v => v.fechaISO.slice(0, 10) <= dHasta);
  }
  if (forma) {
    arr = arr.filter(v => v.formaPago === forma);
  }
  if (cliQ) {
    arr = arr.filter(v => (v.cliente || '').toLowerCase().includes(cliQ));
  }
  return arr;
}

function renderHistorial() {
  const ventas = getVentasFiltradas();
  elHistTabla.innerHTML = '';
  
  if (!ventas.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.textAlign = 'center';
    td.style.color = '#9ca3af';
    td.textContent = 'Sin ventas para los filtros seleccionados.';
    tr.appendChild(td);
    elHistTabla.appendChild(tr);
    elHistResumen.textContent = '';
    return;
  }
  
  let total = 0;
  ventas.slice().reverse().forEach(v => {
    total += v.total;
    const tr = document.createElement('tr');
    const fechaCorta = v.fechaTexto;
    const tdId = document.createElement('td');
    tdId.textContent = v.id;
    const tdFecha = document.createElement('td');
    tdFecha.textContent = fechaCorta;
    const tdCli = document.createElement('td');
    tdCli.textContent = v.cliente || 'Sin cliente';
    const tdPago = document.createElement('td');
    tdPago.textContent = v.formaPago;
    const tdTotal = document.createElement('td');
    tdTotal.textContent = money(v.total);
    const tdAcc = document.createElement('td');
    tdAcc.style.whiteSpace = 'nowrap';

    const btnVer = document.createElement('button');
    btnVer.className = 'qty-btn';
    btnVer.textContent = '👁';
    btnVer.title = 'Ver detalle';
    btnVer.addEventListener('click', () => {
      const txt = buildTicketText(v);
      alert(txt);
    });

    const btnReimp = document.createElement('button');
    btnReimp.className = 'qty-btn';
    btnReimp.textContent = '🖨';
    btnReimp.title = 'Reimprimir ticket';
    btnReimp.addEventListener('click', () => printTicket(v));

    const btnCancel = document.createElement('button');
    btnCancel.className = 'qty-btn';
    btnCancel.textContent = '❌';
    btnCancel.title = 'Cancelar ticket y devolver stock';
    btnCancel.addEventListener('click', () => {
      confirmarAccion('Cancelar ticket', '¿Cancelar este ticket y devolver stock?', () => {
        // Devolver stock
        v.items.forEach(item => {
          const prod = state.inventario.find(p => p.sku === item.sku);
          if (prod) {
            prod.stockPiso = (prod.stockPiso ?? 0) + item.cant;
          }
        });
        
        // Marcar como cancelado
        v.cancelado = true;
        v.fechaCancelacion = new Date().toISOString();
        saveState();
        renderHistorial();
        renderInventario();
        alert('Ticket cancelado y stock devuelto');
      });
    });

    tdAcc.appendChild(btnVer);
    tdAcc.appendChild(btnReimp);
    tdAcc.appendChild(btnCancel);

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

function exportHistorialExcel() {
  const ventas = getVentasFiltradas();
  if (!ventas.length) {
    alert('No hay ventas para exportar con los filtros actuales.');
    return;
  }
  
  const wsData = [
    ['Ticket', 'Fecha', 'Cliente', 'FormaPago', 'Subtotal', 'Descuento', 'Extra', 'IVA', 'Total', 'Notas']
  ];
  
  ventas.forEach(v => {
    wsData.push([
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
  });
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb,