// HISTORIAL (AVANZADO)
// ---------------------------
const elHistDesde   = document.getElementById('histDesde');
const elHistHasta   = document.getElementById('histHasta');
const elHistForma   = document.getElementById('histFormaPago');
const elHistCliente = document.getElementById('histCliente');
const elHistTabla   = document.getElementById('historialTabla');
const elHistResumen = document.getElementById('historialResumen');
const elBtnHistLimpiar    = document.getElementById('btnHistLimpiar');
const elBtnHistExportCsv  = document.getElementById('btnHistExportCsv');
const elBtnHistExportPdf  = document.getElementById('btnHistExportPdf');

function getVentasFiltradas(){
  let arr = state.ventas.slice();
  const dDesde = elHistDesde.value;
  const dHasta = elHistHasta.value;
  const forma  = elHistForma.value;
  const cliQ   = elHistCliente.value.trim().toLowerCase();

  if(dDesde){
    arr = arr.filter(v=> v.fechaISO.slice(0,10) >= dDesde);
  }
  if(dHasta){
    arr = arr.filter(v=> v.fechaISO.slice(0,10) <= dHasta);
  }
  if(forma){
    arr = arr.filter(v=> v.formaPago === forma);
  }
  if(cliQ){
    arr = arr.filter(v=> (v.cliente||'').toLowerCase().includes(cliQ));
  }
  return arr;
}

function renderHistorial(){
  const ventas = getVentasFiltradas();
  elHistTabla.innerHTML='';
  if(!ventas.length){
    const tr=document.createElement('tr');
    const td=document.createElement('td');
    td.colSpan=6;td.style.textAlign='center';td.style.color='#9ca3af';
    td.textContent='Sin ventas para los filtros seleccionados.';
    tr.appendChild(td);elHistTabla.appendChild(tr);
    elHistResumen.textContent='';
    return;
  }
  let total = 0;
  ventas.slice().reverse().forEach(v=>{
    total += v.total;
    const tr=document.createElement('tr');
    const fechaCorta = v.fechaTexto;
    const tdId = document.createElement('td'); tdId.textContent = v.id;
    const tdFecha = document.createElement('td'); tdFecha.textContent = fechaCorta;
    const tdCli = document.createElement('td'); tdCli.textContent = v.cliente || 'Sin cliente';
    const tdPago = document.createElement('td'); tdPago.textContent = v.formaPago;
    const tdTotal = document.createElement('td'); tdTotal.textContent = money(v.total);
    const tdAcc = document.createElement('td'); tdAcc.style.whiteSpace='nowrap';

    const btnVer = document.createElement('button');
    btnVer.className='qty-btn'; btnVer.textContent='👁';
    btnVer.title='Ver detalle';
    btnVer.addEventListener('click',()=>{
      const txt = buildTicketText(v);
      alert(txt);
    });

    const btnReimp = document.createElement('button');
    btnReimp.className='qty-btn'; btnReimp.textContent='🖨';
    btnReimp.title='Reimprimir ticket';
    btnReimp.addEventListener('click',()=>printTicket(v));

    tdAcc.appendChild(btnVer);
    tdAcc.appendChild(btnReimp);

    tr.appendChild(tdId);
    tr.appendChild(tdFecha);
    tr.appendChild(tdCli);
    tr.appendChild(tdPago);
    tr.appendChild(tdTotal);
    tr.appendChild(tdAcc);
    elHistTabla.appendChild(tr);
  });
  elHistResumen.textContent = `Mostrando ${ventas.length} venta(s) · Total: ${money(total)}`;
}

function exportHistorialCsv(){
  const ventas = getVentasFiltradas();
  if(!ventas.length){
    alert('No hay ventas para exportar con los filtros actuales.');
    return;
  }
  const header = ['Ticket','Fecha','Cliente','FormaPago','Subtotal','Descuento','Extra','IVA','Total','Notas'];
  const rows = ventas.map(v=>[
    v.id,
    v.fechaTexto,
    v.cliente || '',
    v.formaPago || '',
    v.subtotal.toFixed(2),
    v.descMonto.toFixed(2),
    v.extraMonto.toFixed(2),
    v.ivaMonto.toFixed(2),
    v.total.toFixed(2),
    v.notas || ''
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
  a.download = 'historial_ventas_farmacia_dp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportHistorialPdf(){
  const ventas = getVentasFiltradas();
  if(!ventas.length){
    alert('No hay ventas para exportar con los filtros actuales.');
    return;
  }
  let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Historial de ventas</title>
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
<h1>Historial de ventas - ${state.config.negocio||'Farmacia DP'}</h1>
<table><thead><tr>
<th>Ticket</th><th>Fecha</th><th>Cliente</th><th>Pago</th><th>Subtotal</th><th>Desc</th><th>Extra</th><th>IVA</th><th>Total</th>
</tr></thead><tbody>`;
  ventas.forEach(v=>{
    html += `<tr>
<td>${v.id}</td>
<td>${v.fechaTexto}</td>
<td>${v.cliente||''}</td>
<td>${v.formaPago||''}</td>
<td>${v.subtotal.toFixed(2)}</td>
<td>${v.descMonto.toFixed(2)}</td>
<td>${v.extraMonto.toFixed(2)}</td>
<td>${v.ivaMonto.toFixed(2)}</td>
<td>${v.total.toFixed(2)}</td>
</tr>`;
  });
  html += `</tbody></table>
<script>
window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 600); };
<\/script>
</body></html>`;
  const w = window.open('','hist','width=900,height=700');
  if(!w){alert('No se pudo abrir ventana para PDF.');return;}
  w.document.open();w.document.write(html);w.document.close();
}

[elHistDesde, elHistHasta, elHistForma, elHistCliente].forEach(ctrl=>{
  ctrl.addEventListener('input',renderHistorial);
  ctrl.addEventListener('change',renderHistorial);
});

elBtnHistLimpiar.addEventListener('click',()=>{
  elHistDesde.value='';
  elHistHasta.value='';
  elHistForma.value='';
  elHistCliente.value='';
  renderHistorial();
});

elBtnHistExportCsv.addEventListener('click',exportHistorialCsv);
elBtnHistExportPdf.addEventListener('click',exportHistorialPdf);

// ---------------------------
