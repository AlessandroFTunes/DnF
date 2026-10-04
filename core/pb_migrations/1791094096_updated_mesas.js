/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2204324178")

  // update collection data
  unmarshal({
    "listRule": "gm = @request.auth.id || mesa_members_via_mesa.user ?= @request.auth.id || (@request.auth.id != '' && inviteCode = @request.query.code)",
    "viewRule": "gm = @request.auth.id || mesa_members_via_mesa.user ?= @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2204324178")

  // update collection data
  unmarshal({
    "listRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
