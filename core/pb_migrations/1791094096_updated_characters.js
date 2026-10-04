/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // update collection data
  unmarshal({
    "listRule": "owner = @request.auth.id || mesa_members_via_character.mesa.gm ?= @request.auth.id",
    "viewRule": "owner = @request.auth.id || mesa_members_via_character.mesa.gm ?= @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // update collection data
  unmarshal({
    "listRule": "owner = @request.auth.id",
    "viewRule": "owner = @request.auth.id"
  }, collection)

  return app.save(collection)
})
