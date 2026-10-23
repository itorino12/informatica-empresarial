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

  /* ---------- Mapa de sedes (portada y página de sedes) ---------- */
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  $$('[data-mapa]').forEach(function (mapa) {
    var datos = JSON.parse($('.mapa-datos', mapa).textContent);
    var porId = {}; datos.forEach(function (s) { porId[s.id] = s; });
    var modo = mapa.dataset.modo;
    var svg = $('svg', mapa), lienzo = $('.mapa-lienzo-svg', mapa), tip = $('.mapa-tip', mapa);
    var ficha = document.getElementById(mapa.dataset.ficha);
    var fichaInterna = ficha && ficha.classList.contains('mapa-ficha');
    var actual = null;
    // al terminar la animación de entrada se quita la clase para que los estados (atenuado, flujo) tomen el control
    var finAnim = function () { svg.classList.remove('red-anim'); };
    if (svg.classList.contains('red-anim')) setTimeout(finAnim, 2600);

    function marcar(id, clase) {
      $$('.nodo', svg).forEach(function (n) { n.classList.toggle(clase, n.dataset.id === id); });
      $$('.arco', svg).forEach(function (a) { a.classList.toggle(clase, a.dataset.id === id); });
      var prov = id ? porId[id].provincia : null;
      $$('.prov', svg).forEach(function (p) { p.classList.toggle(clase, p.dataset.prov === prov); });
    }

    function poblacionCompacta(s) {
      var p = s.poblacion; if (!p) return '';
      return '<dl class="ficha-cifras"><div><dt>Activos</dt><dd>' + miles(p.activos) + '</dd></div>' +
        '<div><dt>Graduados</dt><dd>' + (p.graduados == null ? '<span title="Incluidos en el Recinto de Limón">—</span>' : miles(p.graduados)) + '</dd></div>' +
        '<div><dt>Admisión 2026</dt><dd>' + miles(p.admision_2026) + '</dd></div></dl>';
    }
    function fotoFicha(s) {
      var f = s.foto; if (!f) return '';
      return '<figure class="ficha-foto"><img src="' + esc(f.base) + '-480.webp" srcset="' + esc(f.base) + '-480.webp 480w, ' + esc(f.base) + '-960.webp 960w" sizes="(max-width: 860px) 92vw, 380px" width="480" height="320" alt="' + esc(f.alt) + '"' + (f.pos ? ' style="object-position:' + esc(f.pos) + '"' : '') + ' decoding="async">' +
        (f.credito ? '<figcaption>Foto: ' + esc(f.credito) + '</figcaption>' : '') + '</figure>';
    }
    function contenidoFicha(s) {
      var encabezado = (s.recinto !== s.sede ? '<p class="ficha-sede-eyebrow">' + esc(s.sede) + '</p>' : '') + '<p class="ficha-titulo h3">' + esc(s.recinto) + '</p>';
      var correo = '<a href="mailto:' + esc(s.correo) + '">' + esc(s.correo) + '</a>';
      if (fichaInterna) {
        return '<button type="button" class="ficha-cerrar" aria-label="Cerrar ficha">×</button>' + fotoFicha(s) + encabezado +
          '<p class="ficha-meta">Provincia de ' + esc(s.provincia) + ' · imparte la carrera desde ' + esc(s.recinto_desde || s.sede_desde) + '</p>' +
          poblacionCompacta(s) +
          '<dl><dt>Coordinación</dt><dd>' + esc(s.coordinacion) + '</dd><dt>Correo</dt><dd>' + correo + '</dd></dl>' +
          '<p class="ficha-acciones"><a href="' + esc(s.web) + '" target="_blank" rel="noopener">' + (/^Recinto/.test(s.web_nombre) ? 'Ir al sitio del ' : 'Ir al sitio de la ') + esc(s.web_nombre) + '<span class="visually-hidden"> (pestaña nueva)</span></a></p>';
      }
      var pob = s.poblacion ? '<dl class="mini-poblacion" style="margin:14px 0 4px">' +
          '<div><dt>Activos</dt><dd>' + miles(s.poblacion.activos) + '</dd></div>' +
          '<div><dt>Graduados</dt><dd>' + (s.poblacion.graduados == null ? '—' : miles(s.poblacion.graduados)) + '</dd></div>' +
          '<div><dt>Admisión 2026</dt><dd>' + miles(s.poblacion.admision_2026) + '</dd></div></dl>' +
          '<p class="small muted" style="margin:0">Activos por plan: Plan 01, ' + miles(s.poblacion.activos_p01) + '; Plan 07, ' + miles(s.poblacion.activos_p07) + '.</p>' : '';
      return fotoFicha(s) + encabezado + (s.nota ? '<p class="small" style="margin:0">' + esc(s.nota) + '</p>' : '') + pob +
        '<dl><dt>Coordinación</dt><dd>' + esc(s.coordinacion) + '</dd><dt>Correo</dt><dd>' + correo + '</dd>' +
        '<dt>Provincia</dt><dd>' + esc(s.provincia) + '</dd><dt>La sede imparte la carrera desde</dt><dd>' + esc(s.sede_desde) + '</dd>' +
        (s.recinto_desde ? '<dt>Este recinto, desde</dt><dd>' + esc(s.recinto_desde) + '</dd>' : '') +
        '<dt>Sitio web</dt><dd><a href="' + esc(s.web) + '" target="_blank" rel="noopener">' + esc(s.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '<span class="visually-hidden"> (pestaña nueva)</span></a></dd></dl>' +
        '<p class="small" style="margin:16px 0 0"><a href="mailto:' + esc(s.correo) + '">Escribir a esta coordinación</a></p>';
    }

    function seleccionar(id, opciones) {
      opciones = opciones || {};
      finAnim();
      if (id && id === actual && !opciones.forzar) id = null;   // segundo toque: deselecciona
      actual = id;
      mapa.classList.toggle('con-sel', !!id);
      marcar(id, 'sel');
      $$('.chip-sede', mapa).forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.id === id ? 'true' : 'false'); });
      ocultarTip();
      if (!ficha) return;
      if (!id) {
        if (fichaInterna) ficha.hidden = true;
        if (modo === 'pagina' && location.hash) history.replaceState(null, '', location.pathname + location.search);
        return;
      }
      ficha.innerHTML = contenidoFicha(porId[id]);
      ficha.hidden = false;
      // reinicia la animación de entrada
      ficha.classList.remove('entra'); void ficha.offsetWidth; ficha.classList.add('entra');
      var cerrar = $('.ficha-cerrar', ficha);
      if (cerrar) cerrar.addEventListener('click', function () { var c = $('.chip-sede[data-id="' + actual + '"]', mapa); seleccionar(null); if (c) c.focus(); });
      if (modo === 'pagina') history.replaceState(null, '', '#' + id);
      if (opciones.desplazar) ficha.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function mostrarTip(id) {
      if (!tip) return;
      var s = porId[id], nodo = $('.nodo[data-id="' + id + '"] .punto', svg);
      tip.innerHTML = '<b>' + esc(s.recinto) + '</b><span>' + (s.recinto !== s.sede ? esc(s.sede) + ' · ' : '') + 'desde ' + esc(s.recinto_desde || s.sede_desde) + (s.poblacion ? ' · ' + miles(s.poblacion.activos) + ' estudiantes activos' : '') + '</span>';
      tip.hidden = false;
      var r = nodo.getBoundingClientRect(), base = lienzo.getBoundingClientRect();
      var x = r.left + r.width / 2 - base.left, y = r.top - base.top;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      // evita que se salga por los bordes
      var ancho = tip.offsetWidth;
      var izq = x - ancho / 2, der = x + ancho / 2, d = 0;
      if (izq < 4) d = 4 - izq; else if (der > base.width - 4) d = base.width - 4 - der;
      tip.style.setProperty('--desvio', d + 'px');
    }
    function ocultarTip() { if (tip) tip.hidden = true; }

    $$('.nodo', svg).forEach(function (n) {
      var id = n.dataset.id;
      n.addEventListener('click', function (e) { e.stopPropagation(); seleccionar(id, { desplazar: modo === 'pagina' && innerWidth < 860 }); });
      n.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; marcar(id, 'hover'); mapa.classList.add('con-hover'); if (id !== actual) mostrarTip(id); });
      n.addEventListener('pointerleave', function () { marcar(null, 'hover'); mapa.classList.remove('con-hover'); ocultarTip(); });
    });
    $$('.chip-sede', mapa).forEach(function (c) {
      c.addEventListener('click', function () { seleccionar(c.dataset.id); });
      c.addEventListener('pointerenter', function () { marcar(c.dataset.id, 'hover'); mapa.classList.add('con-hover'); });
      c.addEventListener('pointerleave', function () { marcar(null, 'hover'); mapa.classList.remove('con-hover'); });
    });
    // clic en el mar o en el país: cierra
    svg.addEventListener('click', function () { if (actual) seleccionar(null); });
    mapa.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && actual) { var c = $('.chip-sede[data-id="' + actual + '"]', mapa); seleccionar(null); if (c) c.focus(); }
    });
    // lista de la página de sedes
    $$('[data-ver-sede]').forEach(function (b) { b.addEventListener('click', function () { seleccionar(b.dataset.verSede, { forzar: true, desplazar: true }); }); });
    // enlace directo: sedes.html#guapiles
    if (modo === 'pagina') {
      var desdeHash = function () { var h = location.hash.slice(1); if (porId[h]) seleccionar(h, { forzar: true }); };
      desdeHash(); addEventListener('hashchange', desdeHash);
    }
  });

  /* ---------- Correo: selector de servicio ----------
     Un enlace mailto: no hace nada si el equipo no tiene una aplicación de correo configurada
     (lo común en Windows con Chrome). Por eso cada correo ofrece Gmail, Outlook, la aplicación
     del equipo o copiar la dirección. */
  var selector = document.createElement('div');
  selector.className = 'selector-correo'; selector.hidden = true;
  selector.setAttribute('role', 'dialog'); selector.setAttribute('aria-label', 'Escribir un correo');
  document.body.appendChild(selector);
  var origenSelector = null;

  function abrirSelector(destino, asunto, cuerpo, ancla) {
    var q = function (k, v) { return v ? k + '=' + encodeURIComponent(v) : ''; };
    var une = function (arr) { return arr.filter(Boolean).join('&'); };
    var gmail = 'https://mail.google.com/mail/?' + une(['view=cm', 'fs=1', q('to', destino), q('su', asunto), q('body', cuerpo)]);
    var outlook = 'https://outlook.office.com/mail/deeplink/compose?' + une([q('to', destino), q('subject', asunto), q('body', cuerpo)]);
    var mailto = 'mailto:' + destino + (asunto || cuerpo ? '?' + une([q('subject', asunto), q('body', cuerpo)]) : '');
    selector.innerHTML =
      '<p class="selector-correo-dir"><span>Escribir a</span><b>' + esc(destino) + '</b></p>' +
      '<a href="' + gmail + '" target="_blank" rel="noopener">Abrir en Gmail<span class="visually-hidden"> (pestaña nueva)</span></a>' +
      '<a href="' + outlook + '" target="_blank" rel="noopener">Abrir en Outlook<span class="visually-hidden"> (pestaña nueva)</span></a>' +
      '<a href="' + esc(mailto) + '" data-mailto-directo>Abrir en la aplicación de correo</a>' +
      '<button type="button" data-copiar>Copiar la dirección</button>' +
      '<button type="button" class="selector-cerrar" data-cerrar-selector>Cancelar</button>';
    selector.hidden = false;
    // posición: debajo del enlace, sin salirse de la pantalla
    var r = ancla.getBoundingClientRect(), ancho = selector.offsetWidth, alto = selector.offsetHeight;
    var x = Math.min(Math.max(8, r.left), innerWidth - ancho - 8);
    var y = r.bottom + 8; if (y + alto > innerHeight - 8) y = Math.max(8, r.top - alto - 8);
    selector.style.left = x + scrollX + 'px'; selector.style.top = y + scrollY + 'px';
    origenSelector = ancla;
    $('a', selector).focus();
    $('[data-copiar]', selector).addEventListener('click', function () {
      var btn = this;
      var listo = function () { btn.textContent = 'Dirección copiada'; setTimeout(cerrarSelector, 900); };
      if (navigator.clipboard) navigator.clipboard.writeText(destino).then(listo, function () { prompt('Copie la dirección:', destino); });
      else prompt('Copie la dirección:', destino);
    });
    $('[data-cerrar-selector]', selector).addEventListener('click', cerrarSelector);
    $$('a', selector).forEach(function (a) { a.addEventListener('click', function () { setTimeout(cerrarSelector, 50); }); });
  }
  function cerrarSelector() {
    if (selector.hidden) return;
    selector.hidden = true;
    if (origenSelector && document.contains(origenSelector)) origenSelector.focus();
    origenSelector = null;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (a && !a.hasAttribute('data-mailto-directo')) {
      e.preventDefault();
      var url = a.getAttribute('href').slice(7), partes = url.split('?'), params = new URLSearchParams(partes[1] || '');
      abrirSelector(decodeURIComponent(partes[0]), params.get('subject'), params.get('body'), a);
      return;
    }
    if (!selector.hidden && !selector.contains(e.target)) cerrarSelector();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !selector.hidden) { e.stopPropagation(); cerrarSelector(); } }, true);
  addEventListener('resize', cerrarSelector);

  /* ---------- Formulario de contacto ---------- */
  var form = $('#form-contacto');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form), err = $('#form-error');
    if (!d.get('nombre') || !d.get('correo') || !d.get('mensaje')) { err.hidden = false; err.textContent = 'Complete su nombre, su correo y el mensaje para preparar la consulta.'; return; }
    err.hidden = true;
    var asunto = '[' + d.get('tema') + '] Consulta de ' + d.get('nombre');
    var cuerpo = d.get('mensaje') + '\n\n' + d.get('nombre') + '\n' + d.get('correo') + (d.get('sede') ? '\nSede o recinto: ' + d.get('sede') : '');
    abrirSelector(form.dataset.destino, asunto, cuerpo, $('button[type="submit"], [type="submit"]', form) || form);
    $('#form-ok').hidden = false;
  });

  /* ---------- Volver arriba ---------- */
  var subir = $('.subir');
  if (subir) {
    window.addEventListener('scroll', function () { subir.classList.toggle('visible', window.scrollY > 900); }, { passive: true });
    subir.addEventListener('click', function () { window.scrollTo({ top: 0 }); $('#contenido').focus({ preventScroll: true }); });
  }

  /* La franja de aviso se oculta sola al vencer, aunque no se haya vuelto a compilar el sitio */
  document.querySelectorAll('[data-fin]').forEach(function (el) {
    var fin = Date.parse(el.getAttribute('data-fin'));
    if (!isNaN(fin) && Date.now() > fin) el.hidden = true;
  });
})();
