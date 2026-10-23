#!/usr/bin/env bash
# Endurecimiento del servidor según la revisión OWASP Top 10 2025.
# Uso (en el servidor, desde la red UCR):
#   sudo bash /opt/cie-web/servidor/endurecer.sh               # nginx + fail2ban
#   sudo bash /opt/cie-web/servidor/endurecer.sh --solo-llaves # además, SSH solo con llave
#
# Es seguro repetirlo. Si la nueva configuración de nginx falla la prueba, restaura la anterior.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Ejecute con sudo."; exit 1; fi
REPO=/opt/cie-web
SOLO_LLAVES=0; [ "${1:-}" = "--solo-llaves" ] && SOLO_LLAVES=1

echo "== 1/3 nginx: cabeceras de seguridad, HSTS y sin versión =="
DESTINO=/etc/nginx/sites-available/cie
RESPALDO="$DESTINO.respaldo-$(date +%Y%m%d-%H%M%S)"
cp "$DESTINO" "$RESPALDO"
cp "$REPO/nginx-cie.conf" "$DESTINO"
if nginx -t; then
  systemctl reload nginx
  echo "nginx actualizado (respaldo en $RESPALDO)."
else
  cp "$RESPALDO" "$DESTINO"
  echo "ERROR: la configuración nueva no pasó la prueba; se restauró la anterior. No se recargó nginx."
  exit 1
fi

echo "== 2/3 fail2ban: bloquea IP tras 5 intentos fallidos de SSH =="
export DEBIAN_FRONTEND=noninteractive
apt-get install -y fail2ban >/dev/null
cat > /etc/fail2ban/jail.d/cie.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban
fail2ban-client status sshd | sed -n '1,4p'

echo "== 3/3 SSH =="
if [ "$SOLO_LLAVES" -eq 1 ]; then
  USUARIO="${SUDO_USER:-gestion}"
  LLAVES="$(getent passwd "$USUARIO" | cut -d: -f6)/.ssh/authorized_keys"
  if [ ! -s "$LLAVES" ]; then
    echo "NO se desactivaron las contraseñas: $USUARIO no tiene llaves en $LLAVES."
    echo "Primero copie su llave pública (ssh-copy-id) y pruebe entrar con ella."
  else
    printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/10-cie.conf
    sshd -t && systemctl reload ssh
    echo "SSH ahora acepta solo llaves. NO cierre esta sesión hasta comprobar que entra con la llave en otra ventana."
  fi
else
  printf 'PermitRootLogin no\n' > /etc/ssh/sshd_config.d/10-cie.conf
  sshd -t && systemctl reload ssh
  echo "Acceso de root por SSH desactivado. Las contraseñas siguen permitidas (use --solo-llaves para quitarlas)."
fi

echo
echo "Listo. Verifique desde fuera:  curl -sI https://informaticaempresarial.ucr.ac.cr | grep -i 'strict\|content-security\|server'"
