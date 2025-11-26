// BODEGA – LOTES Y CADUCIDADES
// ---------------------------
const CADUCIDAD_ALERT_DAYS = 30;
let bodegaFilter = { search:'', onlySoon:false };
let bodegaUiInitialized = false;

function getAllLotesBodega(){
  ensureLotesStructure();
  const list = [];
  state.inventario.forEach(p=>{
    const totalBod = Number(p.stockBodega || 0);
    if(Array.isArray(p.lotes) && p.lotes.length){
      p.lotes.forEach(l=>{
        list.push({
          prodId: p.id,
          sku: p.sku,
          nombre: p.nombre,
          id: l.id,
          lote: l.lote || '',
          caducidad: l.caducidad || '',
          cantidad: Number(l.cantidad || 0) || 0,
          esLegacy: false
        });
      });
    }else if(totalBod>0){
      list.push({
        prodId: p.id,
        sku: p.sku,
        nombre: p.nombre,
        id: 'legacy-'+p.id,
        lote: 'SIN-LOTE',
        caducidad: '',
        cantidad: totalBod,
        esLegacy: true
      });
    }
  });
  return list;
}

function getLoteStatus(cadStr){
  if(!cadStr){
    return {status:'sinfecha', label:'Sin fecha', bg:'#f3f4f6', fg:'#111827', icon:'•'};
  }
  const hoy = new Date();
  const cad = new Date(cadStr+'T00:00:00');
  const diffMs = cad - hoy;
  const diffD = Math.floor(diffMs/ (1000*60*60*24));
  if(diffD < 0){
    return {status:'expired', label:'Caducado', bg:'#fee2e2', fg:'#b91c1c', icon:'⛔'};
  }
  if(diffD <= CADUCIDAD_ALERT_DAYS){
    return {status:'alert', label:`Por caducar (${diffD} d)`, bg:'#fef3c7', fg:'#92400e', icon:'⚠️'};
  }
  return {status:'ok', label:`OK (${diffD} d)`, bg:'#dcfce7', fg:'#166534', icon:'✅'};
}

function recalcStockBodegaProd(prod){
  if(!Array.isArray(prod.lotes) || !prod.lotes.length){
    // si no hay lotes, stockBodega queda como está (legacy)
    return;
  }
  prod.stockBodega = prod.lotes.reduce((a,l)=>a + (Number(l.cantidad || 0)||0), 0);
}

function initBodegaUI(){
  if(bodegaUiInitialized) return;
  const pageBodega = document.getElementById('page-bodega');
  pageBodega.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-title">Bodega</div>
    <div class="card-sub">Control de lotes, caducidades y surtidos a piso.</div>

    <div class="ventas-filtros" style="margin-top:10px;">
      <input id="bodegaSearch" class="input" placeholder="🔍 Buscar por nombre o SKU">
      <button class="btn btn-soft" id="bodegaBtnVerTodo">Ver todo</button>
      <button class="btn btn-outline" id="bodegaBtnPorCaducar">Por caducar</button>
      <button class="btn btn-outline" id="bodegaBtnExportCsv">Excel</button>
      <button class="btn btn-outline" id="bodegaBtnExportPdf">PDF</button>
    </div>

    <div class="grid" style="grid-template-columns:1.1fr 1.9fr;margin-top:10px;">
      <div>
        <div class="field-label">Agregar lote a bodega</div>
        <div class="field-label" style="margin-top:6px;">Producto</div>
        <select id="bodegaProdSelect" class="select"></select>
        <div class="field-label" style="margin-top:6px;">Lote</div>
        <input id="bodegaLote" class="input">
        <div class="field-label" style="margin-top:6px;">Caducidad</div>
        <input id="bodegaCad" type="date" class="input">
        <div class="field-label" style="margin-top:6px;">Cantidad</div>
        <input id="bodegaCant" type="number" min="1" class="input">
        <button class="btn btn-primary" style="margin-top:8px;" id="bodegaBtnAgregar">Guardar lote</button>
      </div>
      <div>
        <div class="field-label">Lotes en bodega</div>
        <div style="margin-top:6px;max-height:380px;overflow:auto;">
          <table class="inv-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Lote</th>
                <th>Caducidad</th>
                <th>Cant</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="bodegaTabla"></tbody>
          </table>
        </div>
        <p id="bodegaResumen" style="font-size:12px;color:#64748b;margin-top:6px;"></p>
      </div>
    </div>
  `;
  pageBodega.appendChild(card);

  // Referencias y eventos
  const inputSearch = document.getElementById('bodegaSearch');
  const btnVerTodo = document.getElementById('bodegaBtnVerTodo');
  const btnPorCad = document.getElementById('bodegaBtnPorCaducar');
  const btnCsv = document.getElementById('bodegaBtnExportCsv');
  const btnPdf = document.getElementById('bodegaBtnExportPdf');
  const selProd = document.getElementById('bodegaProdSelect');
  const inpLote = document.getElementById('bodegaLote');
  const inpCad = document.getElementById('bodegaCad');
  const inpCant = document.getElementById('bodegaCant');
  const btnAgregar = document.getElementById('bodegaBtnAgregar');

  inputSearch.addEventListener('input',()=>{
    bodegaFilter.search = inputSearch.value;
    renderBodegaTabla();
  });
  btnVerTodo.addEventListener('click',()=>{
    bodegaFilter.onlySoon = false;
    renderBodegaTabla();
  });
  btnPorCad.addEventListener('click',()=>{
    bodegaFilter.onlySoon = true;
    renderBodegaTabla();
  });
  btnCsv.addEventListener('click',exportBodegaCsv);
  btnPdf.addEventListener('click',exportBodegaPdf);

  btnAgregar.addEventListener('click',()=>{
    const prodId = selProd.value;
    const lote = inpLote.value.trim() || 'SIN-LOTE';
    const cad = inpCad.value;
    const cant = Number(inpCant.value)||0;
    if(!prodId){alert('Selecciona un producto.');return;}
    if(cant<=0){alert('Cantidad debe ser mayor a 0.');return;}
    const prod = state.inventario.find(p=>p.id===prodId);
    if(!prod){alert('Producto no encontrado.');return;}
    if(!Array.isArray(prod.lotes)) prod.lotes = [];
    const idLote = 'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    prod.lotes.push({
      id:idLote,
      lote,
      caducidad:cad,
      cantidad:cant
    });
    prod.stockBodega = Number(prod.stockBodega||0) + cant;
    saveState();
    renderInventario();
    renderBodegaTabla();
    inpLote.value='';
    inpCad.value='';
    inpCant.value='';
    alert('Lote agregado a bodega.');
  });

  bodegaUiInitialized = true;
}

// Rellena el select de producto en bodega
function fillBodegaProductos(){
  const selProd = document.getElementById('bodegaProdSelect');
  if(!selProd) return;
  selProd.innerHTML='';
  const opt = document.createElement('option');
  opt.value='';opt.textContent='Selecciona producto';
  selProd.appendChild(opt);
  state.inventario.forEach(p=>{
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.sku} · ${p.nombre}`;
    selProd.appendChild(o);
  });
}

function surtirDesdeLote(loteId, cantidad){
  ensureLotesStructure();
  for(const p of state.inventario){
    // buscar en lotes "normales"
    if(Array.isArray(p.lotes)){
      const l = p.lotes.find(lo=>lo.id===loteId);
      if(l){
        const max = Number(l.cantidad||0);
        const qty = Math.min(cantidad, max);
        l.cantidad = max - qty;
        if(l.cantidad<=0){
          p.lotes = p.lotes.filter(lo=>lo.id!==loteId);
        }
        p.stockBodega = Math.max(0, Number(p.stockBodega||0) - qty);
        p.stockPiso = Number(p.stockPiso||0) + qty;
        saveState();
        renderInventario();
        renderBodegaTabla();
        return;
      }
    }
    // legacy
    if(('legacy-'+p.id)===loteId){
      const max = Number(p.stockBodega||0);
      const qty = Math.min(cantidad, max);
      p.stockBodega = max - qty;
      p.stockPiso = Number(p.stockPiso||0) + qty;
      saveState();
      renderInventario();
      renderBodegaTabla();
      return;
    }
  }
}

function borrarLote(loteId){
  ensureLotesStructure();
  for(const p of state.inventario){
    if(Array.isArray(p.lotes)){
      const l = p.lotes.find(lo=>lo.id===loteId);
      if(l){
        const cant = Number(l.cantidad||0);
        p.lotes = p.lotes.filter(lo=>lo.id!==loteId);
        p.stockBodega = Math.max(0, Number(p.stockBodega||0) - cant);
        saveState();
        renderInventario();
        renderBodegaTabla();
        return;
      }
    }
    if(('legacy-'+p.id)===loteId){
      if(!confirm('Este lote representa todo el stock de bodega sin lote. ¿Borrar todo ese stock?')) return;
      p.stockBodega = 0;
      saveState();
      renderInventario();
      renderBodegaTabla();
      return;
    }
  }
}

function renderBodegaTabla(){
  const tbody = document.getElementById('bodegaTabla');
  const resumen = document.getElementById('bodegaResumen');
  if(!tbody || !resumen) return;
  let lotes = getAllLotesBodega();
  const q = bodegaFilter.search.trim().toLowerCase();
  if(q){
    lotes = lotes.filter(l =>
      (l.nombre||'').toLowerCase().includes(q) ||
      (l.sku||'').toLowerCase().includes(q)
    );
  }
  // filtrar por caducidad
  if(bodegaFilter.onlySoon){
    lotes = lotes.filter(l=>{
      const info = getLoteStatus(l.caducidad);
      return info.status==='alert' || info.status==='expired';
    });
  }

  // ordenar por fecha cercana
  lotes.sort((a,b)=>{
    const ca = a.caducidad || '9999-12-31';
    const cb = b.caducidad || '9999-12-31';
    if(ca<cb) return -1;
    if(ca>cb) return 1;
    return 0;
  });

  tbody.innerHTML='';
  if(!lotes.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=7;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Sin lotes en bodega para los filtros seleccionados.';
    tr.appendChild(td);tbody.appendChild(tr);
    resumen.textContent='';
    return;
  }

  let totalPzas = 0;
  lotes.forEach(l=>{
    totalPzas += l.cantidad;
    const info = getLoteStatus(l.caducidad);
    const tr=document.createElement('tr');
    tr.style.backgroundColor = info.bg;
    tr.style.color = info.fg;

    const tdSku=document.createElement('td');tdSku.textContent=l.sku;
    const tdNom=document.createElement('td');tdNom.textContent=l.nombre;
    const tdLote=document.createElement('td');tdLote.textContent=l.lote || 'SIN-LOTE';
    const tdCad=document.createElement('td');tdCad.textContent=l.caducidad || '-';
    const tdCant=document.createElement('td');tdCant.textContent=l.cantidad;
    const tdEst=document.createElement('td');tdEst.textContent=`${info.icon} ${info.label}`;
    const tdAcc=document.createElement('td');tdAcc.style.whiteSpace='nowrap';

    const btnSurtir=document.createElement('button');
    btnSurtir.className='qty-btn';
    btnSurtir.textContent='↗';
    btnSurtir.title='Surtir a piso';
    btnSurtir.addEventListener('click',()=>{
      const max = l.cantidad;
      const resp = prompt(`¿Cuántas piezas surtir a piso? (máx ${max})`, String(max));
      const qty = Number(resp||'0');
      if(!qty || qty<=0) return;
      if(qty>max){alert('No puedes surtir más de lo que hay en el lote.');return;}
      surtirDesdeLote(l.id, qty);
    });

    const btnDel=document.createElement('button');
    btnDel.className='qty-btn';
    btnDel.style.background='#fee2e2';
    btnDel.textContent='🗑';
    btnDel.title='Borrar lote';
    btnDel.addEventListener('click',()=>{
      if(!confirm('¿Borrar este lote de bodega?')) return;
      borrarLote(l.id);
    });

    tdAcc.appendChild(btnSurtir);
    tdAcc.appendChild(btnDel);

    tr.appendChild(tdSku);
    tr.appendChild(tdNom);
    tr.appendChild(tdLote);
    tr.appendChild(tdCad);
    tr.appendChild(tdCant);
    tr.appendChild(tdEst);
    tr.appendChild(tdAcc);
    tbody.appendChild(tr);
  });

  resumen.textContent = `Lotes mostrados: ${lotes.length} · Piezas totales en bodega (en estos lotes): ${totalPzas}`;
}

function exportBodegaCsv(){
  const lotes = getAllLotesBodega();
  if(!lotes.length){
    alert('No hay lotes en bodega para exportar.');
    return;
  }
  const header = ['SKU','Nombre','Lote','Caducidad','Cantidad','Estado'];
  const rows = lotes.map(l=>{
    const info = getLoteStatus(l.caducidad);
    return [
      l.sku,
      l.nombre,
      l.lote || 'SIN-LOTE',
      l.caducidad || '',
      l.cantidad,
      info.label
    ];
  });
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
  a.download = 'bodega_lotes_farmacia_dp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportBodegaPdf(){
  const lotes = getAllLotesBodega();
  if(!lotes.length){
    alert('No hay lotes en bodega para exportar.');
    return;
  }
  let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Control de caducidades - Bodega</title>
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
<h1>Control de caducidades - ${state.config.negocio||'Farmacia DP'}</h1>
<table><thead><tr>
<th>SKU</th><th>Producto</th><th>Lote</th><th>Caducidad</th><th>Cantidad</th><th>Estado</th>
</tr></thead><tbody>`;
  lotes.forEach(l=>{
    const info = getLoteStatus(l.caducidad);
    html += `<tr>
<td>${l.sku}</td>
<td>${l.nombre}</td>
<td>${l.lote||'SIN-LOTE'}</td>
<td>${l.caducidad||''}</td>
<td>${l.cantidad}</td>
<td>${info.label}</td>
</tr>`;
  });
  html += `</tbody></table>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 600); };
<\/script>
</body></html>`;
  const w = window.open('','bodega','width=900,height=700');
  if(!w){alert('No se pudo abrir ventana para PDF.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

function renderBodega(){
  ensureLotesStructure();
  initBodegaUI();
  fillBodegaProductos();
  renderBodegaTabla();
}

  // ---------------------------
  