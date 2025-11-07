function setCanvasWidth(id){
  const c = document.getElementById(id);
  if(!c) return;
  // iguala el ancho del lienzo al ancho real del card
  c.width = c.clientWidth;
}

// Llama esto ANTES de dibujar:
setCanvasWidth('db_chart_7d');
setCanvasWidth('db_chart_pago');
setCanvasWidth('db_chart_surtidos');

renderGrafica7d();
renderGraficaPago();
renderGraficaSurtidos();
