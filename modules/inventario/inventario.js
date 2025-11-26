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
      imagen: invImagenData || null,
      lotes: []
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
    if(!Array.isArray(prod.lotes)) prod.lotes = [];
    if(invImagenData!==null){
      prod.imagen = invImagenData;
    }
  }
  ensureLotesStructure();
  saveState();
  clearInvForm();
  renderInventario();
  renderCatalog(currentFilter);
  renderBodega();
  alert('Producto guardado.');
});

elBtnInvCargarDemo.addEventListener('click',()=>{
  ensureDemoInventory();
  ensureLotesStructure();
  renderInventario();
  renderCatalog(currentFilter);
  renderBodega();
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
  ensureLotesStructure();
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
        if(!Array.isArray(p.lotes)) p.lotes = [];
        // lote rápido sin datos
        p.lotes.push({
          id: 'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
          lote: 'SIN-LOTE',
          caducidad: '',
          cantidad: addBod
        });
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
