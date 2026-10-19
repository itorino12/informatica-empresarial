#!/usr/bin/env bash
# Prepara el servidor Ubuntu y publica el sitio en un solo paso.
# Uso:  sudo bash /opt/cie-web/preparar-servidor.sh
# Hace: red persistente, actualizaciones, actualizaciones automaticas, firewall,
#       uso de todo el disco (LVM) e instalacion del sitio con nginx.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Ejecute con sudo: sudo bash /opt/cie-web/preparar-servidor.sh"; exit 1; fi
export DEBIAN_FRONTEND=noninteractive

echo "== 1/6 Red: evitar que cloud-init cambie la configuracion al reiniciar =="
mkdir -p /etc/cloud/cloud.cfg.d
echo "network: {config: disabled}" > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg

echo "== 2/6 Actualizando el sistema (puede tardar varios minutos) =="
apt-get update
apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold full-upgrade

echo "== 3/6 Actualizaciones de seguridad automaticas =="
apt-get install -y unattended-upgrades
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

echo "== 4/6 Firewall (SSH, 80 y 443) =="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 5/6 Usando todo el disco =="
RAIZ=$(findmnt -no SOURCE /)
if lvs "$RAIZ" >/dev/null 2>&1; then
  PV=$(pvs --noheadings -o pv_name | head -1 | xargs)
  DISCO=$(lsblk -no pkname "$PV" | head -1)
  NUM=$(echo "$PV" | grep -o '[0-9]*$')
  if [ -n "$DISCO" ] && [ -n "$NUM" ] && command -v growpart >/dev/null; then
    growpart "/dev/$DISCO" "$NUM" || true
    pvresize "$PV" || true
  fi
  LIBRE=$(vgs --noheadings --units g --nosuffix -o vg_free "$(lvs --noheadings -o vg_name "$RAIZ" | xargs)" | xargs)
  if awk "BEGIN{exit !($LIBRE > 1)}"; then
    lvextend -r -l +100%FREE "$RAIZ"
  else
    echo "No hay espacio libre para extender (ya usa todo el disco)."
  fi
else
  echo "La raiz no esta en LVM; se omite este paso."
fi

echo "== 6/6 Instalando y publicando el sitio =="
bash /opt/cie-web/instalar.sh

echo
echo "===================== RESUMEN ====================="
df -h / | tail -1 | awk '{print "Disco raiz: " $2 " en total, " $4 " libres"}'
ufw status | head -1
echo "IP: $(hostname -I)"
echo "Reinicie ahora con:  sudo reboot"
