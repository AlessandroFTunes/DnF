/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Só o mestre da mesa lê e escreve. Os jogadores veem a grid pela "visão do jogador" que o mestre abre.
  const gmRule = "mesa.gm = @request.auth.id"

  const grids = new Collection({
    "createRule": "@request.auth.id != '' && @request.body.mesa:isset = true && @request.body.mesa.gm = @request.auth.id",
    "deleteRule": gmRule,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_2204324178",
        "help": "",
        "hidden": false,
        "id": "relation_grid_mesa",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "mesa",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_grid_name",
        "max": 64,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        // Caminho da imagem do mapa (png/jpg/webp/gif) no storage do NAS; o arquivo não fica no PocketBase.
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_grid_url",
        "max": 255,
        "min": 1,
        "name": "url",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_3100000001",
    "indexes": [
      "CREATE INDEX idx_grids_mesa ON grids (mesa)"
    ],
    "listRule": gmRule,
    "name": "grids",
    "system": false,
    "type": "base",
    "updateRule": gmRule + " && (@request.body.mesa:isset = false || @request.body.mesa = mesa)",
    "viewRule": gmRule
  })
  app.save(grids)

  // Posições, desenhos, paredes, luzes e fog de cada grid: um JSON só (ver `Grid.Scene` no core).
  const scenes = new Collection({
    "createRule": "@request.auth.id != '' && @request.body.grid.mesa.gm = @request.auth.id",
    "deleteRule": "grid.mesa.gm = @request.auth.id",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "pbc_3100000001",
        "help": "",
        "hidden": false,
        "id": "relation_scene_grid",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "grid",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json_scene_data",
        "maxSize": 5242880,
        "name": "data",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_3100000002",
    "indexes": [
      "CREATE UNIQUE INDEX idx_grid_scenes_grid ON grid_scenes (grid)"
    ],
    "listRule": "grid.mesa.gm = @request.auth.id",
    "name": "grid_scenes",
    "system": false,
    "type": "base",
    "updateRule": "grid.mesa.gm = @request.auth.id && (@request.body.grid:isset = false || @request.body.grid = grid)",
    "viewRule": "grid.mesa.gm = @request.auth.id"
  })
  return app.save(scenes)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("pbc_3100000002"))
  return app.delete(app.findCollectionByNameOrId("pbc_3100000001"))
})
