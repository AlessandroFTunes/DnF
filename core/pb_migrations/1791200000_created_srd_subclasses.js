/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1036794183",
        "max": 128,
        "min": 0,
        "name": "key",
        "pattern": "^[a-z0-9-]+_[a-z0-9-]+$",
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
        "id": "text421981675",
        "max": 128,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select598570749",
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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text634458294",
        "max": 64,
        "min": 0,
        "name": "document_key",
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
        "id": "text3548656200",
        "max": 128,
        "min": 0,
        "name": "document_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1286619065",
        "max": 20000,
        "min": 0,
        "name": "desc",
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
        "id": "json3092482939",
        "maxSize": 200000,
        "name": "i18n",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text1851931901",
        "max": 64,
        "min": 0,
        "name": "subclass_of",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json4048511785",
        "maxSize": 200000,
        "name": "features",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "json"
      }
    ],
    "id": "pbc_4144686719",
    "indexes": [
      "CREATE UNIQUE INDEX idx_srd_subclasses_key ON srd_subclasses (key)"
    ],
    "listRule": "",
    "name": "srd_subclasses",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4144686719");

  return app.delete(collection);
})
