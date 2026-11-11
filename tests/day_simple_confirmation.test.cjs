"use strict";
/* New targeted regression cases: DAY confirm-only delete, not the accepted INC tests. */
const test = require("node:test");
const assert = require("node:assert/strict");
const day = require("../day_journal_browser.js");
const now = "2026-11-11T00:00:00.000Z";
const note = "Изтриване на DAY след потвърждение от потребителя";
function entry(n) {
  return {id:day.pad(n),date:"2026-11-"+String(n).padStart(2,"0"),time:"09:00",
    description:"Отчет", actions:"Старо поле C",coordination:"Старо поле D",
    source:"Старо поле E",authorNote:"Попълнил",status:"active",version:1,
    createdAt:now,updatedAt:now,
    audit:[{action:"created",at:now,reason:"Създаден DAY",version:1,before:""}]};
}
test("selected DAY: other records and legacy content survive", () => {
  const db={schema:1,lastNumber:3,entries:[entry(1),entry(2),entry(3)]};
  assert.equal(day.deleteBatch(db,[{id:"DAY-001",version:1},{id:"DAY-002",version:1}],note,now),2);
  assert.equal(db.entries[2].status,"active");
  assert.equal(db.entries[0].actions,"Старо поле C");
  assert.equal(db.entries[1].audit[1].reason,note);
  assert.equal(db.lastNumber,3);
  assert.equal(day.validated(db).entries.length,3);
  assert.deepEqual(day.timeline(db.entries,[]).map(x=>x.id),["DAY-003"]);
});
test("all DAY: keep id, revision and audit, without clearing the INC store", () => {
  const db={schema:1,lastNumber:2,entries:[entry(1),entry(2)]};
  assert.equal(day.deleteBatch(db,db.entries.map(r=>({id:r.id,version:r.version})),note,now,true),2);
  assert.deepEqual(db.entries.map(r=>r.status),["deleted","deleted"]);
  assert.deepEqual(db.entries.map(r=>r.version),[2,2]);
  assert.equal(day.timeline(db.entries,[]).length,0);
  assert.equal(day.validated(db).lastNumber,2);
});
test("stale selected revision: batch is rejected entirely", () => {
  const db={schema:1,lastNumber:2,entries:[entry(1),entry(2)]};
  assert.throws(()=>day.deleteBatch(db,[{id:"DAY-001",version:1},{id:"DAY-002",version:2}],note,now));
  assert.deepEqual(db.entries.map(r=>r.version),[1,1]);
  assert.deepEqual(db.entries.map(r=>r.status),["active","active"]);
});
test("historical C/D/E fields remain schema-compatible", () => {
  const db={schema:1,lastNumber:1,entries:[entry(1)]};
  const old=day.validated(db).entries[0];
  assert.equal(old.coordination,"Старо поле D");
  assert.equal(old.source,"Старо поле E");
});
