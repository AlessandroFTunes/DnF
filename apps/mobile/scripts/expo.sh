#!/bin/sh
# Wrapper do `bun expo`: no `start`, sobe o PocketBase local antes do Metro.
if [ "$1" = "start" ]; then
  docker compose -f ../../compose.yaml up -d --wait pocketbase || exit 1
fi
exec expo "$@"
