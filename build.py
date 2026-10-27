#!/usr/bin/env python3
"""Compila el sitio estático de Informática Empresarial (Consejo de Carrera Intersedes, UCR).

Uso:
    python3 build.py            # genera ./dist
    python3 build.py --servir   # genera y sirve en http://localhost:8000

Todo el contenido vive en src/data/*.json. Para publicar una noticia, agregar un
documento o cambiar una coordinación, edite el JSON correspondiente y vuelva a compilar.
"""
import json, math, re, shutil, sys, html, hashlib
from datetime import date
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

RAIZ = Path(__file__).parent
SRC, DIST = RAIZ / "src", RAIZ / "dist"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]

PAGINAS = [
    # archivo, título, descripción, migas (padre)
    ("index.html", "Inicio", "Bachillerato en Informática Empresarial de la Universidad de Costa Rica: una carrera, diez sedes y recintos, coordinada por el Consejo de Carrera Intersedes.", None),
    ("carrera.html", "La carrera", "Historia, propósito, aspiración, perfil profesional y cómo ingresar al Bachillerato en Informática Empresarial.", None),
    ("plan-de-estudios.html", "Plan de estudios 07", "Malla curricular interactiva del Plan 07: 144 créditos, cinco áreas académicas, optativos por áreas de tendencia y plan de transición.", ("carrera.html", "La carrera")),
    ("ingreso.html", "Ingreso a la carrera", "Cómo ingresar al Bachillerato en Informática Empresarial: proceso de admisión de la UCR, recintos, cortes de ingreso y traslados.", ("carrera.html", "La carrera")),
    ("sedes.html", "Sedes y recintos", "Las diez sedes y recintos donde se imparte la carrera y sus coordinaciones.", ("carrera.html", "La carrera")),
    ("tramites.html", "Convalidaciones y trámites", "Cómo se analizan las convalidaciones y equiparaciones, información para el estudiantado y preguntas frecuentes.", None),
    ("mi-avance.html", "Mi avance y traslado de plan", "Marque los cursos aprobados para ver qué puede matricular en el Plan 07 y simule cómo se reconocen sus cursos del Plan 01.", ("tramites.html", "Estudiantes")),
    ("docentes.html", "Registro de docentes elegibles", "Proceso, áreas, requisitos y criterios del Registro Intersedes de Docentes Elegibles, y plan de desarrollo docente.", None),
    ("investigacion.html", "Investigación", "Proyectos de investigación y producción académica del personal docente de la carrera.", None),
    ("accion-social.html", "Acción social", "Trabajo Comunal Universitario, extensión docente y proyectos con comunidades de la carrera de Informática Empresarial en todas las regiones.", None),
    ("acreditacion.html", "Calidad y acreditación", "Trayectoria de acreditación ante SINAES y Proyecto Especial de Mejora.", ("gobierno.html", "Gestión de la carrera")),
    ("gobierno.html", "Gestión y gobierno", "Consejo de Carrera Intersedes, estructura organizativa, coordinaciones y Plan Estratégico 2026–2030.", None),
    ("simposio.html", "Simposio de Informática Empresarial", "El simposio anual que rota entre las sedes y reúne a toda la comunidad de la carrera.", None),
    ("graduados.html", "Población graduada", "Actividades de actualización profesional, consultas y vínculo con las personas graduadas de la carrera.", ("noticias.html", "Comunidad")),
    ("empleadores.html", "Empleadores y organizaciones", "Perfil de las personas graduadas y cómo recibir estudiantes en la Práctica Empresarial Supervisada de Informática Empresarial.", ("noticias.html", "Comunidad")),
    ("noticias.html", "Noticias", "Acuerdos del Consejo, logros y actividades de la carrera de Informática Empresarial.", None),
    ("documentos.html", "Repositorio de documentos", "Normativa, planes, protocolos e informes de la carrera de Informática Empresarial.", ("gobierno.html", "Gestión de la carrera")),
    ("contacto.html", "Contacto", "Escriba al Consejo de Carrera Intersedes o a la coordinación de su sede o recinto.", ("gobierno.html", "Gestión de la carrera")),
    ("accesibilidad.html", "Declaración de accesibilidad", "Compromiso de accesibilidad del sitio y herramientas disponibles.", None),
    ("404.html", "Página no encontrada", "La página que busca no existe o cambió de dirección.", None),
]

# ---------------------------------------------------------------------------
# Mapa de la red de sedes
# Geografía: Natural Earth 1:10m (dominio público), recortada a Costa Rica en
# geodatos/. Se proyecta, recorta y simplifica en cada compilación.
# ---------------------------------------------------------------------------
GEO = RAIZ / "geodatos"
CAJA = (-86.15, -82.45, 7.95, 11.32)          # lng mín, lng máx, lat mín, lat máx
K = 160.0                                      # píxeles por grado de latitud
COS = math.cos(math.radians(9.7))              # corrección de longitud a la latitud media
ANCHO, ALTO = round((CAJA[1] - CAJA[0]) * K * COS), round((CAJA[3] - CAJA[2]) * K)
CONSEJO = (9.93, -84.08)                       # punto simbólico del Consejo (sesiona de forma virtual)
ETIQUETAS = {  # desplazamiento de la etiqueta respecto al nodo: dx, dy, ancla
    "liberia": (12, -9, "start"), "pacifico": (-11, 20, "end"), "sanramon": (-12, -11, "end"),
    "grecia": (6, -15, "middle"), "guapiles": (0, -15, "middle"), "siquirres": (12, -7, "start"),
    "limon": (12, 17, "start"), "turrialba": (12, 17, "start"), "paraiso": (-12, 19, "end"), "sur": (12, 4, "start"),
}
ROTULOS = [  # (texto, lat, lng, clase)
    ("NICARAGUA", 11.20, -84.95, "pais"), ("PANAMÁ", 8.55, -82.62, "pais"),
    ("Mar Caribe", 10.55, -82.95, "mar"), ("Océano Pacífico", 8.45, -85.45, "mar"),
]


def proyectar(lat, lng):
    return ((lng - CAJA[0]) * K * COS, (CAJA[3] - lat) * K)


def recortar(anillo, x0=-30, y0=-30, x1=None, y1=None):
    """Sutherland–Hodgman contra el rectángulo del lienzo."""
    x1 = ANCHO + 30 if x1 is None else x1
    y1 = ALTO + 30 if y1 is None else y1
    bordes = [(lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
              (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
              (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
              (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1))]
    salida = anillo
    for dentro, cruce in bordes:
        entrada, salida = salida, []
        if not entrada:
            break
        prev = entrada[-1]
        for p in entrada:
            if dentro(p):
                if not dentro(prev):
                    salida.append(cruce(prev, p))
                salida.append(p)
            elif dentro(prev):
                salida.append(cruce(prev, p))
            prev = p
    return salida


def simplificar(pts, tol):
    """Douglas–Peucker iterativo."""
    if len(pts) < 4:
        return pts
    marcar = [False] * len(pts)
    marcar[0] = marcar[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        i, j = pila.pop()
        (ax, ay), (bx, by) = pts[i], pts[j]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-9
        mejor, idx = 0, None
        for k in range(i + 1, j):
            d = abs(dy * (pts[k][0] - ax) - dx * (pts[k][1] - ay)) / n
            if d > mejor:
                mejor, idx = d, k
        if idx is not None and mejor > tol:
            marcar[idx] = True
            pila += [(i, idx), (idx, j)]
    return [p for p, m in zip(pts, marcar) if m]


def trazo(geom, tol=0.45, area_min=2.0):
    """GeoJSON (Polygon/MultiPolygon) → atributo d de SVG, ya proyectado, recortado y simplificado."""
    poligonos = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    partes = []
    for poligono in poligonos:
        for anillo in poligono:
            pts = recortar([proyectar(lat, lng) for lng, lat in anillo])
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) < 3:
                continue
            area = abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2
            if area < area_min:
                continue
            # anillo cerrado: se parte en el vértice más lejano al inicio y se simplifica cada mitad
            m = max(range(len(pts)), key=lambda k: (pts[k][0] - pts[0][0]) ** 2 + (pts[k][1] - pts[0][1]) ** 2)
            pts = simplificar(pts[:m + 1], tol)[:-1] + simplificar(pts[m:] + [pts[0]], tol)[:-1]
            if len(pts) >= 3:
                partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
    return "".join(partes)


def construir_red(sedes):
    leer = lambda n: json.loads((GEO / f"{n}.geojson").read_text(encoding="utf-8"))["features"]
    paises = {f["properties"]["ADM0_A3"]: f["geometry"] for f in leer("paises")}
    vecinos = trazo(paises["NIC"], 0.8) + trazo(paises["PAN"], 0.8)
    pais = trazo(paises["CRI"], 0.4)
    lagos = "".join(trazo(f["geometry"], 0.8) for f in leer("lagos"))
    provincias = sorted(({"nombre": f["properties"]["name"], "d": trazo(f["geometry"], 0.45)}
                         for f in leer("provincias")), key=lambda p: p["nombre"])
    hx, hy = proyectar(*CONSEJO)
    nodos, arcos = [], []
    for i, s in enumerate(sedes):
        x, y = proyectar(s["lat"], s["lng"])
        dx, dy, ancla = ETIQUETAS.get(s["id"], (12, 4, "start"))
        nodos.append({**s, "x": round(x, 1), "y": round(y, 1), "lx": round(x + dx, 1), "ly": round(y + dy, 1),
                      "ancla": ancla, "i": i})
        # arco suave del recinto al Consejo: control desplazado en perpendicular
        mx, my = (x + hx) / 2, (y + hy) / 2
        vx, vy = hx - x, hy - y
        largo = math.hypot(vx, vy) or 1
        curva = min(38, largo * 0.22)
        cx, cy = mx - vy / largo * curva, my + vx / largo * curva
        arcos.append({"id": s["id"], "i": i, "l": round(largo * 1.08),
                      "d": f"M{x:.1f},{y:.1f}Q{cx:.1f},{cy:.1f} {hx:.1f},{hy:.1f}"})
    rotulos = [{"t": t, "x": round(proyectar(la, ln)[0], 1), "y": round(proyectar(la, ln)[1], 1), "c": c}
               for t, la, ln, c in ROTULOS]
    return {"vecinos": vecinos, "pais": pais, "lagos": lagos, "provincias": provincias, "nodos": nodos,
            "arcos": arcos, "rotulos": rotulos, "hub": {"x": round(hx, 1), "y": round(hy, 1)},
            "ancho": ANCHO, "alto": ALTO}


def fecha_larga(iso):
    d = date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def dia(iso): return str(date.fromisoformat(iso).day)
def mes_corto(iso): d = date.fromisoformat(iso); return f"{MESES_CORTOS[d.month - 1]} {d.year}"


def miles(n):
    """2383 -> '2 383' con espacio duro, como en los documentos de la UCR."""
    return f"{int(n):,}".replace(",", "\u00a0")


def iniciales(nombre):
    partes = [p for p in re.sub(r"^(MSc\.|Mag\.|Dra\.|Dr\.|MCi\.|Licda\.|Lic\.)\s*", "", nombre).split() if p[0].isupper()]
    return (partes[0][0] + (partes[1][0] if len(partes) > 1 else "")).upper()


def texto_plano(h):
    m = re.search(r"<main[^>]*>(.*)</main>", h, re.S)
    h = m.group(1) if m else h
    h = re.sub(r"<(script|style|svg|dialog)[^>]*>.*?</\1>", " ", h, flags=re.S)
    h = re.sub(r'<nav class="(migas|indice)".*?</nav>', " ", h, flags=re.S)
    h = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(h)).strip()


def entradas_busqueda(salida, archivo, titulo):
    """Una entrada por página (inicio del texto) y otra por cada sección con id,
    para que el buscador encuentre contenido largo y enlace directo a la sección."""
    m = re.search(r"<main[^>]*>(.*)</main>", salida, re.S)
    cuerpo = m.group(1) if m else salida
    cortes = [(x.start(), x.group(1)) for x in re.finditer(r'<section\b[^>]*\bid="([^"]+)"', cuerpo)]
    inicio = cortes[0][0] if cortes else len(cuerpo)
    entradas = [{"t": titulo, "u": archivo, "x": texto_plano("<main>" + cuerpo[:inicio] + "</main>")[:3000]
                 or texto_plano(salida)[:3000]}]
    for i, (pos, ident) in enumerate(cortes):
        fin = cortes[i + 1][0] if i + 1 < len(cortes) else len(cuerpo)
        trozo = cuerpo[pos:fin]
        h = re.search(r"<h[2-4][^>]*>(.*?)</h[2-4]>", trozo, re.S)
        if not h:
            continue
        sub = texto_plano("<main>" + h.group(1) + "</main>")
        texto = texto_plano("<main>" + trozo + "</main>")
        if len(texto) < 40:
            continue
        entradas.append({"t": f"{sub} · {titulo}", "u": f"{archivo}#{ident}", "x": texto[:8000]})
    return entradas


def sin_pendientes(x):
    """Quita de cualquier lista los elementos marcados con "publicar": false.
    Sirve para dejar contenido en espera (p. ej., hasta que salga una resolución) sin borrarlo."""
    if isinstance(x, dict):
        return {k: sin_pendientes(v) for k, v in x.items()}
    if isinstance(x, list):
        return [sin_pendientes(v) for v in x if not (isinstance(v, dict) and v.get("publicar") is False)]
    return x


def main():
    datos = {n: sin_pendientes(json.loads((SRC / "data" / f"{n}.json").read_text(encoding="utf-8")))
             for n in ["site", "sedes", "plan07", "noticias", "contenido", "documentos", "programas", "traslado"]}
    # Las noticias con fecha futura quedan programadas: se publican en el primer build desde esa fecha.
    datos["noticias"] = [n for n in datos["noticias"] if n["fecha"] <= date.today().isoformat()]
    datos["noticias"].sort(key=lambda n: n["fecha"], reverse=True)
    red = construir_red(datos["sedes"])

    # versión de recursos: cambia cuando cambia cualquier fuente, y obliga al navegador a descargar CSS y JS nuevos
    huella = hashlib.sha1()
    for f in sorted(list(SRC.rglob("*")) + list(GEO.glob("*"))):
        if f.is_file():
            huella.update(f.read_bytes())
    version = huella.hexdigest()[:10]

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC / "assets", DIST / "assets")
    # archivos que deben quedar en la raíz del sitio (verificación de Google Search Console, etc.)
    if (SRC / "raiz").is_dir():
        for f in (SRC / "raiz").iterdir():
            if f.is_file():
                shutil.copy2(f, DIST / f.name)

    env = Environment(loader=FileSystemLoader(SRC / "templates"), autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    env.filters.update(fecha_larga=fecha_larga, dia=dia, mes_corto=mes_corto, iniciales=iniciales, miles=miles)
    env.globals.update(site=datos["site"], hoy=date.today().isoformat())

    # programa vigente de cada curso (src/data/programas.json → PDF en assets/programas/)
    progs = datos["programas"]
    for c in datos["plan07"]["cursos"]:
        if c["sigla"] in progs:
            c["programa"] = progs[c["sigla"]]
    for lista in datos["plan07"]["optativos"].values():
        for o in lista:
            if o["sigla"] in progs:
                o["programa"] = progs[o["sigla"]]

    js_datos = ("window.PLAN07=" + json.dumps(datos["plan07"], ensure_ascii=False) + ";\n" +
                "window.SEDES=" + json.dumps(datos["sedes"], ensure_ascii=False) + ";\n" +
                "window.TRASLADO=" + json.dumps(datos["traslado"], ensure_ascii=False) + ";\n")
    (DIST / "assets/js/datos.js").write_text(js_datos, encoding="utf-8")

    indice = []
    for archivo, titulo, desc, padre in PAGINAS:
        plantilla = env.get_template(archivo)
        salida = plantilla.render(pagina=archivo, titulo=titulo, descripcion=desc, padre=padre, red=red, **datos)
        salida = re.sub(r'(assets/(?:css|js)/[\w.-]+\.(?:css|js))"', rf'\1?v={version}"', salida)
        (DIST / archivo).write_text(salida, encoding="utf-8")
        if archivo not in ("404.html",):
            indice.extend(entradas_busqueda(salida, archivo, titulo))
        print(f"  ✓ {archivo}")

    for n in datos["noticias"]:
        indice.append({"t": n["titulo"], "u": f"noticias.html#{n['id']}", "x": " ".join([n["resumen"]] + n["cuerpo"])})
    for c in datos["plan07"]["cursos"]:
        if c["sigla"].startswith("IF"):
            indice.append({"t": f"{c['sigla']} {c['nombre']}", "u": f"plan-de-estudios.html#curso-{c['sigla']}",
                           "x": f"Curso del Plan 07, ciclo {c['ciclo']}, {c['creditos']} créditos. {c.get('desc', '')}"})
    for area, lista in datos["plan07"]["optativos"].items():
        for o in lista:
            indice.append({"t": f"{o['sigla']} {o['nombre']} (optativo)", "u": "plan-de-estudios.html#optativos",
                           "x": f"Curso optativo del área {datos['plan07']['areas'][area]['nombre']}, {o['creditos']} créditos. {o['desc']}"})
    (DIST / "assets/js/indice-busqueda.js").write_text(
        "window.INDICE_BUSQUEDA=" + json.dumps(indice, ensure_ascii=False) + ";", encoding="utf-8")

    base = datos["site"]["base_url"].rstrip("/")
    urls = "\n".join(f"  <url><loc>{base}/{a if a != 'index.html' else ''}</loc><lastmod>{datos['site']['actualizado']}</lastmod></url>"
                     for a, *_ in PAGINAS if a != "404.html")
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n', encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    print(f"Listo: {len(PAGINAS)} páginas y {len(indice)} entradas de búsqueda en {DIST}")

    if "--servir" in sys.argv:
        import http.server, socketserver, functools
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
        with socketserver.TCPServer(("", 8000), h) as srv:
            print("Sirviendo en http://localhost:8000 (Ctrl+C para detener)")
            srv.serve_forever()


if __name__ == "__main__":
    main()
