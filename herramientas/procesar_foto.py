#!/usr/bin/env python3
"""Prepara una foto para el sitio: quita franjas negras, recorta a 3:2, genera WebP en 480 y 960 px de ancho
y elimina todos los metadatos (GPS, cámara, fecha). Se ejecuta en local, no en el servidor.

Uso: python3 herramientas/procesar_foto.py ORIGINAL.jpg src/assets/fotos/sedes/limon
     -> limon-480.webp y limon-960.webp
"""
import sys
from PIL import Image, ImageOps

origen, destino = sys.argv[1], sys.argv[2]
im = ImageOps.exif_transpose(Image.open(origen)).convert("RGB")
# quita franjas negras (fotogramas de video con bandas arriba y abajo o a los lados)
gris = im.convert("L").point(lambda v: 255 if v > 18 else 0)
caja = gris.getbbox()
if caja: im = im.crop(caja)
w, h = im.size
if w / h > 1.5:                       # demasiado ancha: recorta a los lados
    nw = round(h * 1.5); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
else:                                 # demasiado alta: recorta arriba y abajo
    nh = round(w / 1.5); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
for ancho in (480, 960):
    a = min(ancho, im.width)
    v = im.resize((a, round(a / 1.5)), Image.LANCZOS)
    v.save(f"{destino}-{ancho}.webp", "WEBP", quality=80, method=6)   # sin exif: Pillow no copia metadatos
    print(f"{destino}-{ancho}.webp", v.size)
