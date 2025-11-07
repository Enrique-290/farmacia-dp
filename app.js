/* ===== Build / SW ===== */
(function(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then(l=>l.forEach(r=>r.unregister()));
  }
  window.__DP_BUILD='dp-1.6';
  console.log('Farmacia DP build:',__DP_BUILD);
})();

/* ===== Helpers ===== */
const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(+n||0);
const todayISO=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const t=new Date(d);t.setDate(t.getDate()+n);return t;};
const uid=()=>Math.random().toString(36).slice(2,8).toUpperCase();

/* ===== Persistencia ===== */
const DEFAULT_STATE={
  productos:[
    {sku:'P-001',name:'Paracetamol 500mg',etiqueta:'Genérico',price:25,cost:10,stockMin:5,img:'',batches:[{lote:'L-01',cad:'2026-01-20',piezas:10}]},
    {sku:'A-010',name:'Amoxicilina 500mg',etiqueta:'Marca',price:60,cost:25,stockMin:3,img:'',batches:[{lote:'AMX-01',cad:'2026-09-10',piezas:5}]},
    {sku:'CONS-001',name:'Consulta médica',etiqueta:'Servicio',price:100,cost:0,stockMin:0,img:'',batches:[]}
  ],
  solicitudes:[], // bodega
  ventas:[], // historial
  clientes:[{nombre:'Público General',telefono:'',email:'',compras:0,ultima:''}],
  theme:{menu:'#0a6cff',fondo:'#f7f9fc',panel:'#ffffff',prim:'#0a6cff',text:'#111111'},
  negocio:{nombre:'Farmacia DP',dir:'',tel:'',mail:'',logo:''}
};
function loadState(){
  try{
    const raw=localStorage.getItem('dp_state');
    if(!raw) return structuredClone(DEFAULT_STATE);
    const st=JSON.parse(raw);
    return {...structuredClone(DEFAULT_STATE),...st};
  }catch(e){ return structuredClone(DEFAULT_STATE); }
}
function saveState(){ localStorage.setItem('dp_state',JSON.stringify(state)); applyThemePreview(); applyLogo(); refreshKPIs(); }

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
  $('#tMenu').value=state.theme.menu; $('#tFondo').value=state.theme.fondo;
  $('#tPanel').value=state.theme.panel; $('#tPrim').value=state.theme.prim; $('#tText').value=state.theme.text;
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
  if(id==='ventas'){ renderCatalogo(); renderCart(); }
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

const inv={editIndex:-1, stockSku:null};
function renderInvTable(){
  const tbody=$('#tablaInv tbody'); const txt=($('#invBuscar').value||'').toLowerCase(); const tag=$('#invEtiqueta').value||'';
  let low=0,cad=0;
  tbody.innerHTML='';
  state.productos
    .filter(p=>(!tag||p.etiqueta===tag) && (p.name.toLowerCase().includes(txt)||p.sku.toLowerCase().includes(txt)))
    .forEach((p,i)=>{
      const stock=getStock(p), prox=nextCadProxima(p);
      const isLow=(stock!=='—' && Number(stock)<=Number(p.stockMin)); if(isLow) low++;
      const soon=(prox!=='—' && new Date(prox)<=addDays(new Date(),30)); if(soon) cad++;
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
  inv.editIndex=i; const isEdit=i>-1; $('#dlgProdTitle').textContent=isEdit?'Editar producto':'Nuevo producto';
  const f=(id,v='')=>{$('#'+id).value=v};
  if(isEdit){
    const p=state.productos[i];
    f('fSku',p.sku); f('fNombre',p.name); f('fEtiqueta',p.etiqueta);
    f('fPrecio',p.price); f('fCosto',p.cost||0); f('fMin',p.stockMin||0); f('fImg',p.img||'');
    f('fLote0'); f('fCad0'); f('fPzs0');
  }else{ ['fSku','fNombre','fPrecio','fCosto','fImg'].forEach(id=>f(id)); f('fEtiqueta','Genérico'); f('fMin',0); f('fLote0'); f('fCad0'); f('fPzs0'); }
  $('#dlgProd').showModal();
}
function saveProd(){
  const p={
    sku:$('#fSku').value.trim().toUpperCase(),
    name:$('#fNombre').value.trim(),
    etiqueta:$('#fEtiqueta').value,
    price:+$('#fPrecio').value,
    cost:+$('#fCosto').value||0,
    stockMin:+$('#fMin').value||0,
    img:$('#fImg').value.trim(),
    batches:(inv.editIndex>-1)?(state.productos[inv.editIndex].batches||[]):[]
  };
  if(!p.sku||!p.name||!p.price){ alert('SKU, Nombre y Precio obligatorios'); return; }
  const lote0=$('#fLote0').value.trim(), cad0=$('#fCad0').value||'', pzs0=+($('#fPzs0').value||0);
  if(p.etiqueta!=='Servicio' && lote0 && pzs0>0){ p.batches.push({lote:lote0,cad:cad0,piezas:pzs0}); }
  if(inv.editIndex>-1){ state.productos[inv.editIndex]=p; } else {
    if(state.productos.some(x=>x.sku===p.sku)) return alert('SKU ya existe');
    state.productos.push(p);
  }
  $('#dlgProd').close(); saveState(); renderInvTable(); renderCatalogo();
}
function openStockDialog(i){ inv.stockSku=state.productos[i].sku; $('#sLote').value=''; $('#sCad').value=''; $('#sPiezas').value=''; $('#dlgStock').showModal(); }
function saveStock(){
  const lote=$('#sLote').value.trim(), cad=$('#sCad').value||'', piezas=+$('#sPiezas').value;
  if(!lote||!piezas) return alert('Lote y piezas son obligatorios');
  const p=state.productos.find(x=>x.sku===inv.stockSku); p.batches=p.batches||[]; p.batches.push({lote,cad,piezas});
  $('#dlgStock').close(); saveState(); renderInvTable(); renderCatalogo();
}
function deleteProd(i){ const p=state.productos[i]; if(!confirm(`Eliminar ${p.name}?`)) return; state.productos.splice(i,1); saveState(); renderInvTable(); renderCatalogo(); }
function importCSV(file){
  const r=new FileReader();
  r.onload=()=>{
    const lines=r.result.split(/\r?\n/).filter(Boolean); const out=[];
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(x=>x.trim()); if(cols.length<10) continue;
      const [sku,nombre,etiqueta,precio,costo,min,lote,cad,piezas,img]=cols;
      let prod=out.find(p=>p.sku===sku); if(!prod){ prod={sku:sku.toUpperCase(),name:nombre,etiqueta,price:+precio,cost:+costo,stockMin:+min,img,batches:[]}; out.push(prod); }
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
  const wrap=$('#catalogoProductos'); const tag=$('#ventaEtiqueta').value||''; const txt=($('#ventaBuscar').value||'').toLowerCase();
  wrap.innerHTML='';
  state.productos.filter(p=>(!tag||p.etiqueta===tag)&&(p.name.toLowerCase().includes(txt)||p.sku.toLowerCase().includes(txt)))
    .forEach(p=>{
      const card=document.createElement('div'); card.className='prod-card';
      card.innerHTML=`
        <div class="prod-img" style="${p.img?`background-image:url('${p.img}');background-size:cover;background-position:center;`:''}"></div>
        <div class="prod-info">
          <div class="prod-name">${p.name}</div>
          <div class="prod-sku">SKU: ${p.sku}</div>
          <div class="prod-meta"><span>${money(p.price)}</span><span>${p.etiqueta==='Servicio'?'Stock: —':'Stock: '+getStock(p)}</span></div>
          <button class="btn add-to-cart" data-sku="${p.sku}" data-name="${p.name}" data-price="${p.price}">Agregar</button>
        </div>`;
      wrap.appendChild(card);
    });
  $$('.add-to-cart',wrap).forEach(b=>b.addEventListener('click',()=>addItem(b.dataset.sku,b.dataset.name,b.dataset.price)));
}
function renderCart(){
  const list=$('#carritoLista'); list.innerHTML='';
  let total=0;
  if(cart.items.length===0) list.innerHTML='<li>(Vacío)</li>';
  cart.items.forEach(p=>{ total+=p.price*p.qty; const li=document.createElement('li'); li.innerHTML=`${p.name} x${p.qty} — ${money(p.price*p.qty)}`; const del=document.createElement('button'); del.className='btn'; del.textContent='✕'; del.onclick=()=>{removeItem(p.sku)}; li.appendChild(del); list.appendChild(li); });
  const exList=$('#extrasLista'); exList.innerHTML='';
  cart.extras.forEach((e,i)=>{ total+=e.amount; const li=document.createElement('li'); li.innerHTML=`${e.desc} — ${money(e.amount)}`; const del=document.createElement('button'); del.className='btn'; del.textContent='✕'; del.onclick=()=>{cart.extras.splice(i,1); renderCart();}; li.appendChild(del); exList.appendChild(li); });
  $('#total').textContent=money(total);
}
function addItem(sku,name,price){ const f=cart.items.find(p=>p.sku===sku); if(f) f.qty++; else cart.items.push({sku,name,price:+price,qty:1}); renderCart(); }
function removeItem(sku){ const i=cart.items.findIndex(p=>p.sku===sku); if(i>-1){ cart.items.splice(i,1); renderCart(); } }
function clearCart(){ cart.items.length=0; cart.extras.length=0; cart.receta=null; $('#recetaFile').value=''; $('#recetaPreview').style.display='none'; renderCart(); }

function cobrar(){
  if(cart.items.length===0 && cart.extras.length===0) return alert('Carrito vacío');
  // Afectar stock (no servicios)
  cart.items.forEach(item=>{
    const p=state.productos.find(x=>x.sku===item.sku);
    if(!p || p.etiqueta==='Servicio') return;
    let qty=item.qty;
    (p.batches||[]).sort((a,b)=>new Date(a.cad)-new Date(b.cad)); // FEFO simple
    for(const b of p.batches){
      const take=Math.min(qty,b.piezas); b.piezas-=take; qty-=take; if(qty<=0) break;
    }
    p.batches=p.batches.filter(b=>b.piezas>0);
  });

  // Construir venta
  const folio='F-'+uid();
  const total=parseFloat($('#total').textContent.replace(/[^0-9.]/g,''))||0;
  const venta={
    folio, fecha:new Date().toISOString(), cliente:'Público',
    items:structuredClone(cart.items), extras:structuredClone(cart.extras),
    total, pago:'EFE', receta:cart.receta?cart.receta.name||cart.receta.fileName:null, estado:'Activa'
  };
  state.ventas.unshift(venta);

  // KPIs cliente “Público General”
  const cg=state.clientes.find(c=>c.nombre==='Público General'); if(cg){ cg.compras++; cg.ultima=todayISO(); }

  saveState();
  alert(`Cobro registrado — Folio ${folio}\nTotal: ${money(total)}`);
  clearCart(); renderInvTable(); renderHistorial(); renderReportes('d'); refreshKPIs();
}

function refreshKPIs(){
  const hoy=todayISO();
  const ventasHoy=state.ventas.filter(v=>v.fecha.slice(0,10)===hoy);
  const total=ventasHoy.reduce((s,v)=>s+v.total,0);
  const prodVend=ventasHoy.reduce((s,v)=>s+v.items.reduce((a,b)=>a+b.qty,0),0);
  const tickets=ventasHoy.length;
  $('#kpiVentasHoy').textContent=money(total);
  $('#kpiTicketsHoy').textContent=tickets;
  $('#kpiProdVend').textContent=prodVend;
  $('#kpiTicketProm').textContent=money(tickets?total/tickets:0);
}

/* ===== Historial ===== */
function renderHistorial(){
  const tbody=$('#tablaHistorial tbody'); tbody.innerHTML='';
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
          <button class="btn btn-sm" data-act="ver" data-f="${v.folio}">Ver</button>
          ${v.estado==='Activa'?`<button class="btn btn-sm" data-act="anular" data-f="${v.folio}">Anular</button>`:''}
        </td>`;
      tbody.appendChild(tr);
    });
}
function anularVenta(folio){
  const v=state.ventas.find(x=>x.folio===folio); if(!v||v.estado!=='Activa') return;
  // Regresar stock
  v.items.forEach(item=>{
    const p=state.productos.find(x=>x.sku===item.sku);
    if(!p||p.etiqueta==='Servicio') return;
    // Lo devolvemos a un lote “DEV” sin caducidad
    const lot=(p.batches||[]); lot.push({lote:'DEV-'+folio,cad:'',piezas:item.qty});
    p.batches=lot;
  });
  v.estado='Anulada'; saveState(); renderInvTable(); renderHistorial(); renderReportes('d'); refreshKPIs();
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
  // top productos
  const map=new Map();
  set.forEach(v=>v.items.forEach(i=>map.set(i.name,(map.get(i.name)||0)+i.qty)));
  const top=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q])=>`${n} (${q})`).join(', ')||'—';
  $('#repResumen').textContent=`Periodo ${desde} a ${hasta} — Total: ${money(total)} | Tickets: ${tickets} | Ticket prom.: ${money(tp)} | Top: ${top}`;
}

/* ===== Clientes ===== */
function renderClientes(){
  const txt=($('#buscarCliente').value||'').toLowerCase();
  const tbody=$('#tablaClientes tbody'); tbody.innerHTML='';
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

/* ===== Bodega ===== */
// Inventario lanzará solicitudes con sku y piezas (simulado con prompt por ahora)
function renderSolicitudes(){
  const tbody=$('#tblSolicitudes tbody'); tbody.innerHTML='';
  state.solicitudes.forEach(s=>{
    const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.folio}</td><td>${s.sku}</td><td>${s.piezas}</td><td>${s.estado}</td>`; tbody.appendChild(tr);
  });
  $('#recepcionPanel').textContent='(Selecciona una solicitud)';
  // click row
  $$('#tblSolicitudes tbody tr').forEach((tr,i)=> tr.addEventListener('click',()=>openRecepcion(state.solicitudes[i])));
}
function openRecepcion(sol){
  const p=state.productos.find(x=>x.sku===sol.sku); const wrap=$('#recepcionPanel');
  wrap.innerHTML=`<p><strong>Solicitud:</strong> ${sol.folio} — SKU ${sol.sku} (${p?.name||'—'}) — Piezas solicitadas: ${sol.piezas}</p>
    <button id="recAceptar" class="btn primary">Aceptar</button>
    <button id="recParcial" class="btn">Parcial</button>
    <button id="recRech" class="btn">Rechazar</button>`;
  $('#recAceptar').onclick=()=>{ moverAInventario(sol,sol.piezas); sol.estado='Aceptada'; saveState(); renderSolicitudes(); renderInvTable(); };
  $('#recParcial').onclick=()=>{ const n=+prompt('Piezas a recibir',sol.piezas)||0; if(n<=0) return; moverAInventario(sol,n); sol.estado='Parcial '+n+'/'+sol.piezas; saveState(); renderSolicitudes(); renderInvTable(); };
  $('#recRech').onclick=()=>{ sol.estado='Rechazada'; saveState(); renderSolicitudes(); };
}
function moverAInventario(sol,n){
  const p=state.productos.find(x=>x.sku===sol.sku); if(!p||p.etiqueta==='Servicio') return;
  p.batches=p.batches||[]; p.batches.push({lote:'BOD-'+sol.folio,cad:'',piezas:n});
}

/* ===== Configuración ===== */
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
  // acciones de tabla
  $('#tablaInv').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-act]'); if(!btn) return;
    const act=btn.dataset.act, i=+btn.dataset.i;
    if(act==='edit') openProdDialog(i);
    if(act==='stock') openStockDialog(i);
    if(act==='del') deleteProd(i);
  });
}
function initVentasUI(){
  $('#ventaBuscar').oninput=renderCatalogo;
  $('#ventaEtiqueta').onchange=renderCatalogo;
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
    if(act==='ver'){ alert(`Folio ${folio}`); }
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

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded',()=>{
  initLayout(); applyThemePreview(); applyLogo(); refreshKPIs();

  initInventarioUI(); renderInvTable();
  initVentasUI(); renderCatalogo(); renderCart();
  initHistorialUI(); renderHistorial();
  initReportesUI(); renderReportes('d');
  initClientesUI(); renderClientes();
  initConfig();

  // botones varios
  $('#btnCancelProd')?.addEventListener('click',()=>$('#dlgProd').close());
  $('#btnCancelStock')?.addEventListener('click',()=>$('#dlgStock').close());
});
