/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3114242658")

  // update collection data
  unmarshal({
    "createRule": "@request.body.user = @request.auth.id && @request.body.inviteCode = mesa.inviteCode && character.owner = @request.auth.id && character.edition = mesa.edition",
    "deleteRule": "user = @request.auth.id || mesa.gm = @request.auth.id",
    "indexes": [
      "CREATE UNIQUE INDEX idx_mesa_members_unique ON mesa_members (mesa, user)",
      "CREATE INDEX idx_mesa_members_user ON mesa_members (user)",
      "CREATE UNIQUE INDEX idx_mesa_members_character ON mesa_members (mesa, character)"
    ],
    "listRule": "user = @request.auth.id || mesa.gm = @request.auth.id",
    "viewRule": "user = @request.auth.id || mesa.gm = @request.auth.id"
  }, collection)

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": true,
    "id": "text432700299",
    "max": 8,
    "min": 0,
    "name": "inviteCode",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_3298390430",
    "help": "",
    "hidden": false,
    "id": "relation2474291252",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "character",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3114242658")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "indexes": [
      "CREATE UNIQUE INDEX idx_mesa_members_unique ON mesa_members (mesa, user)",
      "CREATE INDEX idx_mesa_members_user ON mesa_members (user)"
    ],
    "listRule": null,
    "viewRule": null
  }, collection)

  // remove field
  collection.fields.removeById("text432700299")

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3298390430",
    "help": "",
    "hidden": false,
    "id": "relation2474291252",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "character",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
