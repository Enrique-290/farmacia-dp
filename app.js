/* ===== Build / SW ===== */
(function(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then(l=>l.forEach(r=>r.unregister()));
  }
  window.__DP_BUILD='dp-1.9';
  console.log('Farmacia DP build:',__DP_BUILD);
})();

/* ===== Helpers ===== */
const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(+n||0);
const todayISO=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const t=new Date(d);t.setDate(t.getDate()+n);return t;};
const uid=()=>Math.random().toString(36).slice(2,8).toUpperCase();
const ymd=(dt)=>new Date(dt).toISOString().slice(0,10);

/* ===== Persistencia ===== */
const DEFAULT_STATE={
  productos:[
    {sku:'P-001',name:'Paracetamol 500mg',etiqueta:'Genérico',price:25,cost:10,stockMin:5,img:'',batches:[{lote:'L-01',cad:'2026-01-20',piezas:10}]},
    {sku:'A-010',name:'Amoxicilina 500mg',etiqueta:'Marca',price:60,cost:25,stockMin:3,img:'',batches:[{lote:'AMX-01',cad:'2026-09-10',piezas:5}]},
    {sku:'CONS-001',name:'Consulta médica',etiqueta:'Servicio',price:100,cost:0,stockMin:0,img:'',batches:[]}
  ],
  solicitudes:[],
  // Inventario de bodega (base vacía, se llenará al implementar la sección completa)
  bodegaProductos:[],
  kardex:[], // {fecha, tipo, detalle, cant}
  ventas:[],
  clientes:[{nombre:'Público General',telefono:'',email:'',compras:0,ultima:''}],
  theme:{menu:'#0a6cff',fondo:'#f7f9fc',panel:'#ffffff',prim:'#0a6cff',text:'#111111'},
  negocio:{nombre:'Farmacia DP',dir:'',tel:'',mail:'',logo:''},
  params:{ cadDias:30, iva:0.16, preciosConIVA:true, stockCritico:5 }
};
function loadState(){
  try{
    const raw=localStorage.getItem('dp_state');
    if(!raw) return structuredClone(DEFAULT_STATE);
    const st=JSON.parse(raw);
    // Mezclar defaults por si faltan claves nuevas
    const merged={...structuredClone(DEFAULT_STATE),...st};
    merged.params={...DEFAULT_STATE.params, ...(st.params||{})};
    merged.theme={...DEFAULT_STATE.theme, ...(st.theme||{})};
    merged.negocio={...DEFAULT_STATE.negocio, ...(st.negocio||{})};
    if(!Array.isArray(merged.kardex)) merged.kardex=[];
    if(!Array.isArray(merged.bodegaProductos)) merged.bodegaProductos=[];
    return merged;
  }catch(e){ return structuredClone(DEFAULT_STATE); }
}
function saveState(){ localStorage.setItem('dp_state',JSON.stringify(state)); applyThemePreview(); applyLogo(); refreshKPIs(); renderDashboard(); }

let state=loadState();

/* ===== THEME / UI ===== */
function applyTheme(){
  document.documentElement.style.setProperty('--menu',state.theme.menu);
  document.documentElement.style.setProperty('--fondo',state.theme.fondo);
  document.documentElement.style.setProperty('--panel',state.theme.panel);
  document.documentElement.style.setProperty('--primary',state.theme.prim);
  document.documentElement.style.setProperty('--text',state.theme.text);
}
function applyThemePreview(){
  $('#tMenu')?.value=state.theme.menu; $('#tFondo')?.value=state.theme.fondo;
  $('#tPanel')?.value=state.theme.panel; $('#tPrim')?.value=state.theme.prim; $('#tText')?.value=state.theme.text;
  applyTheme();
}
function applyLogo(){
  const el=$('#brandLogo'),pv=$('#bizLogoPreview');
  if(state.negocio.logo){ el.src=state.negocio.logo; pv && (pv.src=state.negocio.logo); el.style.background='#fff'; }
  else { el.removeAttribute('src'); el.style.background='#fff'; if(pv) pv.removeAttribute('src'); }
}

/* ===== Navegación ===== */
function setActiveSection(id){
  $$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.section===id));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $('#sectionTitle').textContent=id.charAt(0).toUpperCase()+id.slice(1);
  if(id==='dashboard'){ renderDashboard(); }
  if(id==='ventas'){ renderCatalogo(); renderCart(); setTimeout(()=>$('#ventaBuscar')?.focus(),50); }
  if(id==='inventario'){ renderInvTable(); }
  if(id==='bodega'){ renderSolicitudes(); }
  if(id==='historial'){ renderHistorial(); }
  if(id==='reportes'){ renderReportes('d'); }
  if(id==='clientes'){ renderClientes(); }
}
function initLayout(){
  $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>setActiveSection(btn.dataset.section)));
  $('#btnToggle')?.addEventListener('click',()=>$('#sidebar').classList.toggle('collapsed'));
  $('#btnOpen')?.addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
}

/* ===== Inventario ===== */
const getStock=p=>(p.etiqueta==='Servicio')?'—':(p.batches||[]).reduce((s,b)=>s+Number(b.piezas||0),0);
const nextCadProxima=p=>{
  if(p.etiqueta==='Servicio') return '—';
  const futuras=(p.batches||[]).filter(b=>b.cad).map(b=>({...b,t:+new Date(b.cad)})).filter(b=>b.t>=Date.now()).sort((a,b)=>a.t-b.t);
  return futuras[0]?.cad||'—';
};

const inv={editIndex:-1, stockSku:null, imgData:null};
function renderInvTable(){
  const tbody=$('#tablaInv tbody'); if(!tbody) return;
  const txt=($('#invBuscar').value||'').toLowerCase(); const tag=$('#invEtiqueta').value||'';
  let low=0,cad=0;
  tbody.innerHTML='';
  state.productos
    .filter(p=>(!tag||p.etiqueta===tag) && (p.name.toLowerCase().includes(txt)||p.sku.toLowerCase().includes(txt)))
    .forEach((p,i)=>{
      const stock=getStock(p), prox=nextCadProxima(p);
      const isLow=(stock!=='—' && Number(stock)<=Number(p.stockMin||state.params.stockCritico)); if(isLow) low++;
      const soon=(prox!=='—' && new Date(prox)<=addDays(new Date(),state.params.cadDias)); if(soon) cad++;
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><img class="img-thumb" src="${p.img||''}" onerror="this.src='';this.style.background='#eef2ff'"></td>
        <td>${p.sku}</td><td>${p.name}</td><td><span class="tag">${p.etiqueta}</span></td>
        <td>${money(p.price)}</td><td>${stock}</td><td>${p.stockMin||0}</td>
        <td>${p.etiqueta==='Servicio'?'—':(p.batches?.length||0)}</td><td>${prox}</td>
        <td>
          <button class="btn btn-sm" data-act="edit" data-i="${i}">Editar</button>
          ${p.etiqueta!=='Servicio'?`<button class="btn btn-sm" data-act="stock" data-i="${i}">+Stock</button>`:''}
          <button class="btn btn-sm" data-act="del" data-i="${i}">Eliminar</button>
        </td>`;
      tbody.appendChild(tr);
    });
  $('#badgeStock').textContent=`Stock bajo: ${low}`;
  $('#badgeCad').textContent=`Próximas caducidades: ${cad}`;
}
function openProdDialog(i=-1){
  inv.editIndex=i; inv.imgData=null;
  const isEdit=i>-1; $('#dlgProdTitle').textContent=isEdit?'Editar producto':'Nuevo producto';
  const p=isEdit?state.productos[i]:null;
  $('#fSku').value=p?.sku||''; $('#fNombre').value=p?.name||''; $('#fEtiqueta').value=p?.etiqueta||'Genérico';
  $('#fPrecio').value=p?.price??''; $('#fCosto').value=p?.cost??''; $('#fMin').value=p?.stockMin??0;
  $('#fLote0').value=''; $('#fCad0').value=''; $('#fPzs0').value='';
  $('#fImgFile').value=''; $('#fImgPrev').src=p?.img||''; $('#fImgPrev').style.display=p?.img?'block':'none';
  $('#dlgProd').showModal();
}
function fileToDataURL(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }
function saveProd(){
  const base={
    sku:$('#fSku').value.trim().toUpperCase(),
    name:$('#fNombre').value.trim(),
    etiqueta:$('#fEtiqueta').value,
    price:+$('#fPrecio').value,
    cost:+$('#fCosto').value||0,
    stockMin:+$('#fMin').value||0,
  };
  if(!base.sku||!base.name||!base.price){ alert('SKU, Nombre y Precio obligatorios'); return; }

  let prod = (inv.editIndex>-1) ? {...state.productos[inv.editIndex]} : {batches:[]};
  Object.assign(prod, base);
  if(inv.imgData===null && inv.editIndex>-1){ /* mantener */ }
  else if(inv.imgData===undefined){ prod.img=''; } // quitar
  else { prod.img=inv.imgData||''; }

  const lote0=$('#fLote0').value.trim(), cad0=$('#fCad0').value||'', pzs0=+($('#fPzs0').value||0);
  if(prod.etiqueta!=='Servicio' && lote0 && pzs0>0){ prod.batches.push({lote:lote0,cad:cad0,piezas:pzs0}); }

  if(inv.editIndex>-1){ state.productos[inv.editIndex]=prod; } else {
    if(state.productos.some(x=>x.sku===prod.sku)) return alert('SKU ya existe');
    state.productos.push(prod);
  }
  $('#dlgProd').close(); saveState(); renderInvTable(); renderCatalogo();
}
function openStockDialog(i){ inv.stockSku=state.productos[i].sku; $('#sLote').value=''; $('#sCad').value=''; $('#sPiezas').value=''; $('#dlgStock').showModal(); }
function saveStock(){
  const lote=$('#sLote').value.trim(), cad=$('#sCad').value||'', piezas=+$('#sPiezas').value;
  if(!lote||!piezas) return alert('Lote y piezas son obligatorios');
  const p=state.productos.find(x=>x.sku===inv.stockSku); p.batches=p.batches||[]; p.batches.push({lote,cad,piezas});
  state.kardex.unshift({fecha:new Date().toISOString(), tipo:'Ingreso', detalle:`Lote ${lote} (${p.sku})`, cant:piezas});
  $('#dlgStock').close(); saveState(); renderInvTable(); renderCatalogo(); renderDashboard();
}
function deleteProd(i){ const p=state.productos[i]; if(!confirm(`Eliminar ${p.name}?`)) return; state.productos.splice(i,1); saveState(); renderInvTable(); renderCatalogo(); }

/* Import CSV inventario */
function importCSV(file){
  const r=new FileReader();
  r.onload=()=>{
    const lines=r.result.split(/\r?\n/).filter(Boolean); const out=[];
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(x=>x.trim()); if(cols.length<10) continue;
      const [sku,nombre,etiqueta,precio,costo,min,lote,cad,piezas,img]=cols;
      let prod=out.find(p=>p.sku===sku); if(!prod){ prod={sku:sku.toUpperCase(),name:nombre,etiqueta,price:+precio,cost:+costo,stockMin:+min,img:img||'',batches:[]}; out.push(prod); }
      if(etiqueta!=='Servicio'){ prod.batches.push({lote,cad,piezas:+piezas}); }
    }
    out.forEach(n=>{ const i=state.productos.findIndex(p=>p.sku===n.sku); if(i>-1) state.productos[i]=n; else state.productos.push(n); });
    saveState(); renderInvTable(); renderCatalogo(); alert(`Importados: ${out.length}`);
  };
  r.readAsText(file);
}

/* ===== Ventas ===== */
const cart={items:[],extras:[],receta:null};

function renderCatalogo(){
  const wrap=$('#catalogoProductos'); if(!wrap) return;
  const txt=($('#ventaBuscar').value||'').toLowerCase();
  wrap.innerHTML='';
  state.productos
    .filter(p=>{
      const t=(p.name+' '+p.sku+' '+p.etiqueta).toLowerCase();
      return t.includes(txt);
    })
    .forEach(p=>{
      const card=document.createElement('div'); card.className='prod-card';
      const bg = p.img ? `background-image:url('${p.img}');background-size:cover;background-position:center;` : '';
      const stockTxt = p.etiqueta==='Servicio' ? 'Stock: —' : 'Stock: '+getStock(p);
      card.innerHTML=`
        <div class="prod-img" style="${bg}"></div>
        <div class="prod-info">
          <div class="prod-name">${p.name}</div>
          <div class="prod-sku">SKU: ${p.sku}</div>
          <div class="prod-meta"><span>${money(p.price)}</span><span>${stockTxt}</span></div>
          <button class="btn add-to-cart" data-sku="${p.sku}" data-name="${p.name}" data-price="${p.price}">Agregar</button>
        </div>`;
      wrap.appendChild(card);
    });
  $$('.add-to-cart',wrap).forEach(b=>b.addEventListener('click',()=>addItem(b.dataset.sku,b.dataset.name,b.dataset.price)));
}
function renderCart(){
  const list=$('#carritoLista'); if(!list) return;
  list.innerHTML='';
  let total=0;
  if(cart.items.length===0) list.innerHTML='<li>(Vacío)</li>';
  cart.items.forEach(p=>{
    total+=p.price*p.qty;
    const li=document.createElement('li');
    li.innerHTML=`${p.name} — ${money(p.price)} x ${p.qty}`;
    const del=document.createElement('button'); del.className='btn'; del.textContent='✕';
    del.onclick=()=>{removeItem(p.sku)};
    li.appendChild(del);
    list.appendChild(li);
  });
  const exList=$('#extrasLista'); exList.innerHTML='';
  cart.extras.forEach((e,i)=>{ total+=e.amount; const li=document.createElement('li'); li.innerHTML=`${e.desc} — ${money(e.amount)}`; const del=document.createElement('button'); del.className='btn'; del.textContent='✕'; del.onclick=()=>{cart.extras.splice(i,1); renderCart();}; li.appendChild(del); exList.appendChild(li); });
  $('#total').textContent=money(total);
}
function addItem(sku,name,price){ const f=cart.items.find(p=>p.sku===sku); if(f) f.qty++; else cart.items.push({sku,name,price:+price,qty:1}); renderCart(); }
function removeItem(sku){ const i=cart.items.findIndex(p=>p.sku===sku); if(i>-1){ cart.items.splice(i,1); renderCart(); } }
function clearCart(){ cart.items.length=0; cart.extras.length=0; cart.receta=null; $('#recetaFile').value=''; $('#recetaPreview').style.display='none'; renderCart(); }

/* SKU rápido desde buscador superior (Enter = agregar si coincide exacto) */
function setupSkuRapido(){
  const search=$('#ventaBuscar');
  search?.addEventListener('keydown',e=>{
    if(e.key!=='Enter') return;
    const v=(search.value||'').trim().toUpperCase();
    if(!v) return;
    const p=state.productos.find(x=>x.sku===v);
    if(p){ addItem(p.sku,p.name,p.price); search.select(); e.preventDefault(); }
  });
}

/* ===== Ticket 58mm ===== */
function buildTicketHTML(v){
  const biz=state.negocio||{};
  const logo = biz.logo ? `<img src="${biz.logo}" alt="logo"/>` : '';
  let itemsHTML='';
  v.items.forEach(i=>{
    itemsHTML += `
      <div>${i.name}</div>
      <div class="row"><span class="t-small">${i.qty} x ${money(i.price)}</span><span class="t-small t-bold">${money(i.qty*i.price)}</span></div>
    `;
  });
  if(v.extras?.length){
    itemsHTML += `<hr/><div class="t-bold">Extras</div>`;
    v.extras.forEach(e=>{
      itemsHTML += `<div class="row"><span class="t-small">${e.desc}</span><span class="t-small t-bold">${money(e.amount)}</span></div>`;
    });
  }
  return `
  <div class="ticket">
    ${logo}
    <div class="t-center t-bold">${biz.nombre||'Farmacia'}</div>
    <div class="t-center t-small">${biz.dir||''}</div>
    <div class="t-center t-small">${biz.tel||''}${biz.mail?(' · '+biz.mail):''}</div>
    <hr/>
    <div>Folio: ${v.folio}</div>
    <div class="t-small">${new Date(v.fecha).toLocaleString('es-MX')}</div>
    <hr/>
    ${itemsHTML}
    <hr/>
    <div class="row"><span class="t-bold">Total</span><span class="t-bold">${money(v.total)}</span></div>
    <div class="t-small">Pago: ${v.pago||'EFE'}</div>
    <hr/>
    <div class="t-center t-small">¡Gracias por su compra!</div>
  </div>`;
}
function openTicketDialog(v){
  $('#ticketPreview').innerHTML = buildTicketHTML(v);
  $('#dlgTicket').showModal();
}
function printCurrentTicket(){
  const html = `
  <html><head>
    <meta charset="utf-8"/>
    <title>Ticket</title>
    <style>
      @page{ size:58mm auto; margin:0 }
      body{ margin:0; }
      .ticket{width:58mm; background:#fff; color:#000; padding:8px; font:12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace}
      .t-center{text-align:center} .t-small{font-size:11px} .t-bold{font-weight:700}
      hr{border:0;border-top:1px dashed #999;margin:6px 0}
      .row{display:flex;justify-content:space-between;gap:8px}
      img{max-width:48mm;max-height:24mm;object-fit:contain;margin:0 auto 6px auto;display:block}
    </style>
  </head><body>${$('#ticketPreview').innerHTML}</body></html>`;
  const w=window.open('','_blank','width=400,height=600');
  w.document.open(); w.document.write(html); w.document.close();
  w.focus(); w.print();
}

/* ===== Cobro / KPIs ===== */
function cobrar(){
  if(cart.items.length===0 && cart.extras.length===0) return alert('Carrito vacío');

  // Afectar stock (no servicios)
  cart.items.forEach(item=>{
    const p=state.productos.find(x=>x.sku===item.sku);
    if(!p || p.etiqueta==='Servicio') return;
    let qty=item.qty;
    (p.batches||[]).sort((a,b)=>new Date(a.cad)-new Date(b.cad)); // FEFO
    for(const b of p.batches){
      const take=Math.min(qty,b.piezas); b.piezas-=take; qty-=take; if(qty<=0) break;
    }
    p.batches=p.batches.filter(b=>b.piezas>0);
  });

  const folio='F-'+uid();
  const total=parseFloat($('#total').textContent.replace(/[^0-9.]/g,''))||0;
  const venta={
    folio, fecha:new Date().toISOString(), cliente:'Público',
    items:structuredClone(cart.items), extras:structuredClone(cart.extras),
    total, pago:'EFE', receta:cart.receta?cart.receta.name||cart.receta.fileName:null, estado:'Activa'
  };
  state.ventas.unshift(venta);
  state.kardex.unshift({fecha:venta.fecha, tipo:'Venta', detalle:`${venta.folio}`, cant:venta.items.reduce((a,b)=>a+b.qty,0)});

  const cg=state.clientes.find(c=>c.nombre==='Público General'); if(cg){ cg.compras++; cg.ultima=todayISO(); }

  saveState();
  openTicketDialog(venta);
  clearCart(); renderInvTable(); renderHistorial(); renderReportes('d'); refreshKPIs(); renderDashboard();
}

function refreshKPIs(){
  const hoy=todayISO();
  const ventasHoy=state.ventas.filter(v=>v.fecha.slice(0,10)===hoy);
  const total=ventasHoy.reduce((s,v)=>s+v.total,0);
  const prodVend=ventasHoy.reduce((s,v)=>s+v.items.reduce((a,b)=>a+b.qty,0),0);
  const tickets=ventasHoy.length;

  $('#kpiVentasHoy')?.textContent=money(total);
  $('#kpiTicketsHoy')?.textContent=tickets;
  $('#kpiProdVend')?.textContent=prodVend; // (solo si existe en alguna vista)
  $('#kpiTicketProm')?.textContent=money(tickets?total/tickets:0);

  // IVA hoy
  const ivaRate=state.params?.iva??0.16;
  const preciosConIVA=state.params?.preciosConIVA??true;
  const baseHoy=ventasHoy.reduce((s,v)=>s+v.total,0);
  const ivaHoy=preciosConIVA? baseHoy*(ivaRate/(1+ivaRate)) : baseHoy*ivaRate;
  $('#kpiIvaHoy')?.textContent=money(ivaHoy);

  // Ventas del mes
  const now=new Date(); const ym=now.toISOString().slice(0,7);
  const ventasMes=state.ventas.filter(v=>v.fecha.slice(0,7)===ym).reduce((s,v)=>s+v.total,0);
  $('#kpiVentasMes')?.textContent=money(ventasMes);

  // Top producto/servicio hoy
  const map=new Map(), mapServ=new Map();
  ventasHoy.forEach(v=>v.items.forEach(i=>{
    const p=state.productos.find(x=>x.sku===i.sku);
    if(!p || p.etiqueta==='Servicio') mapServ.set(i.name,(mapServ.get(i.name)||0)+i.qty);
    else map.set(i.name,(map.get(i.name)||0)+i.qty);
  }));
  const topP=[...map.entries()].sort((a,b)=>b[1]-a[1])[0];
  const topS=[...mapServ.entries()].sort((a,b)=>b[1]-a[1])[0];
  const topTxt=(topP?`Prod: ${topP[0]} (${topP[1]})`:'Prod: —')+' | '+(topS?`Serv: ${topS[0]} (${topS[1]})`:'Serv: —');
  $('#kpiTopHoy')?.textContent=topTxt;
}

/* ===== Historial ===== */
function renderHistorial(){
  const tbody=$('#tablaHistorial tbody'); if(!tbody) return; tbody.innerHTML='';
  const d=$('#fhDesde').value||'0000-01-01', h=$('#fhHasta').value||'9999-12-31';
  state.ventas.filter(v=>v.fecha.slice(0,10)>=d && v.fecha.slice(0,10)<=h)
    .forEach(v=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${v.folio}</td><td>${v.fecha.replace('T',' ').slice(0,16)}</td><td>${v.cliente}</td>
        <td>${money(v.total)}</td><td>${v.pago}</td>
        <td>${v.receta? '📎' : '—'}</td>
        <td>${v.estado}</td>
        <td>
          <button class="btn btn-sm" data-act="ticket" data-f="${v.folio}">Ticket</button>
          ${v.estado==='Activa'?`<button class="btn btn-sm" data-act="anular" data-f="${v.folio}">Anular</button>`:''}
        </td>`;
      tbody.appendChild(tr);
    });
}
function anularVenta(folio){
  const v=state.ventas.find(x=>x.folio===folio); if(!v||v.estado!=='Activa') return;
  v.items.forEach(item=>{
    const p=state.productos.find(x=>x.sku===item.sku);
    if(!p||p.etiqueta==='Servicio') return;
    p.batches=p.batches||[]; p.batches.push({lote:'DEV-'+folio,cad:'',piezas:item.qty});
  });
  v.estado='Anulada';
  state.kardex.unshift({fecha:new Date().toISOString(), tipo:'Anulación', detalle:`${folio}`, cant:v.items.reduce((a,b)=>a+b.qty,0)});
  saveState(); renderInvTable(); renderHistorial(); renderReportes('d'); refreshKPIs(); renderDashboard();
}

/* ===== Reportes ===== */
let repTab='d';
function renderReportes(tab){
  if(tab) repTab=tab;
  $$('.tab', $('#reportes')).forEach(t=>t.classList.toggle('active', t.dataset.tab===repTab));
  const hoy=new Date();
  let desde,hasta;
  if(repTab==='d'){ desde=todayISO(); hasta=todayISO(); }
  else if(repTab==='s'){ const wd=hoy.getDay()||7; const start=new Date(hoy); start.setDate(hoy.getDate()-(wd-1)); desde=start.toISOString().slice(0,10); hasta=addDays(start,6).toISOString().slice(0,10); }
  else { desde='0000-01-01'; hasta='9999-12-31'; }
  const set=state.ventas.filter(v=>v.fecha.slice(0,10)>=desde && v.fecha.slice(0,10)<=hasta);
  const total=set.reduce((s,v)=>s+v.total,0);
  const tickets=set.length; const tp=tickets?total/tickets:0;
  const map=new Map(); set.forEach(v=>v.items.forEach(i=>map.set(i.name,(map.get(i.name)||0)+i.qty)));
  const top=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q])=>`${n} (${q})`).join(', ')||'—';
  $('#repResumen').textContent=`Periodo ${desde} a ${hasta} — Total: ${money(total)} | Tickets: ${tickets} | Ticket prom.: ${money(tp)} | Top: ${top}`;
}

/* ===== Clientes ===== */
function renderClientes(){
  const txt=($('#buscarCliente').value||'').toLowerCase();
  const tbody=$('#tablaClientes tbody'); if(!tbody) return; tbody.innerHTML='';
  state.clientes.filter(c=>c.nombre.toLowerCase().includes(txt))
    .forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${c.nombre}</td><td>${c.telefono||'—'}</td><td>${c.email||'—'}</td><td>${c.compras||0}</td><td>${c.ultima||'—'}</td>`;
      tbody.appendChild(tr);
    });
}
function nuevoCliente(){
  const nombre=prompt('Nombre del cliente'); if(!nombre) return;
  const telefono=prompt('Teléfono')||''; const email=prompt('Email')||'';
  state.clientes.push({nombre,telefono,email,compras:0,ultima:''}); saveState(); renderClientes();
}
function importClientesCSV(file){
  const r=new FileReader(); r.onload=()=>{
    const lines=r.result.split(/\r?\n/).filter(Boolean); let n=0;
    for(let i=1;i<lines.length;i++){ const [nombre,tel,email]=lines[i].split(','); if(!nombre) continue; state.clientes.push({nombre,telefono:tel||'',email:email||'',compras:0,ultima:''}); n++; }
    saveState(); renderClientes(); alert(`Clientes importados: ${n}`);
  }; r.readAsText(file);
}

/* ===== Bodega (placeholder funcional existente) ===== */
function renderSolicitudes(){
  const tbody=$('#tblSolicitudes tbody'); if(!tbody) return; tbody.innerHTML='';
  state.solicitudes.forEach(s=>{
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.folio}</td><td>${s.sku}</td><td>${s.piezas}</td><td>${s.estado}</td>`; tbody.appendChild(tr);
  });
  $('#recepcionPanel').textContent='(Selecciona una solicitud)';
  $$('#tblSolicitudes tbody tr').forEach((tr,i)=> tr.addEventListener('click',()=>openRecepcion(state.solicitudes[i])));
}
function openRecepcion(sol){
  const p=state.productos.find(x=>x.sku===sol.sku); const wrap=$('#recepcionPanel');
  wrap.innerHTML=`<p><strong>Solicitud:</strong> ${sol.folio} — SKU ${sol.sku} (${p?.name||'—'}) — Piezas solicitadas: ${sol.piezas}</p>
    <button id="recAceptar" class="btn primary">Aceptar</button>
    <button id="recParcial" class="btn">Parcial</button>
    <button id="recRech" class="btn">Rechazar</button>`;
  $('#recAceptar').onclick=()=>{ moverAInventario(sol,sol.piezas); sol.estado='Aceptada'; saveState(); renderSolicitudes(); renderInvTable(); renderDashboard(); };
  $('#recParcial').onclick=()=>{ const n=+prompt('Piezas a recibir',sol.piezas)||0; if(n<=0) return; moverAInventario(sol,n); sol.estado='Parcial '+n+'/'+sol.piezas; saveState(); renderSolicitudes(); renderInvTable(); renderDashboard(); };
  $('#recRech').onclick=()=>{ sol.estado='Rechazada'; saveState(); renderSolicitudes(); renderDashboard(); };
}
function moverAInventario(sol,n){
  const p=state.productos.find(x=>x.sku===sol.sku); if(!p||p.etiqueta==='Servicio') return;
  p.batches=p.batches||[]; p.batches.push({lote:'BOD-'+sol.folio,cad:'',piezas:n});
  state.kardex.unshift({fecha:new Date().toISOString(), tipo:'Surtido', detalle:`Bodega → Piso (${p.sku})`, cant:n});
}

/* ===== Config ===== */
function bindTabs(scope){
  scope=scope||document;
  $$('.tab',scope).forEach(t=>t.addEventListener('click',()=>{
    const v=t.dataset.tab;
    $$('.tab',scope).forEach(x=>x.classList.toggle('active',x===t));
    $$('.tabview',scope.parentElement).forEach(p=>p.classList.toggle('active',p.dataset.tab===v));
  }));
}
function initConfig(){
  bindTabs($('#config'));
  // tema
  $('#btnGuardarTema').onclick=()=>{
    state.theme.menu=$('#tMenu').value; state.theme.fondo=$('#tFondo').value;
    state.theme.panel=$('#tPanel').value; state.theme.prim=$('#tPrim').value; state.theme.text=$('#tText').value;
    saveState();
  };
  $('#btnResetTema').onclick=()=>{ state.theme=structuredClone(DEFAULT_STATE.theme); saveState(); };
  // negocio
  $('#bizNombre').value=state.negocio.nombre; $('#bizDir').value=state.negocio.dir; $('#bizTel').value=state.negocio.tel; $('#bizMail').value=state.negocio.mail;
  $('#btnGuardarBiz').onclick=()=>{ state.negocio.nombre=$('#bizNombre').value; state.negocio.dir=$('#bizDir').value; state.negocio.tel=$('#bizTel').value; state.negocio.mail=$('#bizMail').value; saveState(); };
  $('#bizLogo').onchange=e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const fr=new FileReader(); fr.onload=()=>{ state.negocio.logo=fr.result; saveState(); };
    fr.readAsDataURL(f);
  };
  // respaldos
  $('#btnExportarJSON').onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`respaldo-farmacia-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#fileImportJSON').onchange=e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const fr=new FileReader(); fr.onload=()=>{ try{ state=JSON.parse(fr.result); saveState(); alert('Respaldo importado'); location.reload(); }catch(err){ alert('Archivo inválido'); } };
    fr.readAsText(f);
  };
}

/* ===== Eventos UI ===== */
function initInventarioUI(){
  $('#btnNuevoProd').onclick=()=>openProdDialog(-1);
  $('#btnGuardarProd').onclick=e=>{ e.preventDefault(); saveProd(); };
  $('#btnCancelProd').onclick=()=>$('#dlgProd').close();
  $('#btnGuardarStock').onclick=e=>{ e.preventDefault(); saveStock(); };
  $('#btnCancelStock').onclick=()=>$('#dlgStock').close();
  $('#invBuscar').oninput=renderInvTable;
  $('#invEtiqueta').onchange=renderInvTable;
  $('#fileImport').onchange=e=>{ if(e.target.files?.[0]) importCSV(e.target.files[0]); e.target.value=''; };
  // tabla
  $('#tablaInv').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-act]'); if(!btn) return;
    const act=btn.dataset.act, i=+btn.dataset.i;
    if(act==='edit') openProdDialog(i);
    if(act==='stock') openStockDialog(i);
    if(act==='del') deleteProd(i);
  });
  // imagen local
  $('#fImgFile').onchange=async (e)=>{
    const f=e.target.files?.[0]; if(!f){ inv.imgData=null; $('#fImgPrev').style.display='none'; return; }
    inv.imgData = await fileToDataURL(f);
    $('#fImgPrev').src=inv.imgData; $('#fImgPrev').style.display='block';
  };
  $('#fImgQuitar').onclick=()=>{ inv.imgData=undefined; $('#fImgFile').value=''; $('#fImgPrev').style.display='none'; };
}
function initVentasUI(){
  $('#ventaBuscar').oninput=renderCatalogo;
  setupSkuRapido();

  // Escáner dedicado
  const scan=$('#barcodeInput'); const focusScan=()=>{ scan.focus(); scan.select?.(); };
  $('#reactivarScanner').onclick=focusScan;
  scan.onkeydown=e=>{ if(e.key!=='Enter') return; const code=(scan.value||'').trim().toUpperCase(); scan.value=''; const p=state.productos.find(x=>x.sku===code); if(p) addItem(p.sku,p.name,p.price); else alert(`SKU no encontrado: ${code}`); };

  $('#btnAgregarExtra').onclick=()=>{ const d=$('#extraDesc').value.trim(); const m=parseFloat($('#extraMonto').value); if(!d||isNaN(m)) return; cart.extras.push({desc:d,amount:+m}); $('#extraDesc').value=''; $('#extraMonto').value=''; renderCart(); };
  $('#recetaFile').onchange=e=>{ const f=e.target.files?.[0]; const prev=$('#recetaPreview'); if(!f){ cart.receta=null; prev.style.display='none'; return; } cart.receta=f; if(f.type.startsWith('image/')){ const fr=new FileReader(); fr.onload=()=>{ prev.src=fr.result; prev.style.display='block'; }; fr.readAsDataURL(f); } else prev.style.display='none'; };
  $('#btnVaciar').onclick=clearCart;
  $('#btnCobrar').onclick=cobrar;
  $('#btnCarritoMovil').onclick=()=>$('#carritoPanel').classList.toggle('open');
}
function initClientesUI(){
  $('#btnNuevoCliente').onclick=nuevoCliente;
  $('#buscarCliente').oninput=renderClientes;
  $('#fileImportClientes').onchange=e=>{ if(e.target.files?.[0]) importClientesCSV(e.target.files[0]); e.target.value=''; };
}
function initHistorialUI(){
  $('#btnFiltrarHist').onclick=renderHistorial;
  $('#btnExportHist').onclick=()=>{
    const rows=[['folio','fecha','cliente','total','pago','estado']];
    state.ventas.forEach(v=>rows.push([v.folio,v.fecha,v.cliente,v.total,v.pago,v.estado]));
    const csv=rows.map(r=>r.join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='historial.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#tablaHistorial').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-act]'); if(!btn) return;
    const act=btn.dataset.act, folio=btn.dataset.f;
    if(act==='ticket'){ const v=state.ventas.find(x=>x.folio===folio); if(v) openTicketDialog(v); }
    if(act==='anular'){ if(confirm('¿Anular venta?')) anularVenta(folio); }
  });
}
function initReportesUI(){
  bindTabs($('#reportes'));
  $('#btnExportRep').onclick=()=>{
    const rows=[['fecha','folio','total']];
    state.ventas.forEach(v=>rows.push([v.fecha,v.folio,v.total]));
    const csv=rows.map(r=>r.join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='reportes.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
}

/* ===== DASHBOARD ===== */
function dashboardCounts(){
  // Alertas
  const cadDias=state.params?.cadDias??30;
  let pend=0, parc=0, bajo=0, crit=0, cadProx=0, cadVenc=0, sinPisoConBod=0;

  const today=new Date();
  const piso=state.productos.filter(p=>p.etiqueta!=='Servicio');
  piso.forEach(p=>{
    const stock=+getStock(p);
    if(stock<=+(p.stockMin||state.params.stockCritico)) bajo++;
    if(stock<=5) crit++;
    (p.batches||[]).forEach(b=>{
      if(!b.cad) return;
      const dt=new Date(b.cad);
      const diff=(dt - today)/(1000*3600*24);
      if(diff<=cadDias && diff>=0) cadProx++;
      if(diff<0) cadVenc++;
    });
  });

  // Bodega (si hay) para “sin piso con bodega”
  (state.bodegaProductos||[]).forEach(bp=>{
    const pisoProd=state.productos.find(x=>x.sku===bp.sku);
    const stockPiso= pisoProd ? +getStock(pisoProd) : 0;
    const stockBod=(bp.batches||[]).reduce((s,b)=>s+Number(b.piezas||0),0);
    if(stockPiso===0 && stockBod>0) sinPisoConBod++;
  });

  (state.solicitudes||[]).forEach(s=>{ if((s.estado||'Pendiente').startsWith('Pendiente')) pend++; if((s.estado||'').startsWith('Parcial')) parc++; });

  return {pend, parc, bajo, crit, cadProx, cadVenc, sinPisoConBod};
}

function renderDashboard(){
  // Alertas
  const c=dashboardCounts();
  $('#alSolPend')?.textContent=`Solicitudes Pendientes: ${c.pend}`;
  $('#alSolParc')?.textContent=`Solicitudes Parciales: ${c.parc}`;
  $('#alStockBajo')?.textContent=`Stock bajo: ${c.bajo}`;
  $('#alStockCritico')?.textContent=`Stock crítico (=5): ${c.crit}`;
  $('#alCadProx')?.textContent=`Próx. a caducar (≤${state.params.cadDias}d): ${c.cadProx}`;
  $('#alCadVenc')?.textContent=`Caducados: ${c.cadVenc}`;
  $('#alSinPisoConBod')?.textContent=`Sin piso con bodega: ${c.sinPisoConBod}`;

  // Accesos rápidos
  $$('.quick-actions .btn').forEach(b=>{
    const goto=b.dataset.goto;
    if(goto) b.onclick=()=>setActiveSection(goto);
  });
  $('[data-act="nuevoCliente"]')?.addEventListener('click',nuevoCliente);
  $('[data-act="surtir"]')?.addEventListener('click',()=>setActiveSection('bodega'));
  $('[data-act="nuevaSol"]')?.addEventListener('click',()=>setActiveSection('bodega'));

  // Gráfica 7 días (barras)
  const svg=$('#ch7d'); if(svg){
    const days=[...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d; });
    const totals=days.map(d=>state.ventas.filter(v=>ymd(v.fecha)===ymd(d)).reduce((s,v)=>s+v.total,0));
    drawBars(svg, days.map(d=>d.toLocaleDateString('es-MX',{weekday:'short'})), totals);
  }

  // Donut pagos hoy
  const pagos=countPagosHoy(); drawDonut($('#chDonutPago'), $('#legDonutPago'), pagos);

  // Surtidos (solicitado vs atendido) – base con solicitudes (placeholder)
  const svgS=$('#chSurtidos');
  if(svgS){
    const days=[...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d; });
    const sol=days.map(d=>state.solicitudes.filter(s=>ymd(s.fecha||s.folio?.slice(2,12)||new Date())===ymd(d)).reduce(a=>a+1,0));
    const at=days.map(d=>state.kardex.filter(k=>k.tipo==='Surtido' && ymd(k.fecha)===ymd(d)).reduce((s,k)=>s+k.cant,0));
    drawBars(svgS, days.map(d=>d.toLocaleDateString('es-MX',{weekday:'short'})), sol, at, ['Solicitado','Atendido']);
  }

  // Últimas 10 ventas
  const tb=$('#tblUltimas tbody'); if(tb){ tb.innerHTML=''; state.ventas.slice(0,10).forEach(v=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${v.fecha.replace('T',' ').slice(0,16)}</td><td>${money(v.total)}</td><td>${v.pago}</td>
      <td><button class="btn btn-sm" data-f="${v.folio}">Reimprimir</button></td>`;
    tb.appendChild(tr);
  });
  $$('#tblUltimas tbody .btn').forEach(b=>b.onclick=()=>{ const v=state.ventas.find(x=>x.folio===b.dataset.f); if(v) openTicketDialog(v); }); }

  // Kardex reciente
  const tk=$('#tblKardex tbody'); if(tk){ tk.innerHTML=''; state.kardex.slice(0,10).forEach(k=>{
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${k.fecha.replace('T',' ').slice(0,16)}</td><td>${k.tipo}</td><td>${k.detalle}</td><td>${k.cant}</td>`; tk.appendChild(tr);
  }); }
}

function countPagosHoy(){
  const hoy=todayISO();
  const m={EFE:0,TAR:0,TRF:0,MIX:0};
  state.ventas.filter(v=>v.fecha.slice(0,10)===hoy).forEach(v=>{ m[v.pago||'EFE']+=(v.total||0); });
  return m;
}

/* ===== Dibujadores simples (SVG sin librerías) ===== */
function drawBars(svg, labels, serieA, serieB=null, legendNames=['Serie A','Serie B']){
  const W=600,H=220,PL=38,PR=10,PB=28,PT=10;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  const maxVal=Math.max(1, ...(serieB?serieA.map((v,i)=>Math.max(v,serieB[i])):serieA));
  const n=labels.length; const bw=(W-PL-PR)/n*0.6; const gap=((W-PL-PR)/n - bw);
  const baseY=H-PB;

  // Ejes
  const axis=document.createElementNS('http://www.w3.org/2000/svg','line');
  axis.setAttribute('x1',PL); axis.setAttribute('y1',baseY);
  axis.setAttribute('x2',W-PR); axis.setAttribute('y2',baseY);
  axis.setAttribute('stroke','#cbd5e1'); svg.appendChild(axis);

  labels.forEach((lb,i)=>{
    const x=PL + i*(bw+gap) + gap/2;
    // barra A
    const hA = (serieA[i]/maxVal)*(H-PB-PT);
    const rA=document.createElementNS('http://www.w3.org/2000/svg','rect');
    rA.setAttribute('x',x); rA.setAttribute('y',baseY-hA); rA.setAttribute('width',bw); rA.setAttribute('height',hA); rA.setAttribute('fill','var(--primary)');
    svg.appendChild(rA);

    if(serieB){
      const hB=(serieB[i]/maxVal)*(H-PB-PT);
      const rB=document.createElementNS('http://www.w3.org/2000/svg','rect');
      rB.setAttribute('x',x+bw+2); rB.setAttribute('y',baseY-hB); rB.setAttribute('width',bw); rB.setAttribute('height',hB); rB.setAttribute('fill','#a3bffa');
      svg.appendChild(rB);
    }
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x + (serieB?(bw):bw/2)); t.setAttribute('y',H-8); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','10'); t.textContent=lb;
    svg.appendChild(t);
  });
}
function drawDonut(svg, legendWrap, dataMap){
  if(!svg||!legendWrap) return;
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  legendWrap.innerHTML='';

  const colors={EFE:'#60a5fa',TAR:'#34d399',TRF:'#fbbf24',MIX:'#f472b6'};
  const total=Object.values(dataMap).reduce((a,b)=>a+b,0)||1;
  const C=60, R=45, ST=14;
  let angle=0;
  Object.entries(dataMap).forEach(([key,val])=>{
    const frac=val/total, a0=angle, a1=angle + frac*2*Math.PI; angle=a1;
    // arco
    const large=((a1-a0)>Math.PI)?1:0;
    const p0=[C+R*Math.cos(a0), C+R*Math.sin(a0)];
    const p1=[C+R*Math.cos(a1), C+R*Math.sin(a1)];
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M ${p0[0]} ${p0[1]} A ${R} ${R} 0 ${large} 1 ${p1[0]} ${p1[1]}`);
    path.setAttribute('fill','none'); path.setAttribute('stroke',colors[key]||'#ccc'); path.setAttribute('stroke-width',ST);
    svg.appendChild(path);

    // leyenda
    const row=document.createElement('div'); row.className='row';
    const sw=document.createElement('span'); sw.className='swatch'; sw.style.background=colors[key]||'#ccc';
    const tx=document.createElement('span'); tx.textContent=`${key}: ${money(val)}`;
    row.appendChild(sw); row.appendChild(tx); legendWrap.appendChild(row);
  });

  const center=document.createElementNS('http://www.w3.org/2000/svg','text');
  center.setAttribute('x',C); center.setAttribute('y',C+4); center.setAttribute('text-anchor','middle'); center.setAttribute('font-size','10');
  center.textContent='Hoy'; svg.appendChild(center);
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded',()=>{
  initLayout(); applyThemePreview(); applyLogo(); refreshKPIs();

  // Dashboard
  renderDashboard();

  // Módulos existentes
  initInventarioUI(); renderInvTable();
  initVentasUI(); renderCatalogo(); renderCart();
  initHistorialUI(); renderHistorial();
  initReportesUI(); renderReportes('d');
  initClientesUI(); renderClientes();

  // Ticket dialog buttons
  $('#btnPrintTicket').onclick=printCurrentTicket;
  $('#btnCloseTicket').onclick=()=>$('#dlgTicket').close();
});
