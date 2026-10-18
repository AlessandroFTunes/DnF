#!/bin/sh
# Sobe o app para o celular no Wi-Fi a partir do WSL2: usa o IP do Windows na rede (o Windows repassa a
# porta 8081 para o WSL e a 8091 para o PocketBase do Docker, com `netsh interface portproxy`). As regras vêm da
# API real pelo proxy /srd do PocketBase (token no .env da raiz), não de uma API local.
ip=$(powershell.exe -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.PrefixOrigin -eq 'Dhcp' }).IPAddress" | tr -d '\r' | head -n 1)
if [ -z "$ip" ]; then
  echo "Não achei o IP do Windows na rede." >&2
  exit 1
fi
echo "Celular: http://$ip:8081"
REACT_NATIVE_PACKAGER_HOSTNAME=$ip EXPO_PUBLIC_PB_URL=http://$ip:8091 EXPO_PUBLIC_DND_API_URL= exec sh scripts/expo.sh start
