/* Utils / storage */
const $$ = (s)=>document.querySelector(s);
const $$$ = (s)=>document.querySelectorAll(s);
const money = (n)=> n.toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const DB = {
  read(k,def){ try{return JSON.parse(localStorage.getItem(k)) ?? def}catch{ return def } },
  write(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};

/* Seed demo */
(function seed(){
  if(!DB.read('products')){
    DB.write('products', [
      {sku:'CONS-001', nombre:'Consulta médica', etiqueta:'Servicio', precio:100, costo:0, stock:null, min:0, lotes:[], img:''},
      {sku:'7502166808119', nombre:'KETOROLACO SUBLINGUAL', etiqueta:'Genérico', precio:161, costo:120, stock:98, min:50, lotes:[{lote:'A1',pzas:98,cad:'2026-11-07'}], img:''},
      {sku:'780083149888', nombre:'PARACETAMOL CAFEINA', etiqueta:'Genérico', precio:75,  costo:40,  stock:99, min:50, lotes:[{lote:'B1',pzas:99,cad:'2026-11-07'}], img:''},
      {sku:'7501537103378', nombre:'DIFENHIDRAMINA', etiqueta:'Genérico', precio:65,  costo:30,  stock:98, min:50, lotes:[{lote:'C1',pzas:98,cad:'2026-11-07'}], img:''},
    ]);
  }
  if(!DB.read('sales')) DB.write('sales', []);
})();

/* Navegación */
const views=['dashboard','ventas','inventario','bodega','clientes','historial','reportes','config'];
$$$('nav .nav-btn').forEach(a=>{
  a.onclick=()=>{
    $$$('nav .nav-btn').forEach(b=>b.classList.remove('active'));
    a.classList.add('active');
    const id=a.getAttribute('data-go');
    views.forEach(v=> $(`#view-${v}`).classList.add('hidden'));
    $(`#view-${id}`).classList.remove('hidden');
    $$('#viewTitle').textContent=a.textContent.trim().replace(/^[^\s]+\s/,'');
    if(id==='ventas') renderVentas();
    if(id==='inventario') renderInventario();
    if(id==='historial') renderHist();
    if(id==='reportes') renderReportes();
    if(id==='dashboard') renderDashboard();
  };
});
function $(s){return document.querySelector(s)}

/* Topbar: buscador + escáner */
$('#globalSearch').addEventListener('input', ()=>{
  const q = $('#globalSearch').value.trim().toLowerCase();
  if(!$('#view-ventas').classList.contains('hidden')) filterVentas(q);
});
$('#reactivarScanner').onclick = ()=>{ $('#scanInput').value=''; $('#scanInput').focus() };
$('#scanInput').addEventListener('keydown', e=>{
  if(e.key==='Enter'){
    const code=e.target.value.trim();
    if(code){ addToCart(code); e.target.value=''; }
  }
});

/* === Ventas === */
let CART=[];
function renderVentas(){
  const products = DB.read('products',[]);
  const grid = $('#productGrid'); grid.innerHTML='';
  products.forEach(p=>{
    const sTxt = p.stock==null?'—':p.stock;
    const card = document.createElement('div');
    card.className='p-card';
    card.innerHTML=`
      <div class="p-thumb">${p.img?`<img src="${p.img}">`:'📦'}</div>
      <div class="p-name">${p.nombre}</div>
      <div class="muted">SKU: ${p.sku}</div>
      <div class="row">
        <div><strong>${money(p.precio)}</strong> <span class="muted">Stock: ${sTxt}</span></div>
        <button class="btn light" data-sku="${p.sku}">Agregar</button>
      </div>`;
    card.querySelector('button').onclick=()=>addToCart(p.sku);
    grid.appendChild(card);
  });
  renderCart();
}
function filterVentas(q){
  $$('#productGrid .p-card').forEach(c=>{
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
function addToCart(sku){
  const products=DB.read('products',[]);
  const p=products.find(x=>x.sku==sku);
  if(!p) return alert('Producto no encontrado');
  const e=CART.find(i=>i.sku==sku);
  if(e) e.cant++; else CART.push({sku:p.sku,nombre:p.nombre,precio:p.precio,cant:1});
  renderCart();
}
function renderCart(){
  const box=$('#cart'); box.innerHTML=''; let total=0;
  CART.forEach((i,idx)=>{
    total+=i.precio*i.cant;
    const row=document.createElement('div'); row.className='cart-item';
    row.innerHTML=`
      <div>${i.nombre}<div class="muted">${money(i.precio)}</div></div>
      <div class="qty"><button data-a="-">−</button><div>${i.cant}</div><button data-a="+">+</button></div>
      <div>${money(i.precio*i.cant)}</div>
      <button class="btn danger" data-del="${idx}">✕</button>`;
    row.querySelector('[data-a="+"]').onclick=()=>{i.cant++; renderCart()};
    row.querySelector('[data-a="-"]').onclick=()=>{i.cant=Math.max(1,i.cant-1); renderCart()};
    row.querySelector('[data-del]').onclick=()=>{CART.splice(idx,1); renderCart()};
    box.appendChild(row);
  });
  const d=$('#extraDesc').dataset.savedDesc;
  const m=Number($('#extraMonto').dataset.savedMonto||0);
  if(d && m>0){
    total+=m;
    const r=document.createElement('div'); r.className='cart-item';
    r.innerHTML=`<div><strong>${d.toUpperCase()}</strong></div><div></div><div>${money(m)}</div><button class="btn danger" id="delExtra">✕</button>`;
    box.appendChild(r); $('#delExtra').onclick=()=>{ delete $('#extraDesc').dataset.savedDesc; delete $('#extraMonto').dataset.savedMonto; $('#extraDesc').value=''; $('#extraMonto').value=''; renderCart(); };
  }
  $('#total').textContent=money(total);
}
$('#agregarExtra').onclick=()=>{
  const d=$('#extraDesc').value.trim(), m=Number($('#extraMonto').value||0);
  if(!d || m<=0) return alert('Captura descripción y monto válido');
  $('#extraDesc').dataset.savedDesc=d; $('#extraMonto').dataset.savedMonto=m; renderCart();
};
$('#btnVaciar').onclick=()=>{ CART=[]; delete $('#extraDesc').dataset.savedDesc; delete $('#extraMonto').dataset.savedMonto; $('#extraDesc').value=''; $('#extraMonto').value=''; $('#receta').value=''; renderCart(); };

$('#btnCobrar').onclick=()=>{
  if(CART.length===0 && !$('#extraDesc').dataset.savedDesc) return alert('Carrito vacío');
  const items = CART.map(i=>({sku:i.sku,nombre:i.nombre,precio:i.precio,cant:i.cant}));
  const extra = $('#extraDesc').dataset.savedDesc ? {desc:$('#extraDesc').dataset.savedDesc,monto:Number($('#extraMonto').dataset.savedMonto)} : null;
  const total = items.reduce((a,b)=>a+b.precio*b.cant,0) + (extra?extra.monto:0);

  const metodo=$('#metodoPago').value; const ref=$('#refPago').value.trim();
  const recetaFile = $('#receta').files[0]?.name || null;
  const folio='F-'+Math.random().toString(36).slice(2,7).toUpperCase();

  // Descontar stock (no servicios)
  const prods=DB.read('products',[]);
  items.forEach(i=>{
    const p=prods.find(x=>x.sku==i.sku);
    if(p && p.stock!=null) p.stock=Math.max(0,(p.stock||0)-i.cant);
  });
  DB.write('products',prods);

  const sales=DB.read('sales',[]);
  sales.unshift({folio,fecha:new Date().toISOString(),cliente:'Público',items,extra,total,pago:metodo,referencia:ref||null,receta:recetaFile,estado:'Activa'});
  DB.write('sales',sales);

  printTicket({folio,total,fecha:new Date(),items,extra,pago:metodo,referencia:ref||null});
  CART=[]; $('#receta').value=''; $('#refPago').value=''; delete $('#extraDesc').dataset.savedDesc; delete $('#extraMonto').dataset.savedMonto; $('#extraDesc').value=''; $('#extraMonto').value='';
  renderCart(); renderInventario(); renderHist(); renderDashboard(); renderReportes();
});
function printTicket({folio,total,fecha,items,extra,pago,referencia}){
  const L=[];
  L.push('   Farmacia DP'); L.push('   SOLIDARIDAD'); L.push('   5526234556  •  FARMACIASDP@GMAIL.COM'); L.push('');
  L.push(`Folio: ${folio}`); L.push(fecha.toLocaleString('es-MX')); L.push('--------------------------------');
  items.forEach(i=>{ L.push(i.nombre.slice(0,28)); L.push(` ${i.cant} x ${money(i.precio).padStart(8)}  ${money(i.cant*i.precio).padStart(8)}`); });
  if(extra){ L.push(extra.desc.slice(0,28)); L.push(` 1 x ${money(extra.monto).padStart(8)}  ${money(extra.monto).padStart(8)}`); }
  L.push('--------------------------------'); L.push(`Total           ${money(total)}`); L.push(`Pago: ${pago}`); if(referencia) L.push(`Ref: ${referencia}`); L.push(''); L.push('¡Gracias por su compra!');
  const w=window.open('','ticket','width=380,height=600');
  w.document.write(`<pre style="font:14px/1.25 monospace; white-space:pre-wrap">${L.join('\n')}</pre><script>window.print();setTimeout(()=>window.close(),300);</script>`); w.document.close();
}

/* === Inventario (con imágenes locales) === */
function renderInventario(){
  const tb=$('#tablaInv tbody'); tb.innerHTML='';
  const prods=DB.read('products',[]);
  prods.forEach(p=>{
    const cadprox=(p.lotes||[]).map(l=>l.cad).filter(Boolean).sort()[0]||'—';
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${p.img?`<img src="${p.img}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb">`:'📦'}</td>
      <td>${p.sku}</td><td>${p.nombre}</td><td><span class="pill">${p.etiqueta}</span></td>
      <td>${money(p.precio)}</td><td>${p.stock==null?'—':p.stock}</td><td>${p.min||0}</td>
      <td>${(p.lotes||[]).length||0}</td><td>${cadprox}</td>
      <td><button class="btn light" data-ed="${p.sku}">Editar</button> ${p.stock==null?'':`<button class="btn light" data-add="${p.sku}">+Stock</button>`} <button class="btn gray" data-del="${p.sku}">Eliminar</button></td>`;
    tr.querySelector('[data-del]').onclick=()=>{ if(confirm('Eliminar producto?')){ DB.write('products', prods.filter(x=>x.sku!==p.sku)); renderInventario(); }};
    const add=tr.querySelector('[data-add]'); if(add) add.onclick=()=> modalAddStock(p.sku);
    tr.querySelector('[data-ed]').onclick=()=> modalEditProd(p.sku);
    tb.appendChild(tr);
  });
}
$('#btnNuevoProd').onclick=()=>modalEditProd(null);

function modalEditProd(sku){
  const prods=DB.read('products',[]);
  const p= sku? prods.find(x=>x.sku==sku) : {sku:'',nombre:'',etiqueta:'Genérico',precio:0,costo:0,stock:0,min:0,lotes:[],img:''};
  const wrap=document.createElement('div');
  wrap.innerHTML=`
  <div style="position:fixed;inset:0;background:#0006;display:grid;place-items:center;z-index:50">
    <div class="card pad" style="width:min(920px,94vw)">
      <div class="section-title">${sku?'Editar':'Nuevo'} producto</div>
      <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px">
        <div>SKU <input id="fsku" class="input" value="${p.sku||''}"></div>
        <div>Nombre <input id="fnom" class="input" value="${p.nombre||''}"></div>
        <div>Etiqueta
          <select id="fetq">
            ${['Genérico','Marca','Servicio','Controlado'].map(e=>`<option ${p.etiqueta===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
        <div>Precio (venta) <input id="fpre" type="number" class="input" value="${p.precio||0}"></div>
        <div>Costo <input id="fcosto" type="number" class="input" value="${p.costo||0}"></div>
        <div>Stock mínimo <input id="fmin" type="number" class="input" value="${p.min||0}"></div>
        <div>Stock (vacío = servicio) <input id="fstock" type="number" class="input" value="${p.stock??''}" placeholder="—"></div>
        <div>Imagen (archivo local) <input id="fimg" type="file" class="file" accept="image/*"></div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn gray" id="cancel">Cancelar</button>
        <button class="btn" id="save">Guardar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#cancel').onclick=()=>wrap.remove();
  wrap.querySelector('#save').onclick=async ()=>{
    const skuV=wrap.querySelector('#fsku').value.trim(); if(!skuV) return alert('SKU requerido');
    const obj={
      sku:skuV,
      nombre:wrap.querySelector('#fnom').value.trim(),
      etiqueta:wrap.querySelector('#fetq').value,
      precio:Number(wrap.querySelector('#fpre').value||0),
      costo:Number(wrap.querySelector('#fcosto').value||0),
      min:Number(wrap.querySelector('#fmin').value||0),
      stock:(()=>{const v=wrap.querySelector('#fstock').value; return v===''?null:Number(v)})(),
      lotes:p.lotes||[],
      img:p.img||''
    };
    const file=wrap.querySelector('#fimg').files[0];
    if(file) obj.img = await readAsDataURL(file);
    const idx=prods.findIndex(x=>x.sku==skuV);
    if(idx>=0) prods[idx]=obj; else prods.push(obj);
    DB.write('products',prods); wrap.remove(); renderInventario(); renderVentas();
  };
}
function readAsDataURL(file){
  return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
}
function modalAddStock(sku){
  const prods=DB.read('products',[]); const p=prods.find(x=>x.sku==sku);
  const wrap=document.createElement('div');
  wrap.innerHTML=`
  <div style="position:fixed;inset:0;background:#0006;display:grid;place-items:center;z-index:50">
    <div class="card pad" style="width:min(560px,94vw)">
      <div class="section-title">Agregar stock (lote)</div>
      <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px">
        <div>Lote <input id="slote" class="input" placeholder="Identificador"></div>
        <div>Caducidad <input id="scad" class="input" type="date"></div>
        <div style="grid-column:1/3">Piezas <input id="spzas" class="input" type="number" placeholder="0"></div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn gray" id="cancel">Cancelar</button>
        <button class="btn" id="ok">Agregar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#cancel').onclick=()=>wrap.remove();
  wrap.querySelector('#ok').onclick=()=>{
    const lote=$('#slote').value.trim(), cad=$('#scad').value||'', pzas=Number($('#spzas').value||0);
    if(!lote || pzas<=0) return alert('Completa lote y piezas');
    p.lotes=p.lotes||[]; p.lotes.push({lote,cad,pzas}); p.stock=(p.stock||0)+pzas; DB.write('products',prods); wrap.remove(); renderInventario();
  };
}

/* Historial */
function renderHist(){
  const tb=$('#tablaHist tbody'); tb.innerHTML='';
  DB.read('sales',[]).forEach(s=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${s.folio}</td><td>${new Date(s.fecha).toLocaleString('es-MX')}</td><td>${s.cliente}</td><td>${money(s.total)}</td><td>${s.pago}</td><td>${s.receta?'📎':''}</td><td>${s.estado}</td><td><button class="btn light" data-ver="${s.folio}">Ver</button> <button class="btn danger" data-an="${s.folio}">Anular</button></td>`;
    tr.querySelector('[data-ver]').onclick=()=>showSale(s.folio);
    tr.querySelector('[data-an]').onclick=()=>cancelSale(s.folio);
    tb.appendChild(tr);
  });
}
function showSale(folio){
  const s=DB.read('sales',[]).find(x=>x.folio==folio); if(!s) return;
  const wrap=document.createElement('div');
  wrap.innerHTML=`
  <div style="position:fixed;inset:0;background:#0006;display:grid;place-items:center;z-index:50">
    <div class="card pad" style="width:min(720px,94vw)">
      <div class="section-title">Venta ${folio}</div>
      <div class="muted">${new Date(s.fecha).toLocaleString('es-MX')}</div>
      <div style="margin:10px 0">
        ${s.items.map(i=>`${i.cant}x ${i.nombre} — ${money(i.precio*i.cant)}`).join('<br>')}
        ${s.extra?('<br><strong>'+s.extra.desc+'</strong> — '+money(s.extra.monto)) : ''}
      </div>
      <div><strong>Total: ${money(s.total)}</strong></div>
      <div>Pago: ${s.pago}${s.referencia?` — Ref: ${s.referencia}`:''}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn gray" id="cerrar">Cerrar</button>
        <button class="btn" id="reimprimir">Reimprimir Ticket</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#cerrar').onclick=()=>wrap.remove();
  wrap.querySelector('#reimprimir').onclick=()=>printTicket({folio:s.folio,total:s.total,fecha:new Date(s.fecha),items:s.items,extra:s.extra,pago:s.pago,referencia:s.referencia});
}
function cancelSale(folio){
  const prods=DB.read('products',[]), sales=DB.read('sales',[]), s=sales.find(x=>x.folio==folio);
  if(!s || s.estado!=='Activa') return;
  if(!confirm('¿Anular venta y regresar stock?')) return;
  s.items.forEach(i=>{ const p=prods.find(x=>x.sku==i.sku); if(p && p.stock!=null) p.stock+=i.cant; });
  s.estado='Anulada'; DB.write('products',prods); DB.write('sales',sales); renderHist(); renderInventario(); renderReportes(); renderDashboard();
}

/* Reportes + Dashboard */
function renderReportes(){
  const sales=DB.read('sales',[]).filter(s=>s.estado==='Activa');
  const total=sales.reduce((a,b)=>a+b.total,0); const prom=sales.length? total/sales.length : 0;
  const sum={EFE:0,TAR:0,TRA:0,OTR:0}; sales.forEach(s=>{ sum[s.pago]=(sum[s.pago]||0)+s.total; });
  $('#repResumen').children[0].textContent='Total ventas: '+money(total);
  $('#repResumen').children[1].textContent='Tickets: '+sales.length;
  $('#repResumen').children[2].textContent='Ticket promedio: '+money(prom);
  const cnt={}; sales.forEach(s=>s.items.forEach(i=>{ cnt[i.nombre]=(cnt[i.nombre]||0)+i.cant; }));
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>`${e[0]} (${e[1]})`).join(', ')||'—';
  $('#repResumen').children[3].textContent='Top productos: '+top;
  $('#repMetodos').textContent=`Por método: EFE ${money(sum.EFE)} | TAR ${money(sum.TAR)} | TRA ${money(sum.TRA)} | OTR ${money(sum.OTR)}`;
}
function renderDashboard(){
  const today=new Date().toISOString().slice(0,10);
  const sales=DB.read('sales',[]).filter(s=>s.estado==='Activa' && s.fecha.slice(0,10)===today);
  const total=sales.reduce((a,b)=>a+b.total,0), items=sales.reduce((a,b)=>a+b.items.reduce((x,y)=>x+y.cant,0),0);
  $('#kpiVentas').textContent=money(total); $('#kpiTickets').textContent=sales.length; $('#kpiItems').textContent=items; $('#kpiProm').textContent=money(sales.length? total/sales.length : 0);
  const prods=DB.read('products',[]); const bajas=prods.filter(p=>p.stock!=null && p.stock<= (p.min||0)).map(p=>`${p.nombre} (${p.stock})`).join(', ');
  $('#alertStock').textContent=bajas||'(Vacío)';
  const proximas=prods.flatMap(p=>(p.lotes||[]).filter(l=>l.cad && daysTo(l.cad)<=30).map(()=>p.nombre)).slice(0,5);
  $('#alertCad').textContent=proximas.length? [...new Set(proximas)].join(', ') : '(Vacío)';
}
function daysTo(d){ const a=new Date(d), b=new Date(); return Math.ceil((a-b)/86400000); }

/* Inicial */
renderDashboard();
