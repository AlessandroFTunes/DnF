/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "json49118917",
    "maxSize": 2000000,
    "name": "classes",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

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
  collection.fields.addAt(10, new Field({
    "help": "",
    "hidden": false,
    "id": "json327609046",
    "maxSize": 2000000,
    "name": "proficiencies",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "help": "",
    "hidden": false,
    "id": "json2370954136",
    "maxSize": 2000000,
    "name": "combat",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "json3543717251",
    "maxSize": 2000000,
    "name": "equipment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "json2424941254",
    "maxSize": 2000000,
    "name": "spellcasting",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "json3788476590",
    "maxSize": 2000000,
    "name": "personality",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "json1915095946",
    "maxSize": 2000000,
    "name": "details",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1715335193",
    "max": 128,
    "min": 0,
    "name": "speciesKey",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
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
  collection.fields.addAt(18, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text497107347",
    "max": 128,
    "min": 0,
    "name": "backgroundKey",
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

  // add field
  collection.fields.addAt(21, new Field({
    "help": "",
    "hidden": false,
    "id": "number4131033149",
    "max": null,
    "min": 0,
    "name": "xp",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(22, new Field({
    "help": "",
    "hidden": false,
    "id": "bool4260119616",
    "name": "inspiration",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3298390430")

  // remove field
  collection.fields.removeById("json49118917")

  // remove field
  collection.fields.removeById("json2856510978")

  // remove field
  collection.fields.removeById("json3217087507")

  // remove field
  collection.fields.removeById("json254213878")

  // remove field
  collection.fields.removeById("json327609046")

  // remove field
  collection.fields.removeById("json2370954136")

  // remove field
  collection.fields.removeById("json3543717251")

  // remove field
  collection.fields.removeById("json2424941254")

  // remove field
  collection.fields.removeById("json3788476590")

  // remove field
  collection.fields.removeById("json1915095946")

  // remove field
  collection.fields.removeById("text1715335193")

  // remove field
  collection.fields.removeById("text967579578")

  // remove field
  collection.fields.removeById("text497107347")

  // remove field
  collection.fields.removeById("select751705692")

  // remove field
  collection.fields.removeById("select4156564586")

  // remove field
  collection.fields.removeById("number4131033149")

  // remove field
  collection.fields.removeById("bool4260119616")

  return app.save(collection)
})
