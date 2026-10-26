'use strict';
/* merges every photo batch in this folder (a.js, b.js, ...: each exports { id: entry }); duplicate ids are an error */
const fs = require('fs');
const path = require('path');
const ALL = {};
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js').sort()) {
  const part = require(path.join(__dirname, f));
  for (const [id, p] of Object.entries(part)) {
    if (ALL[id]) throw new Error(`photos.d/${f}: duplicate photo id ${id}`);
    ALL[id] = Object.assign({ batch: f }, p);
  }
}
module.exports = ALL;
