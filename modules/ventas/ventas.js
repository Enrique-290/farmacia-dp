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
        stockPiso:10, stockBodega:0, stockMin:3,
        caducidad:'', lote:'L-001', categoria:'Genérico',
        imagen:null, lotes:[]
      },
      {
        id:'IBU-400', sku:'IBU-400', nombre:'Ibuprofeno 400 mg',
        precio:120, costo:70,
        stockPiso:8, stockBodega:0, stockMin:3,
        caducidad:'', lote:'L-002', categoria:'Genérico',
        imagen:null, lotes:[]
      },
      {
        id:'AMOX-500', sku:'AMOX-500', nombre:'Amoxicilina 500 mg',
        precio:180, costo:100,
        stockPiso:6, stockBodega:0, stockMin:2,
        caducidad:'', lote:'L-003', categoria:'Original',
        imagen:null, lotes:[]
      },
      {
        id:'CONS-001', sku:'CONS-001', nombre:'Consulta médica',
        precio:100, costo:0,
        stockPiso:999, stockBodega:0, stockMin:0,
        caducidad:'', lote:'SERV', categoria:'Servicio',
        imagen:null, lotes:[]
      },
    ];
    saveState();
    ensureLotesStructure();
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
  renderBodega();
});

// ---------------------------
