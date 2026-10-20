#!/usr/bin/env python3
"""Prepara una foto para el sitio. Se ejecuta en local, no en el servidor.

- Quita franjas negras (fotogramas de video).
- Si la foto mide menos de 960 px de ancho, la amplía con superresolución EDSR x2
  (OpenCV dnn_superres; modelo EDSR_x2.pb de github.com/Saafke/EDSR_Tensorflow).
- Corrige levemente contraste, color y nitidez.
- Recorta a 3:2 con un punto de enfoque (0 = izquierda/arriba, 0.5 = centro, 1 = derecha/abajo).
- Genera WebP de 480 y 960 px sin metadatos (GPS, cámara, fecha).

Uso: python3 herramientas/procesar_foto.py ORIGINAL src/assets/fotos/sedes/ID [enfoque] [--modelo RUTA]
"""
import argparse
from PIL import Image, ImageOps, ImageFilter, ImageEnhance

ap = argparse.ArgumentParser()
ap.add_argument("origen"); ap.add_argument("destino")
ap.add_argument("enfoque", nargs="?", type=float, default=0.5)
ap.add_argument("--modelo", default=None)
a = ap.parse_args()

im = ImageOps.exif_transpose(Image.open(a.origen)).convert("RGB")
caja = im.convert("L").point(lambda v: 255 if v > 18 else 0).getbbox()
if caja: im = im.crop(caja)

ampliada = False
if im.width < 960 and a.modelo:
    import cv2, numpy as np
    sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(a.modelo); sr.setModel("edsr", 2)
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    im = Image.fromarray(cv2.cvtColor(sr.upsample(bgr), cv2.COLOR_BGR2RGB))
    ampliada = True

im = ImageOps.autocontrast(im, cutoff=0.5)
im = ImageEnhance.Color(im).enhance(1.05)

w, h = im.size
if w / h > 1.5:
    nw = round(h * 1.5); x0 = round((w - nw) * a.enfoque); im = im.crop((x0, 0, x0 + nw, h))
else:
    nh = round(w / 1.5); y0 = round((h - nh) * a.enfoque); im = im.crop((0, y0, w, y0 + nh))

for ancho in (480, 960):
    an = min(ancho, im.width)
    v = im.resize((an, round(an / 1.5)), Image.LANCZOS)
    v = v.filter(ImageFilter.UnsharpMask(radius=1.0, percent=60 if ampliada else 40, threshold=2))
    v.save(f"{a.destino}-{ancho}.webp", "WEBP", quality=82, method=6)
    print(f"{a.destino}-{ancho}.webp", v.size, "(superresolución)" if ampliada else "")
