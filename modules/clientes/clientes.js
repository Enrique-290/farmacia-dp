// CLIENTES
// ---------------------------
const elCliNombre = document.getElementById('cliNombre');
const elCliTel = document.getElementById('cliTel');
const elCliCorreo = document.getElementById('cliCorreo');
const elBtnAgregarCliente = document.getElementById('btnAgregarCliente');
const elListaClientes = document.getElementById('listaClientes');

function renderClientes(){
  elListaClientes.innerHTML='';
  if(!state.clientes.length){
    elListaClientes.textContent='Sin clientes registrados.';
  }else{
    state.clientes.forEach((c,idx)=>{
      const row=document.createElement('div');
      row.style.display='flex';
      row.style.justifyContent='space-between';
      row.style.borderBottom='1px dashed #e5e7eb';
      row.style.padding='3px 0';
      row.innerHTML=`<span>${c.nombre} (${c.telefono||'s/tel'})</span><button data-idx="${idx}" class="btn btn-outline" style="padding:2px 8px;font-size:11px;">Eliminar</button>`;
      elListaClientes.appendChild(row);
    });
    elListaClientes.querySelectorAll('button[data-idx]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i=Number(btn.dataset.idx);
        state.clientes.splice(i,1);
        saveState();
        renderClientes();
        fillClientesSelect();
      });
    });
  }
  fillClientesSelect();
}
function fillClientesSelect(){
  elClienteSelect.innerHTML='<option value="">Sin cliente</option>';
  state.clientes.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.nombre;opt.textContent=c.nombre;
    elClienteSelect.appendChild(opt);
  });
}
elBtnAgregarCliente.addEventListener('click',()=>{
  const nombre=elCliNombre.value.trim();
  if(!nombre){alert('Nombre es obligatorio');return;}
  state.clientes.push({nombre,telefono:elCliTel.value.trim(),correo:elCliCorreo.value.trim()});
  elCliNombre.value='';elCliTel.value='';elCliCorreo.value='';
  saveState();
  renderClientes();
});

// ---------------------------
