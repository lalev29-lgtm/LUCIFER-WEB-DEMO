"use strict";
/* З-005: изолиран изчислителен компонент. НЕ е свързан с публичния интерфейс.
 * Съответствия: Оценка на риска B,C,D,E,F,G,H,I,J,K,S,T,U,L (при валидни входове).
 * Пълен оперативен приоритет K на лист „Приоритет за третиране“ НЕ се изчислява тук.
 */
const CATEGORIES=["Нерегламентиран достъп","Кражба","Конфликт","Вандализъм","Технически отказ","Забравен/подозрителен предмет","Инцидент на паркинг","Пожарен сигнал"];
const EXPERT={"Нисък":1,"Среден":2,"Висок":3,"Критичен":4};
const LEVEL=["","Нисък","Умерен","Висок","Критичен"];
function assertValid(rows){
 if(!Array.isArray(rows)||rows.length>399)throw Error("Невалиден регистър");
 const ids=new Set();
 for(const r of rows){
  if(!r||typeof r!=="object"||!/^INC-\d{3}$/.test(r.id)||Number(r.id.slice(4))<1||Number(r.id.slice(4))>399||ids.has(r.id))throw Error("Невалиден или дублиран ID");
  ids.add(r.id);
  if(!CATEGORIES.includes(r.category)||!Object.hasOwn(EXPERT,r.expert))throw Error("Невалидна категория или експертна оценка");
  for(const k of ["damage","detect","react"])if(typeof r[k]!=="number"||!Number.isFinite(r[k])||r[k]<0)throw Error("Непроверени финансови или времеви данни");
 }
}
function controlEffectiveness(group){
 if(!group.length)return {status:"Няма случаи",value:null};
 if(group.some(r=>!["Да","Не"].includes(r.cctv)||!["Да","Не","Частично"].includes(r.access)))return {status:"Липсващи данни",value:null};
 if(group.some(r=>!["Да","Не","Неприложимо"].includes(r.sot)))return {status:"Проверете СОТ",value:null};
 const sum=group.reduce((s,r)=>s+(r.cctv==="Да"?0.2:0)+(r.access==="Да"?0.2:r.access==="Частично"?0.1:0)+(r.sot==="Да"?0.2:0),0);
 return {status:"OK",value:sum/group.length};
}
function verifiedPreventedThefts(group){
 const candidates=group.filter(r=>r.category==="Кражба"&&r.prevented==="yes");
 const verified=candidates.filter(r=>r.evidence==="Проверени — потвърдено"&&typeof r.reference==="string"&&r.reference.trim());
 return {declared:candidates.length,verified:verified.length,unverified:candidates.length-verified.length, status:candidates.length===verified.length?"OK":"Изисква проверка"};
}
/* В Excel „Проверка безопасност“ изисква отделен регистър на опасности,
   права, документи, версии и експертни становища. Наличният уеб запис
   не предоставя тези полета: безопасно е да се блокира одобрението. */
function safetyGate(evidence){
 if(!evidence||typeof evidence!=="object")return {status:"Неоценена безопасност",approval:"Блокирано: липсва проверка безопасност"};
 return {status:"Неоценена безопасност",approval:"Блокирано: необходима е пълна проверка по Excel"};
}
function riskAssessment(rows){
 assertValid(rows);
 const total=rows.length;
 return CATEGORIES.map((category,i)=>{
  const group=rows.filter(r=>r.category===category),count=group.length;
  const riskId="R-"+String(i+1).padStart(2,"0");
  if(!count)return {riskId,category,count:0,status:"Няма случаи",finalRisk:"Неоценен",treatmentPriority:"Неоценен"};
  const average=k=>group.reduce((s,r)=>s+r[k],0)/count;
  const meanDamage=average("damage"),maxDamage=Math.max(...group.map(r=>r.damage));
  const frequency=count/total;
  const likelihood=frequency<0.08?1:frequency<0.12?2:frequency<0.16?3:frequency<0.2?4:5;
  const impact=meanDamage<500/1.95583?1:meanDamage<1500/1.95583?2:meanDamage<4000/1.95583?3:meanDamage<10000/1.95583?4:5;
  const financialIndex=likelihood*impact;
  const financialLevel=financialIndex>=17?4:financialIndex>=10?3:financialIndex>=5?2:1;
  const expertMax=Math.max(...group.map(r=>EXPERT[r.expert]));
  const finalLevel=Math.max(financialLevel,expertMax);
  const controls=controlEffectiveness(group);
  const residualIndex=controls.status==="OK"?financialIndex*(1-controls.value):null;
  const residualFinancialLevel=residualIndex===null?null:residualIndex>=17?4:residualIndex>=10?3:residualIndex>=5?2:1;
  const residualRiskCode=residualFinancialLevel===null?null:Math.max(expertMax,finalLevel,residualFinancialLevel);
  const safety=safetyGate(null);
  const theft=verifiedPreventedThefts(group);
  return {riskId,category,count,frequency,meanDamage,maxDamage,meanDetection:average("detect"),meanReaction:average("react"),meanSeverity:group.reduce((s,r)=>s+EXPERT[r.expert],0)/count,likelihood,impact,financialIndex,financialCategory:LEVEL[financialLevel],expertMax,finalRisk:LEVEL[finalLevel],finalRiskCode:finalLevel,controlEffectiveness:controls.value,controlStatus:controls.status,residualFinancialIndex:residualIndex,residualRisk:residualRiskCode===null?null:LEVEL[residualRiskCode],safety,preventedThefts:theft,status:"Частична оценка — безопасност и окончателен приоритет не са одобрени",treatmentPriority:null};
 });
}
if(typeof module!=="undefined")module.exports={riskAssessment,CATEGORIES,controlEffectiveness,verifiedPreventedThefts,safetyGate};

/* Browser exposure of the existing isolated calculation; no change to methodology. */
if(typeof window!=="undefined")window.LuciferRiskEngine={riskAssessment,CATEGORIES};
