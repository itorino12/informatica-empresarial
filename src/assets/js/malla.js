/* Malla curricular interactiva del Plan 07.
   Lee window.PLAN07 (generado en la compilación). Al elegir un curso resalta
   sus requisitos (cadena hacia atrás) y los cursos que habilita (hacia adelante). */
(function () {
  'use strict';
  var P = window.PLAN07, cont = document.getElementById('malla');
  if (!P || !cont) return;
  var dlg = document.getElementById('detalle-curso');
  var porSigla = {};
  P.cursos.forEach(function (c) { porSigla[c.sigla] = c; });

  // Cursos que dependen de cada sigla
  var dependientes = {};
  P.cursos.forEach(function (c) { (c.req || []).forEach(function (r) { (dependientes[r] = dependientes[r] || []).push(c.sigla); }); });

  function cadena(sigla, mapa, acc) {
    (mapa(sigla) || []).forEach(function (s) { if (!acc[s]) { acc[s] = 1; cadena(s, mapa, acc); } });
    return acc;
  }
  var botones = Array.prototype.slice.call(cont.querySelectorAll('.curso'));
  var seleccion = null;

  function limpiar() {
    cont.classList.remove('atenuar');
    botones.forEach(function (b) { b.classList.remove('foco', 'req', 'dep'); b.setAttribute('aria-pressed', 'false'); });
    seleccion = null;
    anunciar('');
  }
  function seleccionar(sigla) {
    if (seleccion === sigla) { limpiar(); return; }
    limpiar(); seleccion = sigla;
    var reqs = cadena(sigla, function (s) { return (porSigla[s] || {}).req; }, {});
    var deps = cadena(sigla, function (s) { return dependientes[s]; }, {});
    cont.classList.add('atenuar');
    botones.forEach(function (b) {
      var s = b.dataset.sigla;
      if (s === sigla) { b.classList.add('foco'); b.setAttribute('aria-pressed', 'true'); }
      else if (reqs[s]) b.classList.add('req');
      else if (deps[s]) b.classList.add('dep');
    });
    var c = porSigla[sigla];
    anunciar(c.nombre + ': ' + Object.keys(reqs).length + ' cursos previos en la cadena de requisitos y ' + Object.keys(deps).length + ' cursos que habilita.');
  }
  function anunciar(t) { var v = document.getElementById('malla-estado'); if (v) v.textContent = t; }

  function abrirDetalle(sigla) {
    var c = porSigla[sigla], a = P.areas[c.area];
    dlg.style.setProperty('--c', a.color);
    var html = '<button class="cerrar" type="button" aria-label="Cerrar">×</button><header><p>' + (c.optativo ? 'Optativo, ' : c.sigla + ', ') + a.nombre + '</p><h2 id="detalle-titulo">' + c.nombre + '</h2></header><div class="cuerpo">';
    if (c.desc) html += '<p>' + c.desc + '</p>';
    if (c.optativo) {
      var ops = P.optativos[c.area] || [];
      html += '<p>En este espacio la persona estudiante elige uno de estos cursos:</p><ul>' + ops.map(function (o) {
        return '<li><b>' + o.sigla + ' ' + o.nombre + '</b> (' + o.creditos + ' créditos; requisito: ' + o.req_alt + '). ' + o.desc +
          (o.programa ? ' <a href="' + o.programa.archivo + '" target="_blank" rel="noopener">Programa, ' + o.programa.ciclo + ' (PDF)</a>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    html += '<dl><dt>Ciclo</dt><dd>' + c.ciclo + '</dd><dt>Créditos</dt><dd>' + c.creditos + '</dd>';
    if (c.t !== undefined) html += '<dt>Horas semanales</dt><dd>' + c.t + ' de teoría y ' + c.p + ' de práctica</dd>';
    var req = c.req_alt || (c.req && c.req.length ? c.req.join(', ') : 'Ninguno');
    html += '<dt>Requisitos</dt><dd>' + req + '</dd>';
    var hab = (dependientes[sigla] || []).map(function (s) { return porSigla[s].optativo ? porSigla[s].nombre : s + ' ' + porSigla[s].nombre; });
    html += '<dt>Habilita</dt><dd>' + (hab.length ? hab.join(', ') : '—') + '</dd></dl>';
    if (!c.optativo && /^IF-/.test(c.sigla)) {
      html += c.programa
        ? '<p class="programa-curso"><a class="boton boton-primario" href="' + c.programa.archivo + '" target="_blank" rel="noopener">Ver el programa del curso<span class="visually-hidden"> (PDF, se abre en una pestaña nueva)</span></a><span class="small muted">Versión vigente: ' + c.programa.ciclo + ' · PDF de ' + c.programa.kb + ' kB</span></p>'
        : '<p class="programa-curso small muted">El programa se publicará cuando el curso se imparta por primera vez en el Plan 07.</p>';
    }
    html += '<p class="small muted" style="margin-top:16px">Cuando el requisito indica «o», el curso equivalente del Plan 01 también lo cumple.</p></div>';
    dlg.innerHTML = html;
    dlg.querySelector('.cerrar').addEventListener('click', function () { dlg.close(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  if (dlg) dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  botones.forEach(function (b) {
    b.addEventListener('click', function () { seleccionar(b.dataset.sigla); });
    b.addEventListener('dblclick', function () { abrirDetalle(b.dataset.sigla); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); abrirDetalle(b.dataset.sigla); } });
  });
  var ver = document.getElementById('ver-detalle');
  if (ver) ver.addEventListener('click', function () { if (seleccion) abrirDetalle(seleccion); else anunciar('Primero elija un curso en la malla.'); });

  // Filtro por área
  var filtros = Array.prototype.slice.call(document.querySelectorAll('[data-area-filtro]'));
  filtros.forEach(function (f) {
    f.addEventListener('click', function () {
      filtros.forEach(function (o) { o.setAttribute('aria-pressed', String(o === f)); });
      var area = f.dataset.areaFiltro; limpiar();
      if (area === 'todas') return;
      cont.classList.add('atenuar');
      botones.forEach(function (b) { if (b.dataset.area === area) b.classList.add('foco'); });
      anunciar('Mostrando el área ' + P.areas[area].nombre + '.');
    });
  });
  var limpiarBtn = document.getElementById('limpiar-malla');
  if (limpiarBtn) limpiarBtn.addEventListener('click', function () { limpiar(); filtros.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.areaFiltro === 'todas')); }); });

  // Abrir un curso por enlace: plan-de-estudios.html#curso-IF-0009
  var m = location.hash.match(/^#curso-(.+)$/);
  if (m && porSigla[decodeURIComponent(m[1])]) { seleccionar(decodeURIComponent(m[1])); }
})();
