/* Focused regression for the independent DEMO register → DAY chronology.
 * Run locally with: node tests/day_register_auto_chronology.test.js
 * Does NOT modify localStorage or the analytical Incidents sheet.
 */
"use strict";
const assert = require("node:assert/strict");
const {readRegisterIncidents, readIncidents, combinedIncidents, timeline, statusFor} =
  require("../day_journal_browser.js");

const source = [
  {id:"INC-003",date:"2026-11-09",time:"14:38",category:"Конфликт",description:"В Регистър"},
  {id:"INC-001",date:"2026-11-03",time:"13:33",category:"Кражба",description:"В Регистър"}
];
const registered = readRegisterIncidents(source);
assert.equal(registered.length, 2);
assert.equal(registered[0].date, "2026-11-09T14:38:00");

// A brand-new REGISTER incident is visible without transfer to Incidents.
let events = timeline([], combinedIncidents([], registered));
assert.deepEqual(events.map(x=>x.id), ["INC-001", "INC-003"]);

// Transferring the same INC-003 into the Incidents sheet must not duplicate it.
const analytic = readIncidents([
  {id:"INC-003",date:"2026-11-09T14:38:00",category:"Конфликт",description:"Старо копие"},
  {id:"INC-004",date:"2026-11-10T11:20:00",category:"Кражба",description:"Само Инциденти"}
]);
events = timeline([], combinedIncidents(analytic, registered));
assert.deepEqual(events.map(x=>x.id), ["INC-001", "INC-003", "INC-004"]);
assert.equal(events.find(x=>x.id==="INC-003").description, "В Регистър");

// The DAY check and mixed chronology both see source-register entries.
assert.match(statusFor({date:"2026-11-09",status:"active"},combinedIncidents([],registered)),/Нужна проверка/);
events = timeline([{id:"DAY-001",date:"2026-11-04",time:"08:00",description:"",status:"active"}],registered);
assert.deepEqual(events.map(x=>x.id), ["INC-001","DAY-001","INC-003"]);

// A valid source register is not automatically written to the Incidents sheet.
assert.equal(source.length, 2);
assert.throws(()=>readRegisterIncidents([{...source[0],id:"INC-003"},{...source[0]}]),/Невалиден/);
assert.throws(()=>readRegisterIncidents([{...source[0],date:"not-a-date"}]),/Невалиден/);
console.log("DAY_REGISTER_AUTO_CHRONOLOGY_PASS");
