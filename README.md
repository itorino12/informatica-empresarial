# Sitio web de Informática Empresarial: Consejo de Carrera Intersedes (UCR)

Este sitio estático responde a dos compromisos institucionales:

- **Meta 5.2.3.1 del Plan Estratégico 2026–2030**: un sitio web que divulgue el quehacer académico, investigativo y de proyección social de toda la carrera.
- **Objetivo 1 del Compromiso de Mejora 2027–2030 (SINAES)**: información estandarizada para todas las sedes. Incluye malla curricular, créditos, información al estudiantado (criterio 1.1.2) y estrategia de comunicación.

## Contenido del paquete

```
cie-web/
├── build.py              Compilador (Python 3 + Jinja2)
├── README.md
├── nginx-cie.conf        Configuración de ejemplo para el servidor Ubuntu
├── src/
│   ├── data/             TODO EL CONTENIDO (JSON): aquí se edita
│   │   ├── site.json        nombre, correo, menú, cifras, URL base
│   │   ├── sedes.json       recintos, coordinaciones y coordenadas del mapa
│   │   ├── plan07.json      malla, cursos, optativos y comparación de planes
│   │   ├── noticias.json    noticias (una entrada por noticia)
│   │   ├── contenido.json   historia, acreditación, PEM, compromiso, registro, FAQ, charlas…
│   │   └── documentos.json  repositorio documental
│   ├── templates/        Plantillas HTML (una por página)
│   └── assets/           CSS, JS, tipografía autoalojada, logos
└── dist/                 SITIO LISTO PARA PUBLICAR (resultado de build.py)
```

## Páginas

| Página | Qué contiene |
|---|---|
| `index.html` | Portada con el mapa de los 10 recintos, accesos por perfil, noticias, agenda, Plan 07 y calidad |
| `carrera.html` | Propósito, aspiración, línea de tiempo 1986–2026, perfil profesional, mercado laboral, admisión |
| `plan-de-estudios.html` | Malla interactiva (requisitos y cursos que habilita), optativos, Plan 01 frente a Plan 07, transición |
| `sedes.html` | Mapa interactivo y coordinaciones por sede |
| `tramites.html` | Convalidaciones (instrumento 60/20/20, umbral del 80 %), información al estudiantado, FAQ |
| `docentes.html` | Registro Intersedes de Docentes Elegibles: convocatoria, fases, requisitos, áreas, matriz y desarrollo docente |
| `investigacion.html` | Cifras del PEM, proyectos destacados y formulario para reportar proyectos |
| `acreditacion.html` | Trayectoria ante SINAES, tablero del PEM, Compromiso 2027–2030 |
| `gobierno.html` | Consejo, estructura organizativa (CASR-8-2026), Plan Estratégico 2026–2030 y normativa |
| `simposio.html` | Simposio rotativo: ediciones XIII, XIV y XV |
| `graduados.html` | Charlas 2024–2026, consultas, posgrado |
| `noticias.html` | 15 noticias con filtro por categoría y enlace directo (`noticias.html#id`) |
| `documentos.html` | Repositorio con buscador y filtro por tipo |
| `contacto.html` | Formulario (prepara un correo) y coordinaciones |
| `accesibilidad.html`, `404.html` | Declaración de accesibilidad y página de error |

En todas las páginas hay buscador interno (tecla `/` o Ctrl+K), panel de accesibilidad (tamaño de texto, modo oscuro, alto contraste, subrayado de enlaces, detener animaciones, escala de grises), modo oscuro automático, diseño adaptable a móvil e impresión limpia.

**Calidad verificada:** 0 incumplimientos WCAG 2.x A/AA (axe-core 4.10) en las 15 páginas, en modo claro y oscuro. Sin desbordamiento horizontal a 390 px. Todos los enlaces internos y anclas son válidos. No hay errores de JavaScript.

## Cómo actualizar el contenido

1. Edite el JSON correspondiente en `src/data/`. Por ejemplo, para publicar una noticia agregue un objeto al inicio de `noticias.json`:
   ```json
   {"id": "sesion-18-2026", "fecha": "2026-10-16", "categoria": "Consejo",
    "titulo": "…", "resumen": "…", "cuerpo": ["Párrafo 1", "Párrafo 2"], "enlace": "docentes.html"}
   ```
2. Compile: `pip install jinja2` (solo la primera vez) y luego `python3 build.py`.
3. Revise localmente: `python3 build.py --servir` y abra http://localhost:8000
4. Publique el contenido de `dist/`.

Los documentos del repositorio tienen un campo `url`. Si está vacío, el sitio ofrece «Solicitar» por correo. Cuando un documento sea público, súbalo a `src/assets/docs/` y ponga `"url": "assets/docs/archivo.pdf"`.

## Publicación en el servidor `Informatica_Empresarial_Intersedes` (Ubuntu)

```bash
sudo apt update && sudo apt install -y nginx
sudo mkdir -p /var/www/cie && sudo chown $USER /var/www/cie
# desde su equipo:
rsync -avz --delete dist/ usuario@SERVIDOR:/var/www/cie/
# en el servidor:
sudo cp nginx-cie.conf /etc/nginx/sites-available/cie
sudo ln -s /etc/nginx/sites-available/cie /etc/nginx/sites-enabled/cie
sudo nginx -t && sudo systemctl reload nginx
```

Para HTTPS, solicite al Centro de Informática el certificado del dominio institucional, o use `certbot --nginx` si el dominio lo permite.

## Pendientes antes de publicar

Estos datos no estaban en el Drive revisado o necesitan confirmación. Se dejaron redactados de forma neutral, sin inventar cifras:

- [ ] **Dominio definitivo** (hoy `base_url` apunta a GitHub Pages; cambiarlo en `site.json`): reemplazar `DOMINIO-POR-DEFINIR` en `site.json` (`base_url`). Se usa en sitemap, canonical y Open Graph.
- [ ] **Convocatoria de elegibles 2026**: el enlace del formulario está en `site.json → formulario_elegibles` (se usa en la portada y en `docentes.html`). Al cerrar la convocatoria, cambiar el estado del evento en `contenido.json` y retirar o reemplazar el enlace. Verificar que el formulario pertenezca a una cuenta institucional.
- [ ] **Boletín 01-2026**: corregir antes de publicar el código IF0029, que está repetido para Ética (el correcto es IF0021) y para Sistemas Operativos.
- [ ] **Tiempo promedio de graduación y costos** (criterio SINAES 1.1.2): agregar el dato oficial en `tramites.html#informacion`.
- [ ] **Correo de Guápiles**: verificar si es `informaticaempresarial.rgu@` (cuenta con acceso al Drive del Consejo) o `.rug@` (como aparece en la lista de copia).
- [ ] **Ediciones I–XII del Simposio**: completar sedes, años y temas cuando se recupere el archivo.
- [ ] **Integración de comisiones**: no se publicaron nombres de las comisiones Curricular y de Autoevaluación porque la única fuente era de mayo de 2025. Confirmar la integración vigente y agregarla si se desea.
- [ ] **Fotografías**: el sitio funciona sin fotos (mapa y gráficos en SVG). Para agregarlas, usar imágenes con autorización de uso y texto alternativo.
- [ ] **Ficha profesiográfica**: la existente es de 2019 (Plan 01). Actualizarla al Plan 07 y enlazarla.

## Privacidad

Por decisión de diseño no se publican datos personales del estudiantado: nombres o carnés de convalidaciones, recursos ni casos individuales. Tampoco se publican nombres de personas oferentes del registro de elegibles; solo se muestran cifras agregadas.

## Mapa de sedes

La geografía del mapa (país, provincias, países vecinos y Lago de Nicaragua) proviene de **Natural Earth 1:10m**, de dominio público, y está recortada a Costa Rica en `geodatos/`. `build.py` la proyecta, recorta y simplifica en cada compilación; no hay que editar el SVG a mano. Las posiciones de los recintos salen de `lat`/`lng` en `src/data/sedes.json`, y la ubicación de las etiquetas, de `ETIQUETAS` en `build.py`. El rombo central representa al Consejo de Carrera Intersedes; su posición (`CONSEJO`) es simbólica.

Un recinto se puede enlazar directamente: `sedes.html#guapiles` abre la página de sedes con esa ficha seleccionada.

## Programas de curso

Cada curso de la malla del Plan 07 enlaza a su programa vigente en PDF (versión oficial con logo).

- Los PDF están en `src/assets/programas/` con el nombre `IF0004_programa_II-2026.pdf`.
- `src/data/programas.json` indica, por sigla, qué archivo corresponde y de qué ciclo es.
- Para actualizar un programa cada ciclo: copie el PDF nuevo en `src/assets/programas/`, cambie la entrada en `programas.json` (archivo y ciclo), borre el PDF anterior y publique.
- Los cursos sin entrada muestran: «El programa se publicará cuando el curso se imparta por primera vez en el Plan 07».
- Origen: carpeta de planificación de cursos en Drive, subcarpetas «Programas de cursos … / Programas … oficiales - con Logo».

## Servidor de producción

- Dirección: https://informaticaempresarial.ucr.ac.cr (IP 163.178.170.75), máquina virtual «Informatica_Empresarial_Intersedes» en el vCenter de la UCR (CDI).
- Ubuntu 24.04 LTS, nginx, firewall ufw (SSH, 80 y 443), actualizaciones de seguridad automáticas.
- Código en `/opt/cie-web`; archivos publicados en `/var/www/cie`.
- Certificado HTTPS de Let's Encrypt (certbot), con renovación automática. Revisar con `sudo certbot renew --dry-run`.
- Acceso: `ssh gestion@163.178.170.75` desde la red de la UCR, o la consola del vCenter.
- Actualizar el sitio después de subir cambios a GitHub: `sudo bash /opt/cie-web/desplegar.sh`.
