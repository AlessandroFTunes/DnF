/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // remove field
  collection.fields.removeById("json2856510978")

  // remove field
  collection.fields.removeById("json3217087507")

  // remove field
  collection.fields.removeById("json254213878")

  // remove field
  collection.fields.removeById("text967579578")

  // remove field
  collection.fields.removeById("select751705692")

  // remove field
  collection.fields.removeById("select4156564586")

  // add field
  collection.fields.addAt(17, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2145839833",
    "max": 128,
    "min": 0,
    "name": "alignmentKey",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(18, new Field({
    "help": "",
    "hidden": false,
    "id": "json1344977705",
    "maxSize": 2000000,
    "name": "featKeys",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "json1436554664",
    "maxSize": 2000000,
    "name": "featureUses",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "json2856510978",
    "maxSize": 2000000,
    "name": "attacks",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "json3217087507",
    "maxSize": 2000000,
    "name": "features",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "json254213878",
    "maxSize": 2000000,
    "name": "speed",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text967579578",
    "max": 128,
    "min": 0,
    "name": "subspeciesKey",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "help": "",
    "hidden": false,
    "id": "select751705692",
    "maxSelect": 1,
    "name": "alignment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "lawful-good",
      "neutral-good",
      "chaotic-good",
      "lawful-neutral",
      "neutral",
      "chaotic-neutral",
      "lawful-evil",
      "neutral-evil",
      "chaotic-evil"
    ]
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "help": "",
    "hidden": false,
    "id": "select4156564586",
    "maxSelect": 1,
    "name": "size",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "tiny",
      "small",
      "medium",
      "large",
      "huge",
      "gargantuan"
    ]
  }))

  // remove field
  collection.fields.removeById("text2145839833")

  // remove field
  collection.fields.removeById("json1344977705")

  // remove field
  collection.fields.removeById("json1436554664")

  return app.save(collection)
})
