/* ========== Estado global (v1 demo) ========== */
const state = {
  activeSection: 'dashboard',
  config: {
    colors: {
      menu: '#0d6efd', fondo: '#ffffff', panel: '#ffffff',
      primario:'#0d6efd', texto:'#111111', subtexto:'#6b7280'
    },
    negocio: {
      nombre:'', dir:'', tel:'', mail:'',
      logoDataUrl:'', ticketMsg:'Gracias por su compra'
    }
  },
  cart: { items:{}, extras:[], recipe:null } // items: sku -> {name, price, qty}
};

/* Catálogo demo (hasta que conectemos inventario real) */
const PRODUCTS = [
  { sku:'P-001', name:'Paracetamol 500mg', price:25 },
  { sku:'A-010', name:'Amoxicilina 500mg', price:60 },
];

const $ = (s, c=document)=>c.querySelector(s);
const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));
const money = n => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(+n||0);

/* ====== Persistencia simple ====== */
function saveLocal(){ localStorage.setItem('farmaciaDPv1', JSON.stringify(state)); }
function loadLocal(){
  const raw = localStorage.getItem('farmaciaDPv1');
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if(parsed?.config) state.config = parsed.config;
    if(parsed?.cart)   state.cart = parsed.cart;
    if(parsed?.activeSection) state.activeSection = parsed.activeSection;
  }catch(e){}
}

/* ====== Tema ====== */
function applyTheme(){
  const r = document.documentElement;
  const c = state.config.colors;
  r.style.setProperty('--menu-bg', c.menu);
  r.style.setProperty('--bg', c.fondo);
  r.style.setProperty('--panel', c.panel);
  r.style.setProperty('--primary', c.primario);
  r.style.setProperty('--text', c.texto);
  r.style.setProperty('--subtext', c.subtexto);
}

/* ====== Util ====== */
async function fileToDataURL(file, maxW=320, maxH=160){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const ratio = Math.min(maxW/img.width, maxH/img.height, 1);
        const w = Math.round(img.width*ratio), h = Math.round(img.height*ratio);
        const canvas = document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ====== Navegación ====== */
function setActiveSection(id){
  state.activeSection = id; saveLocal();
  $$('.nav-link').forEach(b=> b.classList.toggle('active', b.dataset.section===id));
  $$('.view').forEach(v=> v.classList.toggle('active', v.id===id));
  $('#sectionTitle').textContent = id.charAt(0).toUpperCase()+id.slice(1);
}
function initSidebar(){
  const sidebar = $('#sidebar');
  $('#btnToggle').addEventListener('click', ()=> sidebar.classList.toggle('collapsed'));
  $('#btnOpen').addEventListener('click', ()=> sidebar.classList.add('open'));
  document.addEventListener('click', (e)=>{
    const isSidebar = sidebar.contains(e.target) || e.target===$('#btnOpen');
    if(!isSidebar && matchMedia('(max-width:820px)').matches) sidebar.classList.remove('open');
  });
  $$('.nav-link').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setActiveSection(btn.dataset.section);
      if(matchMedia('(max-width:820px)').matches) sidebar.classList.remove('open');
    });
  });
}

/* ====== Config ====== */
function initConfig(){
  const cIds = { menu:'cMenu', fondo:'cFondo', panel:'cPanel', primario:'cPrimario', texto:'cTexto', subtexto:'cSubtexto' };
  for(const k in cIds){
    const el = $('#'+cIds[k]);
    if(!el) continue;
    el.value = state.config.colors[k] || el.value;
    el.addEventListener('input', ()=>{ state.config.colors[k]=el.value; applyTheme(); saveLocal(); });
  }
  $('#btnResetTema')?.addEventListener('click', ()=>{
    state.config.colors = { menu:'#0d6efd', fondo:'#ffffff', panel:'#ffffff', primario:'#0d6efd', texto:'#111111', subtexto:'#6b7280' };
    applyTheme();
    for(const k in cIds) $('#'+cIds[k]).value = state.config.colors[k];
    saveLocal();
  });
  $('#btnGuardarTema')?.addEventListener('click', ()=>{ saveLocal(); alert('Tema guardado'); });

  // Datos negocio
  $('#negNombre').value = state.config.negocio.nombre||'';
  $('#negDir').value = state.config.negocio.dir||'';
  $('#negTel').value = state.config.negocio.tel||'';
  $('#negMail').value = state.config.negocio.mail||'';
  if(state.config.negocio.logoDataUrl){
    ['menuLogo','menuLogoPreview','ticketLogoPreview'].forEach(id=> $('#'+id).src = state.config.negocio.logoDataUrl);
  }
  $('#negLogo')?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const dataUrl = await fileToDataURL(f, 320, 160);
    state.config.negocio.logoDataUrl = dataUrl;
    ['menuLogo','menuLogoPreview','ticketLogoPreview'].forEach(id=> $('#'+id).src = dataUrl);
    saveLocal();
  });
  $('#btnGuardarNeg')?.addEventListener('click', ()=>{
    state.config.negocio.nombre = $('#negNombre').value.trim();
    state.config.negocio.dir = $('#negDir').value.trim();
    state.config.negocio.tel = $('#negTel').value.trim();
    state.config.negocio.mail = $('#negMail').value.trim();
    $('#ticketHeader').textContent =
      `${state.config.negocio.nombre||'Nombre'} — ${state.config.negocio.dir||'Dirección'} — ${state.config.negocio.tel||'Tel'} — ${state.config.negocio.mail||'Email'}`;
    saveLocal(); alert('Datos del negocio guardados');
  });
  $('#ticketMensaje').value = state.config.negocio.ticketMsg || 'Gracias por su compra';
  $('#btnGuardarTicket')?.addEventListener('click', ()=>{
    state.config.negocio.ticketMsg = $('#ticketMensaje').value; saveLocal(); alert('Mensaje de ticket guardado');
  });

  // Respaldos demo
  $('#btnExportar')?.addEventListener('click', ()=>{
    const payload = { version:'v1', fecha:new Date().toISOString(), data:{}, config:state.config };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo_farmaciaDPv1_${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('#btnImportar')?.addEventListener('click', async ()=>{
    const f = $('#importFile').files?.[0]; if(!f) return alert('Selecciona un archivo');
    try{
      const json = JSON.parse(await f.text());
      if(json?.config){ state.config = json.config; applyTheme(); saveLocal(); alert('Respaldo importado (config).'); location.reload(); }
      else alert('Archivo inválido');
    }catch{ alert('No se pudo leer el respaldo'); }
  });
}

/* ====== Carrito (demo funcional) ====== */
function addItem(sku, name, price, qty=1){
  const key = sku.toUpperCase();
  if(!state.cart.items[key]) state.cart.items[key] = { sku:key, name, price:+price, qty:0 };
  state.cart.items[key].qty += qty;
  saveLocal(); renderCart();
}
function changeQty(sku, delta){
  const it = state.cart.items[sku]; if(!it) return;
  it.qty += delta; if(it.qty<=0) delete state.cart.items[sku];
  saveLocal(); renderCart();
}
function removeItem(sku){ delete state.cart.items[sku]; saveLocal(); renderCart(); }

let extraIdSeq = 1;
function addExtra(desc, amount){
  const val = +amount;
  if(!desc || isNaN(val)) return;
  state.cart.extras.push({ id: 'E'+(extraIdSeq++), desc, amount: val });
  saveLocal(); renderCart();
}
function removeExtra(id){
  state.cart.extras = state.cart.extras.filter(e=> e.id!==id);
  saveLocal(); renderCart();
}
function clearCart(){
  state.cart = { items:{}, extras:[], recipe:null };
  saveLocal(); renderCart();
}

function cartTotal(){
  const itemsTotal = Object.values(state.cart.items).reduce((s,i)=> s + i.price*i.qty, 0);
  const extrasTotal = state.cart.extras.reduce((s,e)=> s + e.amount, 0);
  return itemsTotal + extrasTotal;
}

function renderCart(){
  const list = $('#carritoLista');
  list.innerHTML = '';
  const items = Object.values(state.cart.items);
  if(items.length===0) list.innerHTML = '<li>(Vacío)</li>';
  else{
    items.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'cart-line';
      li.innerHTML = `
        <span class="name">${it.name}</span>
        <span class="price">${money(it.price*it.qty)}</span>
        <span class="qty-controls">
          <button class="btn icon" data-act="dec" data-sku="${it.sku}">−</button>
          <span class="qty">${it.qty}</span>
          <button class="btn icon" data-act="inc" data-sku="${it.sku}">+</button>
          <button class="btn icon" data-act="del" data-sku="${it.sku}">✕</button>
        </span>`;
      list.appendChild(li);
    });
  }

  // Extras
  const exList = $('#extrasLista');
  exList.innerHTML = '';
  state.cart.extras.forEach(e=>{
    const li = document.createElement('li');
    li.innerHTML = `<div class="extra-pill"><span>${e.desc} — ${money(e.amount)}</span> <button class="btn icon" data-xid="${e.id}">✕</button></div>`;
    exList.appendChild(li);
  });

  // Total
  $('#total').textContent = money(cartTotal());
}

/* ====== Ventas UI ====== */
function initVentasUI(){
  // Botones Agregar
  $$('#catalogoProductos .add-to-cart').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const sku = (btn.dataset.sku||'').toUpperCase();
      const name = btn.dataset.name || sku;
      const price = +btn.dataset.price || 0;
      addItem(sku, name, price, 1);
    });
  });

  // Carrito en móvil
  $('#btnCarritoMovil')?.addEventListener('click', ()=> $('#carritoPanel').classList.toggle('open'));

  // Extras
  $('#btnAgregarExtra')?.addEventListener('click', ()=>{
    addExtra($('#extraDesc').value.trim(), $('#extraMonto').value);
    $('#extraDesc').value=''; $('#extraMonto').value='';
  });
  $('#extrasLista').addEventListener('click', (e)=>{
    const id = e.target?.dataset?.xid; if(id) removeExtra(id);
  });

  // Clicks en carrito (inc/dec/del)
  $('#carritoLista').addEventListener('click', (e)=>{
    const sku = e.target?.dataset?.sku;
    if(!sku) return;
    const act = e.target.dataset.act;
    if(act==='inc') changeQty(sku, +1);
    if(act==='dec') changeQty(sku, -1);
    if(act==='del') removeItem(sku);
  });

  // Vaciar
  $('#btnVaciar')?.addEventListener('click', clearCart);

  // Cobrar (demo)
  $('#btnCobrar')?.addEventListener('click', ()=>{
    if(Object.keys(state.cart.items).length===0 && state.cart.extras.length===0){
      alert('Carrito vacío'); return;
    }
    alert(`Cobro demo — Total: ${money(cartTotal())}\n(En la siguiente etapa se guardará la venta y se imprimirá ticket)`);
    clearCart();
  });

  // Receta preview
  const recetaFile = $('#recetaFile'), recetaPreview = $('#recetaPreview');
  recetaFile?.addEventListener('change', e=>{
    const f = e.target.files?.[0]; if(!f){ recetaPreview.style.display='none'; state.cart.recipe=null; saveLocal(); return; }
    state.cart.recipe = { name:f.name, type:f.type, size:f.size };
    if(f.type.startsWith('image/')){
      recetaPreview.src = URL.createObjectURL(f);
      recetaPreview.style.display = 'block';
    }else{
      recetaPreview.style.display = 'none';
    }
    saveLocal();
  });

  // Escáner (Enter agrega por SKU)
  const barcodeInput = $('#barcodeInput');
  const reactivar = $('#reactivarScanner');
  function focusScanner(){ barcodeInput.focus(); barcodeInput.select?.(); }
  focusScanner();
  reactivar?.addEventListener('click', focusScanner);
  barcodeInput?.addEventListener('keydown', e=>{
    if(e.key!=='Enter') return;
    const code = (barcodeInput.value||'').trim().toUpperCase(); barcodeInput.value='';
    if(!code) return;
    const found = PRODUCTS.find(p=> p.sku.toUpperCase()===code);
    if(found) addItem(found.sku, found.name, found.price, 1);
    else alert(`SKU no encontrado: ${code}`);
  });

  // Render inicial por si había carrito guardado
  renderCart();
}

/* ====== Tabs ====== */
function initTabs(){
  const tabs = $$('.tab'), panels = $$('.tabpanel');
  tabs.forEach(t=>{
    t.addEventListener('click', ()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      panels.forEach(p=>p.classList.remove('active'));
      t.classList.add('active'); $('#tab-'+t.dataset.tab).classList.add('active');
    });
  });
}

/* ====== Inicio ====== */
document.addEventListener('DOMContentLoaded', ()=>{
  loadLocal(); applyTheme();
  initSidebar(); initTabs(); initConfig(); initVentasUI();

  if(state.config.negocio.logoDataUrl){
    ['menuLogo','menuLogoPreview','ticketLogoPreview'].forEach(id=> $('#'+id).src = state.config.negocio.logoDataUrl);
  }
  setActiveSection(state.activeSection || 'dashboard');
});
