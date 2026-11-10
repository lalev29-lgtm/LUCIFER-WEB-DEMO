"use strict";
/* Run: node --test tests/day_journal_core.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const day = require("../day_journal_browser.js");
const base = (id,date,time="09:00") => ({
 id,date,time,description:"Демо",actions:"",coordination:"",source:"",authorNote:"",
 status:"active",version:1,createdAt:"2026-11-10T08:00:00.000Z",
 updatedAt:"2026-11-10T08:00:00.000Z",
 audit:[{action:"created",at:"2026-11-10T08:00:00.000Z",reason:"Нов дневен отчет",version:1,before:""}]
});
test("valid leap day and reject invalid calendar date",()=>{
 assert.equal(day.validDate("2024-02-29"),true);
 assert.equal(day.validDate("2025-02-29"),false);
 assert.equal(day.validDate("2026-13-12"),false);
 assert.equal(day.validDate("2026-11-31"),false);
});
test("valid 24-hour local time",()=>{
 assert.equal(day.validTime("00:00"),true);
 assert.equal(day.validTime("23:59"),true);
 assert.equal(day.validTime("24:00"),false);
 assert.equal(day.validTime("12:99"),false);
});
test("DAY numbering is independent of INC",()=>{
 assert.equal(day.pad(1),"DAY-001");
 assert.equal(day.pad(12),"DAY-012");
 assert.equal(day.pad(1000),"DAY-1000");
});
test("missing storage is empty but malformed storage fails closed",()=>{
 assert.deepEqual(day.validated(null),{schema:1,lastNumber:0,entries:[]});
 assert.throws(()=>day.validated('{"schema":2,"lastNumber":0,"entries":[]}'));
 assert.throws(()=>day.validated("bad json"));
});
test("proper DAY store accepted",()=>{
 const r=base("DAY-001","2026-11-09");
 const x=day.validated({schema:1,lastNumber:1,entries:[r]});
 assert.equal(x.entries[0].id,"DAY-001");
});
test("duplicate DAY ID or reporting date rejected",()=>{
 const a=base("DAY-001","2026-11-08");
 const b=base("DAY-001","2026-11-09");
 const c=base("DAY-002","2026-11-08");
 assert.throws(()=>day.validated({schema:1,lastNumber:2,entries:[a,b]}));
 assert.throws(()=>day.validated({schema:1,lastNumber:2,entries:[a,c]}));
});
test("audit and revision metadata required",()=>{
 const a=base("DAY-001","2026-11-08");
 assert.throws(()=>day.validated({schema:1,lastNumber:1,entries:[{...a,audit:[]}]}));
 assert.throws(()=>day.validated({schema:1,lastNumber:1,entries:[{...a,version:0}]}));
});
test("INC remains separate in timeline and incident flag is visible",()=>{
 const a=base("DAY-001","2026-11-08");
 const incidents=[{id:"INC-001",date:"2026-11-08T13:00",category:"Конфликт",description:"Пример"}];
 const view=day.timeline([a],incidents);
 assert.equal(view.length,2);
 assert.equal(view[0].id,"INC-001");
 assert.equal(view[1].kind,"DAY");
 assert.match(day.statusFor(a,incidents),/Нужна проверка/);
});
test("archive never masquerades as confirmed no-incident status",()=>{
 const a=base("DAY-001","2026-11-08");
 a.status="archived";
 assert.equal(day.statusFor(a,[]),"Архивиран");
});
test("period is validated and limits mixed chronology",()=>{
 const a=base("DAY-001","2026-11-08");
 const b=base("DAY-002","2026-11-09");
 assert.equal(day.timeline([a,b],[],"2026-11-09","2026-11-09").length,1);
 assert.throws(()=>day.timeline([a,b],[],"2026-11-10","2026-11-01"));
});
test("malformed incident source is never silently accepted",()=>{
 assert.throws(()=>day.readIncidents("{not-json}"));
 assert.throws(()=>day.readIncidents(JSON.stringify([{id:"WRONG",date:"2026-11-09T12:00"}])));
});

test("deleted report is retained in backup but excluded from chronology",()=>{
 const a=base("DAY-001","2026-11-08");
 a.status="deleted";a.version=2;
 a.audit.push({action:"deleted",at:"2026-11-10T10:00:00.000Z",
   reason:"Демонстрационен отчет за изтриване",version:2,
   before:JSON.stringify({date:a.date,status:"active"})});
 const db=day.validated({schema:1,lastNumber:1,entries:[a]});
 assert.equal(db.entries.length,1);
 assert.match(day.statusFor(a,[]),/Изтрит/);
 assert.equal(day.timeline(db.entries,[]).length,0);
});
test("deleted DAY date can be reused, but the original ID must remain unique",()=>{
 const deleted=base("DAY-001","2026-11-08");
 deleted.status="deleted";deleted.version=2;
 deleted.audit.push({action:"deleted",at:"2026-11-10T10:00:00.000Z",
   reason:"Потвърдено изтриване",version:2,before:"{}"});
 const replacement=base("DAY-002","2026-11-08");
 const db=day.validated({schema:1,lastNumber:2,entries:[deleted,replacement]});
 assert.deepEqual(db.entries.map(x=>x.id),["DAY-001","DAY-002"]);
 assert.equal(day.timeline(db.entries,[]).length,1);
 assert.throws(()=>day.validated({schema:1,lastNumber:2,entries:[deleted,base("DAY-001","2026-11-09")]}));
});
test("deleted report cannot masquerade as a live unreported-day certificate",()=>{
 const a=base("DAY-001","2026-11-08");
 a.status="deleted";a.version=2;
 a.audit.push({action:"deleted",at:"2026-11-10T10:00:00.000Z",
  reason:"Защитено изтриване на DAY",version:2,before:"{}"});
 assert.equal(day.statusFor(a,[]).startsWith("Без инциденти"),false);
 assert.equal(day.timeline([a],[]).length,0);
});
