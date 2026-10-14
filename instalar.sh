#!/usr/bin/env bash
# Instalación inicial del sitio en el servidor Ubuntu (se ejecuta una sola vez).
# Uso:  sudo bash /opt/cie-web/instalar.sh
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Ejecute con sudo: sudo bash /opt/cie-web/instalar.sh"; exit 1; fi

echo "== 1/4 Instalando programas (nginx, python3-jinja2, rsync) =="
apt-get update
apt-get install -y nginx python3-jinja2 rsync

echo "== 2/4 Compilando y copiando el sitio =="
bash /opt/cie-web/desplegar.sh

echo "== 3/4 Configurando el servidor web =="
cp /opt/cie-web/nginx-cie.conf /etc/nginx/sites-available/cie
ln -sf /etc/nginx/sites-available/cie /etc/nginx/sites-enabled/cie
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full'; fi

echo "== 4/4 Probando =="
RESPUESTA=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
if [ "$RESPUESTA" = "200" ]; then
  echo "LISTO: el sitio responde correctamente en este servidor."
else
  echo "ATENCION: el servidor respondio $RESPUESTA. Envie una foto de esta pantalla."
fi
