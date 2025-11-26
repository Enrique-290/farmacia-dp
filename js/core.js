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

// Asegurar estructura de lotes en inventario
function ensureLotesStructure() {
  if (!Array.isArray(state.inventario)) state.inventario = [];
  state.inventario.forEach(p => {
    if (!Array.isArray(p.lotes)) p.lotes = [];
    // Normalizar campos numéricos
    p.stockPiso = Number(p.stockPiso ?? p.stock ?? 0) || 0;
    p.stockBodega = Number(p.stockBodega ?? 0) || 0;
    p.stockMin = Number(p.stockMin ?? 0) || 0;
  });
}
ensureLotesStructure();

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
