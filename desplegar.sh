#!/usr/bin/env bash
# Actualiza el sitio en el servidor: trae los cambios de GitHub, compila y publica.
# Uso (en el servidor):  sudo /opt/cie-web/desplegar.sh
set -euo pipefail
REPO=/opt/cie-web
WEB=/var/www/cie

cd "$REPO"
git pull --ff-only
python3 build.py
mkdir -p "$WEB"
rsync -a --delete dist/ "$WEB"/
chown -R www-data:www-data "$WEB"
echo "Sitio actualizado en $WEB ($(git log -1 --format='%h %s'))"
