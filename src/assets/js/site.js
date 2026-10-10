/* Informática Empresarial · comportamiento común del sitio
   Sin dependencias. Toda preferencia se guarda en localStorage dentro de try/catch. */
(function () {
  'use strict';
  var raiz = document.documentElement;

  function guardar(k, v) { try { localStorage.setItem('cie:' + k, v); } catch (e) {} }
  function leer(k) { try { return localStorage.getItem('cie:' + k); } catch (e) { return null; } }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function normalizar(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* ---------- Preferencias de accesibilidad ---------- */
  var prefs = {
    escala: { atributo: null, valores: ['0.9', '1', '1.15', '1.3'] },
    theme: { atributo: 'data-theme', valores: ['light', 'dark'] },
    contrast: { atributo: 'data-contrast', valores: ['normal', 'high'] },
    links: { atributo: 'data-links', valores: ['normal', 'underline'] },
    motion: { atributo: 'data-motion', valores: ['normal', 'reduce'] },
    filter: { atributo: 'data-filter', valores: ['none', 'gray'] }
  };
  function aplicar(k, v) {
    if (k === 'escala') raiz.style.setProperty('--escala', v);
    else raiz.setAttribute(prefs[k].atributo, v);
    $$('[data-pref="' + k + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.valor === v)); });
  }
  Object.keys(prefs).forEach(function (k) {
    var v = leer(k);
    if (!v) v = k === 'escala' ? '1' : (k === 'theme' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : prefs[k].valores[0]);
    aplicar(k, v);
  });
  $$('[data-pref]').forEach(function (b) {
    b.addEventListener('click', function () { aplicar(b.dataset.pref, b.dataset.valor); guardar(b.dataset.pref, b.dataset.valor); });
  });
  var restablecer = $('#restablecer-preferencias');
  if (restablecer) restablecer.addEventListener('click', function () {
    Object.keys(prefs).forEach(function (k) { try { localStorage.removeItem('cie:' + k); } catch (e) {} });
    aplicar('escala', '1'); aplicar('theme', 'light'); aplicar('contrast', 'normal'); aplicar('links', 'normal'); aplicar('motion', 'normal'); aplicar('filter', 'none');
  });

  /* ---------- Paneles laterales ---------- */
  var velo = $('.velo'), ultimoFoco = null;
  function abrirPanel(p) {
    ultimoFoco = document.activeElement;
    p.classList.add('abierto'); p.setAttribute('aria-hidden', 'false'); velo.classList.add('visible');
    var f = p.querySelector('button, a, input'); if (f) f.focus();
  }
  function cerrarPaneles() {
    $$('.panel.abierto').forEach(function (p) { p.classList.remove('abierto'); p.setAttribute('aria-hidden', 'true'); });
    velo.classList.remove('visible'); cerrarBusqueda();
    if (ultimoFoco) ultimoFoco.focus();
  }
  $$('[data-abrir-panel]').forEach(function (b) {
    b.addEventListener('click', function () { abrirPanel(document.getElementById(b.dataset.abrirPanel)); });
  });
  $$('[data-cerrar-panel]').forEach(function (b) { b.addEventListener('click', cerrarPaneles); });
  if (velo) velo.addEventListener('click', cerrarPaneles);

  /* ---------- Menú principal ---------- */
  var botonMenu = $('.boton-menu'), nav = $('.nav-principal');
  if (botonMenu) botonMenu.addEventListener('click', function () {
    var abierto = nav.classList.toggle('abierto');
    botonMenu.setAttribute('aria-expanded', String(abierto));
  });
  $$('.desplegar').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var exp = b.getAttribute('aria-expanded') === 'true';
      $$('.desplegar').forEach(function (o) { if (o !== b) o.setAttribute('aria-expanded', 'false'); });
      b.setAttribute('aria-expanded', String(!exp));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-principal')) $$('.desplegar').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $$('.desplegar[aria-expanded="true"]').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); o.focus(); });
      cerrarPaneles();
    }
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName))) {
      e.preventDefault(); abrirBusqueda();
    }
  });

  /* ---------- Búsqueda en el sitio ---------- */
  var capa = $('.busqueda'), entrada = $('#q'), lista = $('.resultados');
  function abrirBusqueda() { if (!capa) return; ultimoFoco = document.activeElement; capa.classList.add('abierta'); entrada.focus(); buscar(); }
  function cerrarBusqueda() { if (capa) capa.classList.remove('abierta'); }
  $$('[data-abrir-busqueda]').forEach(function (b) { b.addEventListener('click', abrirBusqueda); });
  if (capa) capa.addEventListener('click', function (e) { if (e.target === capa) cerrarPaneles(); });
  function resaltar(texto, terminos) {
    var t = texto.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
    terminos.forEach(function (w) {
      if (w.length < 3) return;
      var clases = { a: '[aáà]', e: '[eéè]', i: '[iíì]', o: '[oóò]', u: '[uúüù]', n: '[nñ]' };
      var re = new RegExp('(' + w.split('').map(function (ch) { return clases[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('') + ')', 'gi');
      t = t.replace(re, '<mark>$1</mark>');
    });
    return t;
  }
  function buscar() {
    if (!lista) return;
    var q = normalizar(entrada.value.trim());
    var idx = window.INDICE_BUSQUEDA || [];
    if (!q) { lista.innerHTML = '<li class="vacio">Escriba al menos una palabra. Por ejemplo: convalidación, Plan 07, simposio o elegibles.</li>'; return; }
    var terms = q.split(/\s+/);
    var res = idx.map(function (d) {
      var tt = normalizar(d.t), tx = normalizar(d.x), s = 0;
      terms.forEach(function (w) { if (tt.indexOf(w) > -1) s += 5; var i = tx.indexOf(w); if (i > -1) s += 1 + (tx.split(w).length - 1) * .2; });
      var todos = terms.every(function (w) { return tt.indexOf(w) > -1 || tx.indexOf(w) > -1; });
      return { d: d, s: todos ? s : 0 };
    }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
    if (!res.length) { lista.innerHTML = '<li class="vacio">No hay resultados para «' + entrada.value.replace(/</g, '') + '». Pruebe con otra palabra o revise el <a href="documentos.html">repositorio de documentos</a>.</li>'; return; }
    lista.innerHTML = res.map(function (r) {
      var d = r.d, nx = normalizar(d.x), pos = nx.indexOf(terms[0]);
      var ini = Math.max(0, pos - 60), frag = (ini > 0 ? '…' : '') + d.x.substr(ini, 180) + '…';
      return '<li><a href="' + d.u + '"><b>' + resaltar(d.t, terms) + '</b><span>' + resaltar(frag, terms) + '</span></a></li>';
    }).join('');
  }
  if (entrada) entrada.addEventListener('input', buscar);
  var formBusqueda = $('.busqueda form');
  if (formBusqueda) formBusqueda.addEventListener('submit', function (e) {
    e.preventDefault(); var a = lista.querySelector('a'); if (a) location.href = a.href;
  });

  /* ---------- Índice lateral con sección actual ---------- */
  var enlacesIndice = $$('.indice a');
  if (enlacesIndice.length && 'IntersectionObserver' in window) {
    var mapa = {};
    enlacesIndice.forEach(function (a) { mapa[a.hash.slice(1)] = a; });
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (en.isIntersecting && mapa[en.target.id]) {
          enlacesIndice.forEach(function (a) { a.classList.remove('actual'); });
          mapa[en.target.id].classList.add('actual');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(mapa).forEach(function (id) { var s = document.getElementById(id); if (s) obs.observe(s); });
  }

  /* ---------- Filtros por categoría (noticias, documentos) ---------- */
  $$('[data-filtros]').forEach(function (grupo) {
    var objetivo = document.getElementById(grupo.dataset.filtros);
    var botones = $$('.filtro', grupo);
    botones.forEach(function (b) {
      b.addEventListener('click', function () {
        botones.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        var v = b.dataset.valor;
        $$('[data-categoria]', objetivo).forEach(function (el) { el.hidden = !(v === 'todas' || el.dataset.categoria === v); });
      });
    });
  });

  /* ---------- Tabla de documentos ---------- */
  var tablaDocs = $('#tabla-documentos');
  if (tablaDocs) {
    var texto = $('#doc-texto'), tipo = $('#doc-tipo'), contador = $('#doc-contador');
    var filas = $$('tbody tr', tablaDocs);
    function filtrarDocs() {
      var q = normalizar(texto.value), t = tipo.value, n = 0;
      filas.forEach(function (f) {
        var ok = (!t || f.dataset.tipo === t) && (!q || normalizar(f.textContent).indexOf(q) > -1);
        f.hidden = !ok; if (ok) n++;
      });
      contador.textContent = n === 1 ? '1 documento' : n + ' documentos';
    }
    texto.addEventListener('input', filtrarDocs); tipo.addEventListener('change', filtrarDocs); filtrarDocs();
  }

  /* ---------- Mapa de sedes ---------- */
  var mapaSedes = $('[data-mapa-sedes]');
  if (mapaSedes && window.SEDES) {
    var ficha = $('#ficha-sede');
    function mostrarSede(id) {
      var s = window.SEDES.filter(function (x) { return x.id === id; })[0]; if (!s) return;
      $$('.nodo', mapaSedes).forEach(function (n) { n.classList.toggle('sel', n.dataset.id === id); });
      ficha.innerHTML = (s.recinto !== s.sede ? '<p class="muted small" style="margin:0">' + s.sede + '</p>' : '') + '<h3>' + s.recinto + '</h3>' +
        (s.nota ? '<p class="small" style="margin:0">' + s.nota + '</p>' : '') +
        '<dl><dt>Coordinación</dt><dd>' + s.coordinacion + '</dd><dt>Correo</dt><dd><a href="mailto:' + s.correo + '">' + s.correo + '</a></dd><dt>Correo</dt><dd><a href="mailto:' + s.correo + '">' + s.correo + '</a></dd><dt>Provincia</dt><dd>' + s.provincia + '</dd>' +
        '<dt>La sede imparte la carrera desde</dt><dd>' + s.sede_desde + '</dd></dl>' +
        '<p class="small" style="margin:16px 0 0"><a href="mailto:' + s.correo + '">Escribir a esta coordinación</a></p>';
    }
    $$('.nodo', mapaSedes).forEach(function (n) {
      n.addEventListener('click', function () { mostrarSede(n.dataset.id); });
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mostrarSede(n.dataset.id); } });
    });
    $$('[data-ver-sede]').forEach(function (b) { b.addEventListener('click', function () { mostrarSede(b.dataset.verSede); ficha.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); });
  }

  /* ---------- Formulario de contacto (abre el correo) ---------- */
  var form = $('#form-contacto');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form), err = $('#form-error');
    if (!d.get('nombre') || !d.get('correo') || !d.get('mensaje')) { err.hidden = false; err.textContent = 'Complete su nombre, su correo y el mensaje para preparar la consulta.'; return; }
    err.hidden = true;
    var asunto = '[' + d.get('tema') + '] Consulta de ' + d.get('nombre');
    var cuerpo = d.get('mensaje') + '\n\n' + d.get('nombre') + '\n' + d.get('correo') + (d.get('sede') ? '\nSede o recinto: ' + d.get('sede') : '');
    location.href = 'mailto:' + form.dataset.destino + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
    $('#form-ok').hidden = false;
  });

  /* ---------- Volver arriba ---------- */
  var subir = $('.subir');
  if (subir) {
    window.addEventListener('scroll', function () { subir.classList.toggle('visible', window.scrollY > 900); }, { passive: true });
    subir.addEventListener('click', function () { window.scrollTo({ top: 0 }); $('#contenido').focus({ preventScroll: true }); });
  }
})();
