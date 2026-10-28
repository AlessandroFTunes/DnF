/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2204324178")

  // Só o caminho da capa no storage do NAS (ex.: "<id da mesa>/imagens/capa.png"); o arquivo não fica no PocketBase.
  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_mesa_cover",
    "max": 255,
    "min": 0,
    "name": "cover",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2204324178")

  collection.fields.removeById("text_mesa_cover")

  return app.save(collection)
})
