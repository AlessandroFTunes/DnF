/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != '' && @request.body.gm = @request.auth.id",
    "deleteRule": "gm = @request.auth.id",
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
        "collectionId": "_pb_users_auth_",
        "help": "",
        "hidden": false,
        "id": "relation1483141754",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "gm",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 64,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1843675174",
        "max": 2000,
        "min": 0,
        "name": "description",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select2828081183",
        "maxSelect": 1,
        "name": "edition",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "2014",
          "2024"
        ]
      },
      {
        "autogeneratePattern": "[A-HJ-NP-Z2-9]{8}",
        "help": "",
        "hidden": false,
        "id": "text432700299",
        "max": 8,
        "min": 8,
        "name": "inviteCode",
        "pattern": "^[A-Z0-9]+$",
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
    "id": "pbc_2204324178",
    "indexes": [
      "CREATE INDEX idx_mesas_gm ON mesas (gm)",
      "CREATE UNIQUE INDEX idx_mesas_invite ON mesas (inviteCode)"
    ],
    "listRule": null,
    "name": "mesas",
    "system": false,
    "type": "base",
    "updateRule": "gm = @request.auth.id && (@request.body.gm:isset = false || @request.body.gm = @request.auth.id)",
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2204324178");

  return app.delete(collection);
})
