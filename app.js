/* ========== Estado global mínimo (v1 visual) ========== */
const state = {
  activeSection: 'dashboard',
  config: {
    colors: {
      menu: '#0d6efd',
      fondo: '#ffffff',
      panel: '#ffffff',
      primario: '#0d6efd',
      texto: '#111111',
      subtexto: '#6b7280',
    },
    negocio: {
      nombre: '',
      dir: '',
      tel: '',
      mail: '',
      logoDataUrl: '', // dataURL para menú y ticket
      ticketMsg: 'Gracias por su compra',
    }
  }
};

/* ========== Utilidades ========== */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function saveLocal(){
  localStorage.setItem('farmaciaDPv1', JSON.stringify(state));
}
function loadLocal(){
  const raw = localStorage.getItem('farmaciaDPv1');
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if(parsed?.config) state.config = parsed.config;
  }catch(e){/* noop */}
}

function applyTheme(){
  const r = document.documentElement;
  r.style.setProperty('--menu-bg', state.config.colors.menu);
  r.style.setProperty('--bg', state.config.colors.fondo);
  r.style.setProperty('--panel', state.config.colors.panel);
  r.style.setProperty('--primary', state.config.colors.primario);
  r.style.setProperty('--text', state.config.colors.texto);
  r.style.setProperty('--subtext', state.config.colors.subtexto);
}

/* Escala y recorta logo para vistas (menú/ticket) */
async function fileToDataURL(file, maxW=320, maxH=320){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = ()=>{
        const ratio = Math.min(maxW/img.width, maxH/img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatMoney(n){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(+n||0) }

/* ========== Navegación entre secciones ========== */
function setActiveSection(id){
  state.activeSection = id;
  saveLocal();
  // botones
  $$('.nav-link').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.section===id);
  });
  // vistas
  $$('.view').forEach(v=>{
    v.classList.toggle('active', v.id===id);
  });
  // título
  $('#sectionTitle').textContent = id.charAt(0).toUpperCase()+id.slice(1);
}

/* ========== Menú plegable / móvil ========== */
function initSidebar(){
  const sidebar = $('#sidebar');
  const btnToggle = $('#btnToggle');
  const btnOpen = $('#btnOpen');

  btnToggle.addEventListener('click', ()=>{
    sidebar.classList.toggle('collapsed');
  });

  // móvil
  btnOpen.addEventListener('click', ()=> sidebar.classList.add('open'));
  // cerrar tocando fuera (opcional)
  document.addEventListener('click', (e)=>{
    const isSidebar = sidebar.contains(e.target) || e.target===btnOpen;
    if(!isSidebar && window.matchMedia('(max-width: 820px)').matches){
      sidebar.classList.remove('open');
    }
  });

  // navegación
  $$('.nav-link').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      setActiveSection(btn.dataset.section);
      if(window.matchMedia('(max-width: 820px)').matches){
        sidebar.classList.remove('open');
      }
    });
  });
}

/* ========== Configuración: colores, negocio y ticket ========== */
function initConfig(){
  // Colores
  const cIds = { menu:'cMenu', fondo:'cFondo', panel:'cPanel', primario:'cPrimario', texto:'cTexto', subtexto:'cSubtexto' };
  for(const key in cIds){
    const input = $('#'+cIds[key]);
    if(input){
      input.value = state.config.colors[key] || input.value;
      input.addEventListener('input', ()=>{
        state.config.colors[key] = input.value;
        applyTheme();
      });
    }
  }
  $('#btnGuardarTema').addEventListener('click', ()=>{ saveLocal(); alert('Tema guardado'); });
  $('#btnResetTema').addEventListener('click', ()=>{
    state.config.colors = {
      menu: '#0d6efd', fondo:'#ffffff', panel:'#ffffff',
      primario:'#0d6efd', texto:'#111111', subtexto:'#6b7280'
    };
    applyTheme();
    for(const key in cIds) $('#'+cIds[key]).value = state.config.colors[key];
    saveLocal();
  });

  // Datos negocio
  $('#negNombre').value = state.config.negocio.nombre || '';
  $('#negDir').value = state.config.negocio.dir || '';
  $('#negTel').value = state.config.negocio.tel || '';
  $('#negMail').value = state.config.negocio.mail || '';
  if(state.config.negocio.logoDataUrl){
    $('#menuLogo').src = state.config.negocio.logoDataUrl;
    $('#menuLogoPreview').src = state.config.negocio.logoDataUrl;
    $('#ticketLogoPreview').src = state.config.negocio.logoDataUrl;
  }

  $('#negLogo').addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const dataUrl = await fileToDataURL(file, 320, 160);
    state.config.negocio.logoDataUrl = dataUrl;
    $('#menuLogo').src = dataUrl;
    $('#menuLogoPreview').src = dataUrl;
    $('#ticketLogoPreview').src = dataUrl;
  });

  $('#btnGuardarNeg').addEventListener('click', ()=>{
    state.config.negocio.nombre = $('#negNombre').value.trim();
    state.config.negocio.dir = $('#negDir').value.trim();
    state.config.negocio.tel = $('#negTel').value.trim();
    state.config.negocio.mail = $('#negMail').value.trim();
    saveLocal();
    // refrescar encabezado de ticket preview
    $('#ticketHeader').textContent =
      `${state.config.negocio.nombre||'Nombre'} — ${state.config.negocio.dir||'Dirección'} — ${state.config.negocio.tel||'Tel'} — ${state.config.negocio.mail||'Email'}`;
    alert('Datos del negocio guardados');
  });

  // Ticket
  $('#ticketMensaje').value = state.config.negocio.ticketMsg || 'Gracias por su compra';
  $('#btnGuardarTicket').addEventListener('click', ()=>{
    state.config.negocio.ticketMsg = $('#ticketMensaje').value;
    saveLocal();
    alert('Mensaje de ticket guardado');
  });

  // Respaldos (placeholders funcionales mínimos)
  $('#btnExportar').addEventListener('click', ()=>{
    const payload = {
      version: 'v1',
      fecha: new Date().toISOString(),
      data: { /* productos, lotes, clientes, ventas, items… */ },
      config: state.config
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo_farmaciaDPv1_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#btnImportar').addEventListener('click', async ()=>{
    const file = $('#importFile').files?.[0];
    if(!file) return alert('Selecciona un archivo de respaldo');
    const text = await file.text();
    try{
      const json = JSON.parse(text);
      if(json?.config){
        state.config = json.config;
        applyTheme();
        // volver a setear campos
        for(const key in cIds) $('#'+cIds[key]).value = state.config.colors[key];
        $('#negNombre').value = state.config.negocio.nombre || '';
        $('#negDir').value = state.config.negocio.dir || '';
        $('#negTel').value = state.config.negocio.tel || '';
        $('#negMail').value = state.config.negocio.mail || '';
        $('#ticketMensaje').value = state.config.negocio.ticketMsg || 'Gracias por su compra';
        if(state.config.negocio.logoDataUrl){
          $('#menuLogo').src = state.config.negocio.logoDataUrl;
          $('#menuLogoPreview').src = state.config.negocio.logoDataUrl;
          $('#ticketLogoPreview').src = state.config.negocio.logoDataUrl;
        }
        saveLocal();
        alert('Respaldo importado (config). Datos de negocio y colores aplicados.');
      }else{
        alert('Archivo inválido o sin estructura reconocida.');
      }
    }catch(e){ alert('No se pudo leer el respaldo'); }
  });
}

/* ========== Ventas: UI base (sin lógica de stock aún) ========== */
function initVentasUI(){
  const carrito = $('#carritoPanel');
  const btnMovil = $('#btnCarritoMovil');
  const recetaFile = $('#recetaFile');
  const recetaPreview = $('#recetaPreview');
  const barcodeInput = $('#barcodeInput');
  const reactivar = $('#reactivarScanner');

  // carrito en móvil slide-up
  btnMovil.addEventListener('click', ()=> carrito.classList.toggle('open'));

  // preview receta
  recetaFile.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file){ recetaPreview.style.display='none'; return; }
    let url;
    if(file.type.startsWith('image/')){
      url = URL.createObjectURL(file);
      recetaPreview.src = url;
      recetaPreview.style.display = 'block';
    }else{
      recetaPreview.style.display = 'none'; // PDFs no se previsualizan aquí
    }
  });

  // escáner (modo lector-teclado)
  function focusScanner(){ barcodeInput.focus(); barcodeInput.select?.(); }
  focusScanner();
  reactivar.addEventListener('click', focusScanner);

  barcodeInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      const code = barcodeInput.value.trim();
      if(!code) return;
      // aquí luego: buscar producto por barcode y agregar al carrito
      // por ahora solo feedback visual:
      alert(`Escaneado: ${code} (demo)`);
      barcodeInput.value = '';
    }
  });

  // botones "Agregar" demo
  $$('.add-to-cart').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const list = $('#carritoLista');
      if(list.firstElementChild && list.firstElementChild.textContent==='(Vacío)') list.innerHTML='';
      const li = document.createElement('li');
      li.textContent = 'Producto demo x1 — $0.00';
      list.appendChild(li);
      $('#total').textContent = formatMoney(0);
    });
  });
}

/* ========== Tabs Config ========== */
function initTabs(){
  const tabs = $$('.tab');
  const panels = $$('.tabpanel');
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.remove('active'));
      panels.forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      $('#tab-'+tab.dataset.tab).classList.add('active');
    });
  });
}

/* ========== Inicio ========== */
document.addEventListener('DOMContentLoaded', ()=>{
  loadLocal();
  applyTheme();
  initSidebar();
  initTabs();
  initConfig();
  initVentasUI();

  // aplica logo si ya había
  if(state.config.negocio.logoDataUrl){
    $('#menuLogo').src = state.config.negocio.logoDataUrl;
    $('#menuLogoPreview').src = state.config.negocio.logoDataUrl;
    $('#ticketLogoPreview').src = state.config.negocio.logoDataUrl;
  }

  // restaura sección activa
  setActiveSection(state.activeSection || 'dashboard');
});
