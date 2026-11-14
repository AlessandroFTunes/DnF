#!/bin/sh
# Wrapper do `bun expo`: no `start`, sobe o Postgres e a API local antes do Metro.
if [ "$1" = "start" ]; then
  docker compose -f ../../compose.yaml up -d --wait api || exit 1
fi
exec expo "$@"
