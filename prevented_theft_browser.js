"use strict";
/* Excel LC_Prevent / LC_Real: verified thefts are separate from real incidents. */
const EXPERT={"Нисък":1,"Среден":2,"Висок":3,"Критичен":4};
const labels=["","Нисък","Умерен","Висок","Критичен"];
const confirmed=r=>r&&r.evidence==="Проверени — потвърдено"&&typeof r.reference==="string"&&r.reference.trim().length>0;
const attempted=r=>r&&r.category==="Кражба"&&(r.prevented==="yes"||r.theftType==="Доказан предотвратен опит");
const actual=r=>r&&r.category==="Кражба"&&(r.theftType==="Извършена кражба"||r.prevented==="no"&&r.theftType===undefined);
const validKey=r=>r&&/^INC-\d{3}$/.test(r.id||"")&&Number(r.id.slice(4))>=1&&Number(r.id.slice(4))<=399;
function classifyIncidents(rows){
 if(!Array.isArray(rows)||rows.length>399)throw Error("Невалиден регистър");
 const ids=new Set();
 for(const r of rows){if(!validKey(r)||ids.has(r.id))throw Error("Невалиден или дублиран ID");ids.add(r.id)}
 return {real:rows.filter(r=>r.category!=="Кражба"||actual(r)&&confirmed(r)),prevented:rows.filter(r=>attempted(r)&&confirmed(r)),pending:rows.filter(r=>r.category==="Кражба"&&!(actual(r)&&confirmed(r))&&!(attempted(r)&&confirmed(r)))};
}
function preventedTheftStatistics(rows){
 const {real,prevented,pending}=classifyIncidents(rows);
 const amounts=prevented.map(r=>r.threatened);
 const numeric=amounts.filter(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0);
 const unknown=amounts.filter(v=>v===null||v===undefined||v==="").length;
 const invalid=amounts.length-numeric.length-unknown;
 const loss=prevented.map(r=>r.damage);
 const validLoss=loss.filter(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0);
 const expert=prevented.map(r=>EXPERT[r.expert]);
 const expertMax=expert.length?Math.max(0,...expert.filter(Number.isInteger)):0;
 const missingH=prevented.some(r=>r.expert===null||r.expert===undefined||r.expert==="");
 const invalidH=prevented.some(r=>r.expert!==null&&r.expert!==undefined&&r.expert!==""&&!Object.hasOwn(EXPERT,r.expert));
 const expertStatus=missingH?"Липсващи данни":invalidH?"Непроверени данни":"OK";
 const knownTotal=numeric.reduce((s,v)=>s+v,0);
 const share=prevented.length/(real.length+prevented.length||1);
 const likelihood=prevented.length?(share<.08?1:share<.12?2:share<.16?3:share<.2?4:5):null;
 const meanU=numeric.length?knownTotal/numeric.length:null;
 const impact=invalid||!numeric.length?null:meanU<500/1.95583?1:meanU<1500/1.95583?2:meanU<4000/1.95583?3:meanU<10000/1.95583?4:5;
 const financialIndex=likelihood!==null&&impact!==null?likelihood*impact:null;
 const financialCode=financialIndex===null?null:financialIndex>=17?4:financialIndex>=10?3:financialIndex>=5?2:1;
 const finalRiskCode=Math.max(expertMax,financialCode||0);
 const status=prevented.length===0?"Няма случаи":expertStatus!=="OK"?expertStatus:invalid?"Невалидна U — неоценен":numeric.length===0?"Неизвестна U — неоценен":"OK";
 const finalRisk=finalRiskCode>=3?labels[finalRiskCode]:status!=="OK"?status:finalRiskCode?labels[finalRiskCode]:"Неоценен";
 return {declared:prevented.length+pending.filter(attempted).length,confirmed:prevented.length,unconfirmed:pending.filter(attempted).length,pendingTheftRecords:pending.length,threatenedAmount:invalid?null:knownTotal,knownU:numeric.length,unknownU:unknown,invalidU:invalid,meanU,maxU:numeric.length?Math.max(...numeric):null,actualLossKnown:validLoss.reduce((s,v)=>s+v,0),actualLossUnknown:loss.length-validLoss.length,share,likelihood,impact,financialIndex,expertMax,expertStatus,finalRiskCode,finalRisk,independentStatistics:true,approved:false,status};
}
if(typeof module!=="undefined"&&module.exports)module.exports={preventedTheftStatistics,classifyIncidents};
if(typeof window!=="undefined")window.LuciferPreventedTheft={preventedTheftStatistics,classifyIncidents};
