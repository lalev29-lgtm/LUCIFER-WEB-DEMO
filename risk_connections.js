"use strict";
/* Existing incident register -> existing KERNEL-B risk projection -> read-only
   treatment overview. No new formula and no replacement incident page. */
(()=>{
 const KEY="lucifer-web-site-001-demo-v1";
 const risk=document.getElementById("risk-results"),priority=document.getElementById("priority-results");
 if(!risk||!priority)return;
 const numeric=n=>typeof n==="number"&&Number.isFinite(n);
 const number=n=>numeric(n)?n.toLocaleString("bg-BG",{maximumFractionDigits:2}):"—";
 const money=n=>numeric(n)?n.toLocaleString("bg-BG",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":"—";
 function table(headers,rows){
  const wrap=document.createElement("div");wrap.className="scroll";
  const tbl=document.createElement("table"),head=tbl.createTHead().insertRow();
  for(const h of headers){const th=document.createElement("th");th.textContent=h;head.append(th)}
  const tbody=tbl.createTBody();
  for(const cells of rows){const tr=tbody.insertRow();for(const v of cells){const td=tr.insertCell();td.textContent=String(v??"—")}}
  wrap.append(tbl);return wrap;
 }
 function message(s){const p=document.createElement("p");p.className="notice";p.textContent=s;return p}
 function read(){
  const v=localStorage.getItem(KEY),rows=v===null?[]:JSON.parse(v);
  if(!Array.isArray(rows)||rows.length>399)throw Error("Невалиден регистър");
  return rows;
 }
 function render(){
  try{
   const rows=read(),engine=window.LuciferRiskEngine;
   if(typeof engine?.riskAssessment!=="function")throw Error("Не е зареден изчислителният модул");
   const verified=r=>r.evidence==="Проверени — потвърдено"&&typeof r.reference==="string"&&r.reference.trim().length>0;
   // Do not convert a proven prevented theft into a completed theft.
   // Without an evidence review, a theft is not counted as an established incident.
   const confirmedPrevented=rows.filter(r=>r.category==="Кражба"&&r.prevented==="yes"&&verified(r));
   const pending=rows.filter(r=>r.category==="Кражба"&&(r.prevented==="yes"||!verified(r))&&!confirmedPrevented.includes(r));
   const assessable=rows.filter(r=>r.category!=="Кражба"||(r.prevented!=="yes"&&verified(r)));
   const result=engine.riskAssessment(assessable),active=result.filter(r=>r.count>0);
   const note=message("Регистър: "+rows.length+"/399. В предварителната оценка: "+assessable.length+
    ". Доказани предотвратени кражби — отделно: "+confirmedPrevented.length+
    ". Кражби за допълнителна проверка: "+pending.length+".");
   if(!active.length){
    risk.replaceChildren(note,message("Няма случаи с достатъчни данни за предварителна оценка."));
    priority.replaceChildren(message("Не може да се изведе приоритет: няма проверени за изчисление случаи."));
    return;
   }
   const riskTable=table(
    ["Risk ID","Категория","Брой","Честота","Средна щета","Макс. щета",
     "Средно откриване","Средна реакция","Средна тежест H","Финансова категория",
     "Експертна H","Предварителен риск","Контроли","Остатъчен индекс","Остатъчен риск","Статус"],
    active.map(r=>[r.riskId,r.category,r.count,number(r.frequency*100)+"%",money(r.meanDamage),
     money(r.maxDamage),number(r.meanDetection),number(r.meanReaction),
     number(r.meanSeverity),r.financialCategory,number(r.expertMax),r.finalRisk,
     r.controlStatus==="OK"?number(r.controlEffectiveness*100)+"%":r.controlStatus,
     number(r.residualFinancialIndex),r.residualRisk||"Неоценен",r.status]));
   risk.replaceChildren(note,riskTable,message(
    "Използван е наличният изчислителен модул З-005. Резултатите са частични и НЕ са окончателно съответствие с 25-те Excel листа."));
   priority.replaceChildren(message("Свързани показатели от същия регистър. Официален приоритет и одобрение НЕ са изчислени."),
    table(["Risk ID","Категория","Инциденти","Експертна H",
     "Предварителна категория","Остатъчна категория","Официален приоритет","Статус"],
     active.map(r=>[r.riskId,r.category,r.count,number(r.expertMax),r.finalRisk,
       r.residualRisk||"Неоценен","Изисква проверка за безопасност","НЕОДОБРЕНО"])));
  }catch(e){
   const msg="Изчислението е блокирано: "+e.message+". Съществуващите инциденти не са променени.";
   risk.textContent=msg;priority.textContent=msg;
  }
 }
 window.addEventListener("lucifer:incidents-changed",render);
 window.addEventListener("lucifer:tab-changed",e=>{if(["home","risk","priority"].includes(e.detail?.tab))render()});
 window.addEventListener("storage",e=>{if(e.key===KEY||e.key===null)render()});
 render();
})();
