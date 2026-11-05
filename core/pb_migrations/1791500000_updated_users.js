/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // Apelido mostrado para os outros jogadores (vazio = usa o nome).
  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text_user_nickname",
    "max": 32,
    "min": 0,
    "name": "nickname",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Ajustes do app (narração, sons…): um JSON só, para campo novo não precisar de migration.
  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_user_preferences",
    "maxSize": 2000,
    "name": "preferences",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // Avatar: o arquivo fica no storage do PocketBase (pb_data/storage). Só imagens, até 5 MB, com miniatura.
  const avatar = collection.fields.getByName("avatar")
  if (avatar) {
    avatar.maxSize = 5242880
    avatar.mimeTypes = ["image/jpeg", "image/png", "image/webp"]
    avatar.thumbs = ["256x256"]
  } else {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "file_user_avatar",
      "maxSelect": 1,
      "maxSize": 5242880,
      "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
      "name": "avatar",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": ["256x256"],
      "type": "file"
    }))
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  collection.fields.removeById("text_user_nickname")
  collection.fields.removeById("json_user_preferences")

  return app.save(collection)
})
