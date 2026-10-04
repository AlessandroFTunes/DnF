# core

Regras de negócio e banco de dados (PocketBase).

- `pb_migrations/` — schema versionado (collections e API rules)
- `pb_hooks/` — hooks JS do servidor (validações e regras aplicadas no backend)
- `src/` — regras de D&D em TS puro (@dnf/core), compartilhadas com os apps
- `pb_data/` — dados locais (ignorado pelo git)

Coloque o binário `pocketbase` nesta pasta (ignorado pelo git):

```sh
./pocketbase serve --http=0.0.0.0:8090
```
