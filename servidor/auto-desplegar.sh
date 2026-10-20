#!/usr/bin/env bash
# Revisa si hay cambios nuevos en GitHub y, solo si los hay, publica el sitio.
# Lo ejecuta el temporizador cie-desplegar.timer cada 5 minutos (como root).
# Todo va dentro de un bloque para que bash lo lea completo antes de ejecutar:
# así un "git pull" que modifique este mismo archivo no rompe la ejecución.
{
set -euo pipefail
REPO=/opt/cie-web
exec 9>/run/cie-desplegar.lock
flock -n 9 || { echo "Ya hay un despliegue en curso; se omite."; exit 0; }

cd "$REPO"
RAMA=$(git rev-parse --abbrev-ref HEAD)
git fetch --quiet origin "$RAMA"
LOCAL=$(git rev-parse HEAD)
REMOTO=$(git rev-parse "origin/$RAMA")

if [ "$LOCAL" = "$REMOTO" ]; then
  exit 0   # sin cambios: no hace nada ni deja ruido en el registro
fi

echo "Cambios nuevos en GitHub: ${LOCAL:0:7} -> ${REMOTO:0:7}"
git pull --ff-only --quiet
bash "$REPO/desplegar.sh"
exit 0
}
