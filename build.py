#!/usr/bin/env python3
"""Compila el sitio estático de Informática Empresarial (Consejo de Carrera Intersedes, UCR).

Uso:
    python3 build.py            # genera ./dist
    python3 build.py --servir   # genera y sirve en http://localhost:8000

Todo el contenido vive en src/data/*.json. Para publicar una noticia, agregar un
documento o cambiar una coordinación, edite el JSON correspondiente y vuelva a compilar.
"""
import json, math, re, shutil, sys, html
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
    ("sedes.html", "Sedes y recintos", "Las diez sedes y recintos donde se imparte la carrera y sus coordinaciones.", ("carrera.html", "La carrera")),
    ("tramites.html", "Convalidaciones y trámites", "Cómo se analizan las convalidaciones y equiparaciones, información para el estudiantado y preguntas frecuentes.", None),
    ("docentes.html", "Registro de docentes elegibles", "Proceso, áreas, requisitos y criterios del Registro Intersedes de Docentes Elegibles, y plan de desarrollo docente.", None),
    ("investigacion.html", "Investigación y acción social", "Proyectos de investigación, acción social y producción académica del personal docente de la carrera.", None),
    ("acreditacion.html", "Calidad y acreditación", "Trayectoria de acreditación ante SINAES, Proyecto Especial de Mejora y Compromiso de Mejora 2027–2030.", None),
    ("gobierno.html", "Gestión y gobierno", "Consejo de Carrera Intersedes, estructura organizativa, coordinaciones y Plan Estratégico 2026–2030.", None),
    ("simposio.html", "Simposio de Informática Empresarial", "El simposio anual que rota entre las sedes y reúne a toda la comunidad de la carrera.", ("noticias.html", "Comunidad")),
    ("graduados.html", "Población graduada", "Actividades de actualización profesional, consultas y vínculo con las personas graduadas de la carrera.", ("noticias.html", "Comunidad")),
    ("noticias.html", "Noticias", "Acuerdos del Consejo, logros y actividades de la carrera de Informática Empresarial.", None),
    ("documentos.html", "Repositorio de documentos", "Normativa, planes, protocolos e informes de la carrera de Informática Empresarial.", ("gobierno.html", "Consejo")),
    ("contacto.html", "Contacto", "Escriba al Consejo de Carrera Intersedes o a la coordinación de su sede o recinto.", ("gobierno.html", "Consejo")),
    ("accesibilidad.html", "Declaración de accesibilidad", "Compromiso de accesibilidad del sitio y herramientas disponibles.", None),
    ("404.html", "Página no encontrada", "La página que busca no existe o cambió de dirección.", None),
]

# Contorno simplificado de Costa Rica (lat, lng). Solo de referencia visual.
COSTA_RICA = [
    (11.07, -85.69), (11.12, -85.40), (11.20, -85.10), (11.08, -84.75), (10.95, -84.40), (10.80, -84.20),
    (10.75, -83.90), (10.93, -83.66), (10.70, -83.55), (10.45, -83.48), (10.20, -83.30), (10.00, -83.05),
    (9.78, -82.85), (9.57, -82.56), (9.48, -82.80), (9.25, -82.92), (8.95, -82.75), (8.60, -82.85),
    (8.32, -82.88), (8.03, -82.90), (8.35, -83.08), (8.62, -83.22), (8.45, -83.40), (8.38, -83.70),
    (8.66, -83.73), (9.00, -83.62), (9.25, -83.86), (9.42, -84.16), (9.62, -84.63), (9.80, -84.65),
    (9.98, -84.84), (10.20, -85.22), (9.95, -85.05), (9.82, -84.93), (9.56, -85.11), (9.88, -85.53),
    (10.00, -85.68), (10.30, -85.84), (10.55, -85.78), (10.80, -85.92), (10.95, -85.80), (11.07, -85.69),
]
ENLACES_RED = [("liberia", "pacifico"), ("liberia", "sanramon"), ("pacifico", "sanramon"), ("sanramon", "grecia"),
               ("grecia", "guapiles"), ("grecia", "paraiso"), ("paraiso", "turrialba"), ("turrialba", "guapiles"),
               ("guapiles", "siquirres"), ("siquirres", "limon"), ("turrialba", "siquirres"), ("pacifico", "sur"),
               ("paraiso", "sur"), ("turrialba", "limon")]
ETIQUETAS = {  # desplazamiento de la etiqueta respecto al nodo: dx, dy, ancla
    "liberia": (12, -10, "start"), "pacifico": (-12, 22, "end"), "sanramon": (-12, -12, "end"),
    "grecia": (4, -16, "middle"), "guapiles": (0, -16, "middle"), "siquirres": (12, -8, "start"),
    "limon": (12, 18, "start"), "turrialba": (12, 18, "start"), "paraiso": (-12, 20, "end"), "sur": (12, 4, "start"),
}


def proyectar(lat, lng, k=160.0):
    return round((lng + 86.05) * k * 0.9857, 1), round((11.35 - lat) * k, 1)


def suavizar(p, t=0.5):
    """Convierte la poligonal cerrada en curvas Catmull-Rom para un contorno menos anguloso."""
    n = len(p)
    d = f"M{p[0][0]},{p[0][1]}"
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = (round(p1[0] + (p2[0] - p0[0]) * t / 3, 1), round(p1[1] + (p2[1] - p0[1]) * t / 3, 1))
        c2 = (round(p2[0] - (p3[0] - p1[0]) * t / 3, 1), round(p2[1] - (p3[1] - p1[1]) * t / 3, 1))
        d += f" C{c1[0]},{c1[1]} {c2[0]},{c2[1]} {p2[0]},{p2[1]}"
    return d + " Z"


def construir_red(sedes):
    puntos = [proyectar(la, ln) for la, ln in COSTA_RICA]
    contorno = suavizar(puntos[:-1])
    nodos = []
    for i, s in enumerate(sedes):
        x, y = proyectar(s["lat"], s["lng"])
        dx, dy, ancla = ETIQUETAS.get(s["id"], (12, 4, "start"))
        nodos.append({**s, "x": x, "y": y, "lx": x + dx, "ly": y + dy, "ancla": ancla, "i": i})
    pos = {n["id"]: n for n in nodos}
    enlaces = []
    for i, (a, b) in enumerate(ENLACES_RED):
        A, B = pos[a], pos[b]
        largo = math.hypot(A["x"] - B["x"], A["y"] - B["y"])
        enlaces.append({"x1": A["x"], "y1": A["y"], "x2": B["x"], "y2": B["y"], "l": round(largo), "i": i})
    return {"contorno": contorno, "nodos": nodos, "enlaces": enlaces, "ancho": 575, "alto": 540}


def fecha_larga(iso):
    d = date.fromisoformat(iso)
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def dia(iso): return str(date.fromisoformat(iso).day)
def mes_corto(iso): d = date.fromisoformat(iso); return f"{MESES_CORTOS[d.month - 1]} {d.year}"


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


def main():
    datos = {n: json.loads((SRC / "data" / f"{n}.json").read_text(encoding="utf-8"))
             for n in ["site", "sedes", "plan07", "noticias", "contenido", "documentos"]}
    datos["noticias"].sort(key=lambda n: n["fecha"], reverse=True)
    red = construir_red(datos["sedes"])

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC / "assets", DIST / "assets")

    env = Environment(loader=FileSystemLoader(SRC / "templates"), autoescape=select_autoescape(["html"]),
                      trim_blocks=True, lstrip_blocks=True)
    env.filters.update(fecha_larga=fecha_larga, dia=dia, mes_corto=mes_corto, iniciales=iniciales)
    env.globals.update(site=datos["site"], hoy=date.today().isoformat())

    js_datos = ("window.PLAN07=" + json.dumps(datos["plan07"], ensure_ascii=False) + ";\n" +
                "window.SEDES=" + json.dumps(datos["sedes"], ensure_ascii=False) + ";\n")
    (DIST / "assets/js/datos.js").write_text(js_datos, encoding="utf-8")

    indice = []
    for archivo, titulo, desc, padre in PAGINAS:
        plantilla = env.get_template(archivo)
        salida = plantilla.render(pagina=archivo, titulo=titulo, descripcion=desc, padre=padre, red=red, **datos)
        (DIST / archivo).write_text(salida, encoding="utf-8")
        if archivo not in ("404.html",):
            indice.append({"t": titulo, "u": archivo, "x": texto_plano(salida)[:6000]})
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
