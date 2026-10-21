/* Mi avance en el Plan 07 y simulador de traslado del Plan 01.
   Todo se calcula en el navegador; lo marcado se guarda en localStorage. */
(function () {
  var P = window.PLAN07, T = window.TRASLADO;
  if (!P || !document.getElementById('avance-ciclos')) return;

  var CLAVE = 'cie:avance07';
  var porSigla = {}, ordenCiclo = {};
  P.ciclos.forEach(function (c, i) { ordenCiclo[c.n] = i; });
  P.cursos.forEach(function (c) { porSigla[c.sigla] = c; });
  var anioDe = {}; P.ciclos.forEach(function (c) { anioDe[c.n] = c.anio; });
  var optNombre = {};
  Object.keys(P.optativos || {}).forEach(function (a) { (P.optativos[a] || []).forEach(function (o) { optNombre[o.sigla] = o.nombre; }); });
  var areaNombre = {}; Object.keys(P.areas || {}).forEach(function (a) { areaNombre[a] = P.areas[a].nombre; });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nombreCurso(s) {
    var c = porSigla[s]; if (c) return (s.indexOf('OPT-') === 0 ? '' : s + ' ') + c.nombre;
    return optNombre[s] ? s + ' ' + optNombre[s] : s;
  }
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) { return []; } }
  function guardar(lista) { try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) {} }

  /* ---------------- Mi avance ---------------- */
  var aprobados = {};
  leer().forEach(function (s) { if (porSigla[s]) aprobados[s] = true; });
  var botones = Array.prototype.slice.call(document.querySelectorAll('.av-curso'));

  function faltantes(s) { return (porSigla[s].req || []).filter(function (r) { return !aprobados[r]; }); }

  function pintar() {
    var cred = 0, n = 0, disp = [];
    P.cursos.forEach(function (c) {
      if (aprobados[c.sigla]) { cred += c.creditos; n++; }
      else if (faltantes(c.sigla).length === 0) disp.push(c);
    });
    botones.forEach(function (b) {
      var s = b.dataset.sigla, ok = !!aprobados[s], f = faltantes(s);
      b.setAttribute('aria-pressed', String(ok));
      b.classList.toggle('ok', ok);
      b.classList.toggle('disp', !ok && f.length === 0);
      b.classList.toggle('blq', !ok && f.length > 0);
      b.querySelector('.av-estado').textContent = ok ? 'Aprobado' : (f.length ? 'Faltan requisitos' : 'Puede matricularlo');
    });
    var pct = Math.round(cred / P.total_creditos * 100);
    document.getElementById('av-creditos').textContent = cred;
    document.getElementById('av-cursos').textContent = n;
    document.getElementById('av-disponibles').textContent = disp.length;
    document.getElementById('av-barra').style.width = pct + '%';
    document.getElementById('av-barra-etq').setAttribute('aria-label', pct + ' % del plan aprobado');
    disp.sort(function (a, b) { return ordenCiclo[a.ciclo] - ordenCiclo[b.ciclo]; });
    document.getElementById('av-lista-disp').innerHTML = disp.length
      ? disp.map(function (c) { return '<li>' + esc(nombreCurso(c.sigla)) + ' <span class="muted">(' + esc(c.ciclo) + ' ciclo, ' + c.creditos + ' créditos)</span></li>'; }).join('')
      : '<li>' + (n === P.cursos.length ? 'Completó todos los cursos del plan.' : 'Marque sus cursos aprobados.') + '</li>';
    guardar(Object.keys(aprobados));
  }

  function detalle(s) {
    var c = porSigla[s], req = c.req || [], f = faltantes(s);
    var txt = '<b>' + esc(nombreCurso(s)) + '</b> · ' + c.creditos + ' créditos · ' + esc(c.ciclo) + ' ciclo.<br>';
    if (s.indexOf('OPT-') === 0 && areaNombre[c.area]) {
      var ops = (P.optativos[c.area] || []).map(function (o) { return o.sigla + ' ' + o.nombre; });
      txt += 'Elija uno de: ' + esc(ops.join('; ')) + '.<br>';
    }
    txt += req.length ? 'Requisitos: ' + esc(req.map(nombreCurso).join('; ')) + '.' : 'Sin requisitos.';
    if (!aprobados[s] && f.length) txt += '<br><span class="estado-Parcial">Le falta: ' + esc(f.map(nombreCurso).join('; ')) + '.</span>';
    document.getElementById('av-detalle').innerHTML = txt;
  }

  botones.forEach(function (b) {
    b.addEventListener('click', function () {
      var s = b.dataset.sigla;
      if (aprobados[s]) delete aprobados[s]; else aprobados[s] = true;
      pintar(); detalle(s);
    });
    b.addEventListener('mouseenter', function () { detalle(b.dataset.sigla); });
    b.addEventListener('focus', function () { detalle(b.dataset.sigla); });
  });
  document.getElementById('av-limpiar').addEventListener('click', function () {
    if (!Object.keys(aprobados).length || confirm('¿Borrar todos los cursos marcados?')) { aprobados = {}; pintar(); }
  });
  pintar();

  /* ---------------- Simulador de traslado ---------------- */
  if (!T || !document.getElementById('tr-form')) return;
  var form = document.getElementById('tr-form');
  var checks = Array.prototype.slice.call(form.querySelectorAll('input[type=checkbox]'));
  var p01 = {}; T.plan01.forEach(function (c) { p01[c.sigla] = c; });
  var ANIO1 = { I: 1, II: 1 };
  var ultimo = [];

  function calcular() {
    var marcados = checks.filter(function (c) { return c.checked; }).map(function (c) { return p01[c.value]; });
    var caso = document.getElementById('tr-caso'), det = document.getElementById('tr-detalle');
    if (!marcados.length) { caso.innerHTML = '<p class="muted" style="margin:0">Marque sus cursos aprobados para ver el resultado.</p>'; det.innerHTML = ''; ultimo = []; return; }

    var conv = [], mant = [], sin = [], p07 = {}, usados = {};
    marcados.forEach(function (c) {
      if (c.tipo === 'sin') { sin.push(c); return; }
      var destino = c.p07;
      if (c.optativo) {   // ocupa el primer espacio libre de optativo de su área
        for (var i = 1; i <= 3; i++) { var slot = 'OPT-' + c.optativo + '-' + i; if (porSigla[slot] && !usados[slot]) { usados[slot] = c.p07; destino = slot; break; } }
      }
      p07[destino] = true;
      (c.tipo === 'convalida' ? conv : mant).push({ c: c, destino: destino });
    });

    // Caso según las reglas de transición de la resolución
    var anio1 = T.plan01.filter(function (c) { return ANIO1[c.ciclo]; });
    var todoAnio1 = anio1.every(function (c) { return marcados.indexOf(c) > -1; });
    var conAnio2 = marcados.some(function (c) { return !ANIO1[c.ciclo] && c.ciclo !== 'Optativos'; });
    var cls, titulo, texto;
    if (!conAnio2) {
      cls = 'tr-verde'; titulo = 'Puede solicitar el traslado';
      texto = 'Según la resolución, quien no ha aprobado cursos de segundo año, o tiene aprobado todo el primer año, puede trasladarse al Plan 07 firmando el consentimiento informado.';
    } else if (!todoAnio1) {
      cls = 'tr-amarillo'; titulo = 'Requiere estudio de expediente';
      texto = 'Debe cursos de primer año y tiene aprobados cursos de segundo año en adelante: puede trasladarse, pero la unidad académica debe estudiar su expediente antes de que firme el consentimiento informado.';
    } else {
      cls = 'tr-rojo'; titulo = 'No se recomienda el traslado';
      texto = 'Tiene avance desde segundo año en adelante. La resolución no recomienda el traslado; si lo solicita, la unidad académica estudia su expediente. Recuerde que el Plan 01 se ofrece hasta el III ciclo 2029.';
    }

    var cred = 0, nAprob = 0, pend = { 1: [], 2: [], 3: [], 4: [] };
    P.cursos.forEach(function (c) {
      if (p07[c.sigla]) { cred += c.creditos; nAprob++; } else pend[anioDe[c.ciclo]].push(c);
    });

    caso.className = 'caja tr-caso ' + cls;
    caso.innerHTML = '<p class="tr-titulo">' + titulo + '</p><p class="small" style="margin:0 0 10px">' + texto + '</p>' +
      '<p style="margin:0"><b>' + nAprob + '</b> de ' + P.cursos.length + ' espacios del Plan 07 reconocidos · <b>' + cred + '</b> de ' + P.total_creditos + ' créditos.</p>';

    function lista(t, items) { return items.length ? '<h3 class="tr-h">' + t + ' <span class="muted small">(' + items.length + ')</span></h3><ul class="lista-marcas small">' + items.join('') + '</ul>' : ''; }
    function destinoTxt(d, original) {
      if (d.indexOf('OPT-') === 0) { var c = porSigla[d]; return esc(original + ' ' + (optNombre[original] || '')) + ' <span class="muted">(optativo de ' + esc(areaNombre[c.area] || c.area) + ')</span>'; }
      return esc(nombreCurso(d));
    }
    var html = '';
    html += lista('Se reconocen en el Plan 07', conv.map(function (x) { return '<li>' + esc(x.c.sigla + ' ' + x.c.nombre) + ' → ' + destinoTxt(x.destino, x.c.p07) + '</li>'; }));
    html += lista('Se mantienen igual', mant.map(function (x) { return '<li>' + (x.destino.indexOf('OPT-') === 0 ? destinoTxt(x.destino, x.c.p07) : esc(nombreCurso(x.destino))) + '</li>'; }));
    html += lista('No tienen equivalente en el Plan 07', sin.map(function (c) { return '<li>' + esc(c.sigla + ' ' + c.nombre) + (c.nota ? ' <span class="muted">— ' + esc(c.nota) + '</span>' : '') + '</li>'; }));
    var p12 = pend[1].concat(pend[2]);
    html += lista('Le quedarían pendientes de primero y segundo año', p12.map(function (c) { return '<li>' + esc(nombreCurso(c.sigla)) + ' <span class="muted">(' + esc(c.ciclo) + ' ciclo)</span></li>'; }));
    var n34 = pend[3].length + pend[4].length;
    if (n34) html += '<p class="small">Además, ' + n34 + ' espacios de tercer y cuarto año.</p>';
    html += '<p><button type="button" class="boton" id="tr-usar">Llevar este resultado a Mi avance</button></p>';
    det.innerHTML = html;
    ultimo = Object.keys(p07);
    document.getElementById('tr-usar').addEventListener('click', function () {
      if (Object.keys(aprobados).length && !confirm('Esto reemplaza lo que tiene marcado en Mi avance. ¿Continuar?')) return;
      aprobados = {}; ultimo.forEach(function (s) { if (porSigla[s]) aprobados[s] = true; });
      pintar();
      document.getElementById('avance').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('h-avance').setAttribute('tabindex', '-1'); document.getElementById('h-avance').focus({ preventScroll: true });
    });
  }

  form.addEventListener('change', calcular);
  document.getElementById('tr-ano1').addEventListener('click', function () { checks.forEach(function (c) { if (ANIO1[p01[c.value].ciclo]) c.checked = true; }); calcular(); });
  document.getElementById('tr-limpiar').addEventListener('click', function () { checks.forEach(function (c) { c.checked = false; }); calcular(); });
})();
