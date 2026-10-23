/* Aplica tema y tamaño guardados antes de pintar para evitar parpadeos.
   Va como archivo externo (sin defer) para que la CSP no necesite 'unsafe-inline' en los scripts. */
(function(){try{var r=document.documentElement,t=localStorage.getItem('cie:theme');
  if(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)t='dark';
  if(t)r.setAttribute('data-theme',t);var e=localStorage.getItem('cie:escala');if(e)r.style.setProperty('--escala',e);}catch(e){}})();
