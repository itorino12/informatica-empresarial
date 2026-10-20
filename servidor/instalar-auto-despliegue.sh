#!/usr/bin/env bash
# Instala (una sola vez) la publicación automática del sitio.
# Uso en el servidor:  sudo bash /opt/cie-web/servidor/instalar-auto-despliegue.sh
# Para apagarla:       sudo systemctl disable --now cie-desplegar.timer
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Ejecútelo con sudo."; exit 1; }
REPO=/opt/cie-web

# Evita el error de git "dubious ownership" cuando root opera sobre el repositorio.
git config --system --get-all safe.directory 2>/dev/null | grep -qx "$REPO" \
  || git config --system --add safe.directory "$REPO"

install -m 644 "$REPO/servidor/cie-desplegar.service" /etc/systemd/system/cie-desplegar.service
install -m 644 "$REPO/servidor/cie-desplegar.timer"   /etc/systemd/system/cie-desplegar.timer
systemctl daemon-reload
systemctl enable --now cie-desplegar.timer

echo "Prueba inicial:"
systemctl start cie-desplegar.service && journalctl -u cie-desplegar --no-pager -n 5 || true
echo
systemctl list-timers cie-desplegar.timer --no-pager
echo
echo "Listo. El servidor revisará GitHub cada 5 minutos y publicará solo si hay cambios."
echo "Ver qué se publicó:  journalctl -u cie-desplegar --no-pager -n 30"
echo "Apagar:              sudo systemctl disable --now cie-desplegar.timer"
