"use strict";
/* Direct Excel-column projection. Workbook: Луцефер-Знанието е сила(7).xlsx.
 * Preserve the existing incident register and its localStorage key.
 * Never infer approvals or substitute an invented safety decision.
 */
(() => {
 const INCIDENT_KEY="lucifer-web-site-001-demo-v1";
 const PLAN_KEY="lucifer-web-treatment-plan-v1";
 const RISK_COLS=["Тип инцидент","Брой инциденти","Вероятност в набора","Средна щета (евро)","Макс. щета (евро)","Средно откриване (мин)","Средна реакция (мин)","Средна тежест (1–4)","Вероятност (1–5)","Последствия (1–5)","Финансов индекс","Крайна категория на риска","Ефективност на контрол (%)","Остатъчен финансов риск","Крайна категория на остатъчния риск","Risk ID (постоянен ключ)","Q — контрол на входните данни (без заглавие в Excel)","Статус на данните (тест)","Максимално експертно ниво 1–4","Финансова категория","Код на крайната категория","Статус на оценката"];
 const PRIORITY_COLS=["Категория","Инциденти","Материални загуби, евро","Макс. щета, евро","Базов индекс","Норм. загуби","Норм. риск","Норм. макс. щета","Балансиран резултат","Критичен сценарий (ДА/НЕ; след проверка)","Оперативен приоритет","Ред по оперативен приоритет","Обосновка","Risk ID — постоянен ключ","Параметър","Стойност","Проверка на безопасността","Основание за приоритет","Статус на потвърждение","Защитно действие","Проверена версия","Досегашен приоритет и предупреждения","Код от оценката на риска","Код на оперативния приоритет","Досегашен финансов ред","Контролни съобщения"];
 const PLAN_COLS=["Risk ID","Риск","Мярка","Тип мярка","Приоритет","Отговорник","Срок","Ресурс","Очакван резултат","KPI","Целева стойност","Статус","Доказателство"];
 const FIELDS=["riskId","risk","measure","type","priority","owner","due","resource","outcome","kpi","target","status","proof"];
 const TYPES=["Нерегламентиран достъп","Кражба","Конфликт","Вандализъм","Технически отказ","Забравен/подозрителен предмет","Инцидент на паркинг","Пожарен сигнал"];
 const $=id=>document.getElementById(id);
 const riskEl=$("risk-results"),priorityEl=$("priority-results"),planEl=$("treatment-results");
 if(!riskEl||!priorityEl||!planEl)return;
 const pending="Неизчислено — необходима проверка",n=v=>typeof v==="number"&&Number.isFinite(v);
 const num=v=>n(v)?v.toLocaleString("bg-BG",{maximumFractionDigits:2}):v??pending;
 const cash=v=>n(v)?v.toLocaleString("bg-BG",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":v??pending;
 const percent=v=>n(v)?(v*100).toLocaleString("bg-BG",{maximumFractionDigits:2})+"%":v??pending;
 function note(t){const p=document.createElement("p");p.className="notice";p.textContent=t;return p}
 function table(heads,rows){
   const outer=document.createElement("div"),tbl=document.createElement("table");
   outer.className="scroll";const h=tbl.createTHead().insertRow();
   heads.forEach((t,i)=>{const th=document.createElement("th");
     // Show physical Excel positions: Q exists as a formula cell despite its blank header.
     th.textContent=(heads===RISK_COLS?String.fromCharCode(65+i)+" · ":"")+t;h.append(th)});
   const body=tbl.createTBody();
   for(const cells of rows){if(cells.length!==heads.length)throw Error("Несъответствие в броя на колоните");
     const tr=body.insertRow();
     for(const val of cells){const td=tr.insertCell();td.textContent=String(val??"—")}}
   if(!rows.length){const td=body.insertRow().insertCell();td.colSpan=heads.length;td.textContent="Няма записи"}
   outer.append(tbl);return outer;
 }

 /* Readable result summaries. The original Excel-column tables remain unchanged. */
 const summaryStyles=document.createElement("style");
 summaryStyles.id="lucifer-risk-priority-readable-results-v1";
 summaryStyles.textContent=[
   ".lucifer-result-overview{margin:14px 0 18px}",
   ".lucifer-result-heading{margin:0 0 10px;font-size:1.15rem;color:#f5f8fc}",
   ".lucifer-result-intro{margin:0 0 12px;color:#d1e0f1;line-height:1.5}",
   ".lucifer-result-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0}",
   ".lucifer-stat{border:1px solid #597a9c;border-radius:10px;background:#193b59;padding:12px;min-width:0}",
   ".lucifer-stat-name{display:block;font-size:.84rem;color:#d2e0ed;margin-bottom:6px;line-height:1.35}",
   ".lucifer-stat-value{display:block;color:#fff;font-weight:750;font-size:1.15rem;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}",
   ".lucifer-category-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin:14px 0}",
   ".lucifer-category-card{min-width:0;background:#17334e;border:1px solid #597a9c;border-radius:11px;padding:14px}",
   ".lucifer-category-title{margin:0 0 12px;font-weight:750;font-size:1.05rem;line-height:1.4;color:#fff}",
   ".lucifer-category-id{display:inline-block;font-size:.82rem;color:#bfd8f0;font-weight:500}",
   ".lucifer-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0}",
   ".lucifer-fact{min-width:0;padding:9px;background:#10283e;border-radius:7px}",
   ".lucifer-fact dt{font-size:.82rem;color:#c6d6e7;line-height:1.35;margin:0 0 5px}",
   ".lucifer-fact dd{font-size:1rem;font-weight:650;color:#fff;margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}",
   ".lucifer-table-details{margin:16px 0;border:1px solid #557694;border-radius:10px;padding:10px;background:#0b263d}",
   ".lucifer-table-details>summary{font-weight:700;color:#f2f6fc;cursor:pointer;padding:8px;line-height:1.4}",
   ".lucifer-table-details[open]>summary{margin-bottom:10px}",
   "@media(max-width:760px){.lucifer-result-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.lucifer-category-list{grid-template-columns:minmax(0,1fr)}.lucifer-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.lucifer-category-card{padding:12px}.lucifer-table-details{margin:12px 0}}",
   "@media(max-width:390px){.lucifer-facts{grid-template-columns:minmax(0,1fr)}}"
 ].join("\n");
 document.head.append(summaryStyles);
 function resultNode(tag,cls,value){
   const e=document.createElement(tag);
   if(cls)e.className=cls;
   if(value!==undefined)e.textContent=String(value);
   return e;
 }
 function resultStat(label,value){
   const card=resultNode("div","lucifer-stat");
   card.append(resultNode("span","lucifer-stat-name",label),resultNode("strong","lucifer-stat-value",value));
   return card;
 }
 function resultFact(label,value){
   const fact=resultNode("div","lucifer-fact");
   fact.append(resultNode("dt","",label),resultNode("dd","",value));
   return fact;
 }
 function categorySummary(r,entries){
   const card=resultNode("article","lucifer-category-card");
   const h=resultNode("h4","lucifer-category-title",r.category+" · ");
   h.append(resultNode("span","lucifer-category-id",r.riskId));
   const dl=resultNode("dl","lucifer-facts");
   for(const [label,value] of entries)dl.append(resultFact(label,value));
   card.append(h,dl);
   return card;
 }
 function fullExcelTable(title,...content){
   const details=resultNode("details","lucifer-table-details");
   // On phones, show the readable results first; the original wide table is optional.
   details.open=!(typeof window.matchMedia==="function"&&window.matchMedia("(max-width:760px)").matches);
   details.append(resultNode("summary","",title),...content);
   return details;
 }
 function riskOverview(d){
   const section=resultNode("section","lucifer-result-overview");
   section.setAttribute("aria-label","Обобщение на оценката на риска");
   section.append(resultNode("h3","lucifer-result-heading","Резултати от въведените инциденти"));
   section.append(resultNode("p","lucifer-result-intro","Стойностите са от локалния регистър в този браузър. Показани са само категориите с случаи в основната оценка; останалите са в пълната Excel таблица."));
   const stats=resultNode("div","lucifer-result-stats");
   stats.append(resultStat("Въведени инциденти",d.all.length),resultStat("В основна оценка",d.real.length),
     resultStat("Щети в основната оценка",cash(d.real.reduce((s,r)=>s+r.damage,0))),
     resultStat("Кражби за проверка",d.review.length));
   section.append(stats);
   const cards=resultNode("div","lucifer-category-list");
   for(const r of d.risks.filter(x=>x.count>0)){
     cards.append(categorySummary(r,[
       ["Брой инциденти",r.count],
       ["Средна щета",cash(r.meanDamage)],
       ["Максимална щета",cash(r.maxDamage)],
       ["Експертна тежест H (средна)",num(r.meanSeverity)],
       ["Предварителна категория риск",r.finalRisk],
       ["Вероятност в набора",percent(r.frequency)]
     ]));
   }
   section.append(cards.childElementCount?cards:resultNode("p","lucifer-result-intro","Няма допустими инциденти за основна оценка."));
   section.append(note("Оценката е предварителна и НЕОДОБРЕНА. Проверка на безопасността и останалите контроли предстоят."));
   return section;
 }

 /* Excel 'Приоритет за третиране' F:I: verified arithmetic only.
    A preliminary financial comparison is NOT an operational priority.
    Unverified safety/document checks keep K, L, Y and Z blocked. */
 function financialPreview(d){
   const rows=d.risks.map(r=>{
     const group=d.real.filter(x=>x.category===r.category);
     const loss=group.reduce((sum,x)=>sum+x.damage,0);
     return {riskId:r.riskId,loss,maxDamage:r.count?r.maxDamage:0,
       base:r.count?r.financialIndex:0,active:r.count>0,
       normalizedLoss:0,normalizedBase:0,normalizedMax:0,score:0,rank:null};
   });
   const valid=rows.filter(x=>x.active);
   if(valid.some(x=>![x.loss,x.maxDamage,x.base].every(n)))
     throw Error("Липсват данни за предварителния финансов резултат");
   const maxLoss=Math.max(0,...valid.map(x=>x.loss));
   const maxBase=Math.max(0,...valid.map(x=>x.base));
   const maxDamage=Math.max(0,...valid.map(x=>x.maxDamage));
   for(const x of valid){
     x.normalizedLoss=maxLoss>0?x.loss/maxLoss:0;
     x.normalizedBase=maxBase>0?x.base/maxBase:0;
     x.normalizedMax=maxDamage>0?x.maxDamage/maxDamage:0;
     // Excel I2: a category with zero total material losses receives 0.
     x.score=x.loss===0?0:
       x.normalizedLoss*0.55+x.normalizedBase*0.30+x.normalizedMax*0.15;
   }
   for(const x of valid){
     // Dense-independent competition order. Identical scores share a rank.
     x.rank=1+valid.filter(y=>y.score>x.score+1e-12).length;
   }
   return rows;
 }
 function scoreText(value){
   return n(value)?value.toLocaleString("bg-BG",{minimumFractionDigits:3,maximumFractionDigits:3}):pending;
 }
 function safetyFor(d,r,f){
   const module=window.LuciferSafetyPriority;
   if(!module||typeof module.evaluate!=="function")
     throw Error("Липсва модулът за проверка на безопасността");
   return module.evaluate(d,r,f);
 }
 function priorityOverview(d){
   const section=resultNode("section","lucifer-result-overview");
   section.setAttribute("aria-label","Безопасност и оперативни приоритети");
   section.append(resultNode("h3","lucifer-result-heading","Приоритет и защита на хората — предварителна оценка"));
   section.append(resultNode("p","lucifer-result-intro","Въз основа на Excel се съчетават експертната категория риск, финансовият резултат и проверката на опасността за хората. Няма автоматично официално одобрение в тази DEMO версия."));
   const active=d.risks.filter(r=>r.count>0);
   const preview=financialPreview(d);
   const assessments=active.map(r=>safetyFor(d,r,preview.find(f=>f.riskId===r.riskId)));
   const stats=resultNode("div","lucifer-result-stats");
   stats.append(resultStat("В основна оценка",d.real.length),
     resultStat("Категории с инциденти",active.length),
     resultStat("Незабавни защитни сигнали",assessments.filter(p=>p.safetyCode===2).length),
     resultStat("Временни защитни сигнали",assessments.filter(p=>p.safetyCode===1).length));
   section.append(stats);
   const cards=resultNode("div","lucifer-category-list");
   for(const r of active){
     const f=preview.find(x=>x.riskId===r.riskId);
     const p=safetyFor(d,r,f);
     cards.append(categorySummary(r,[
       ["Брой инциденти",r.count],
       ["Действителни щети",cash(f.loss)],
       ["Максимална щета",cash(r.maxDamage)],
       ["Категория риск от оценката",r.finalRisk],
       ["Финансов резултат (0–1; неодобрен)",scoreText(f.score)],
       ["Предварителен финансов ред",f.rank],
       ["Изчислен оперативен приоритет (неодобрен)",p.priority],
       ["Защитно действие",p.action],
       ["Проверка на безопасността",p.safetyLabel],
       ["Статус на решението",p.approval],
       ["Следваща проверка",p.blockers.slice(0,2).join("; ")||"Независимата проверка предстои"]
     ]));
   }
   section.append(cards.childElementCount?cards:resultNode("p","lucifer-result-intro","Няма инциденти за оценка."));
   section.append(note("НЕОДОБРЕНО: защитните сигнали имат предимство пред финансовия ред. Въведените в DEMO данни не удостоверяват истинността на доказателствата, самоличността или правата на експерти и проверяващи."));
   return section;
 }

 function getIncidents(){
   const raw=localStorage.getItem(INCIDENT_KEY),rows=raw===null?[]:JSON.parse(raw);
   if(!Array.isArray(rows)||rows.length>399)throw Error("Невалиден регистър");
   const ids=new Set();
   for(const r of rows){if(!r||typeof r!=="object"||!/^INC-\d{3}$/.test(r.id)||ids.has(r.id))
     throw Error("Невалиден или повторен ID");
     ids.add(r.id)}
   return rows;
 }
 function calculations(){
   const all=getIncidents();
   const verified=r=>r.evidence==="Проверени — потвърдено"&&typeof r.reference==="string"&&r.reference.trim().length>0;
   const prevented=all.filter(r=>r.category==="Кражба"&&r.prevented==="yes"&&verified(r));
   const review=all.filter(r=>r.category==="Кражба"&&(r.prevented==="yes"||!verified(r))&&!prevented.includes(r));
   const real=all.filter(r=>r.category!=="Кражба"||(r.prevented!=="yes"&&verified(r)));
   const engine=window.LuciferRiskEngine;
   if(typeof engine?.riskAssessment!=="function")throw Error("Липсва съществуващият модул за оценка");
   return {all,real,prevented,review,risks:engine.riskAssessment(real)};
 }
 function average(rows,key){return rows.length?rows.reduce((sum,r)=>sum+r[key],0)/rows.length:null}
 function riskRow(r){
   if(!r.count)return [r.category,0,"0%","Няма случаи","Няма случаи","Няма случаи","Няма случаи","Няма случаи",0,0,0,"Неоценен","Няма случаи","Няма случаи","Няма случаи",r.riskId,r.riskId==="R-01"?pending:"—","Няма регистрирани инциденти",0,"Неоценен",0,"Няма случаи"];
   return [r.category,r.count,percent(r.frequency),cash(r.meanDamage),cash(r.maxDamage),num(r.meanDetection),num(r.meanReaction),num(r.meanSeverity),num(r.likelihood),num(r.impact),num(r.financialIndex),r.finalRisk,r.controlStatus==="OK"?percent(r.controlEffectiveness):r.controlStatus,num(r.residualFinancialIndex),r.residualRisk??pending,r.riskId,r.riskId==="R-01"?pending:"—","Предварително — контролът на входните данни не е завършен",num(r.expertMax),r.financialCategory,num(r.finalRiskCode),"Неодобрено — проверката на безопасността не е завършена"];
 }
 function drawRisk(d){
   const r=d.risks,all=d.all;
   const values=r.map(riskRow);
   const count=d.real.length;
   const totals=d.real;
   values.push(["ОБЩО / СРЕДНО — 8 основни категории",count,count?"100%":"0%",
    count?cash(average(totals,"damage")):"Няма случаи",
    count?cash(Math.max(...totals.map(x=>x.damage))):"Няма случаи",
    count?num(average(totals,"detect")):"Няма случаи",count?num(average(totals,"react")):"Няма случаи",
    count?num(average(totals.map(x=>({severity:({"Нисък":1,"Среден":2,"Висок":3,"Критичен":4}[x.expert]||0)})),"severity")):"Няма случаи",
    pending,pending,pending,pending,pending,pending,pending,"—","—","Предварителни данни",pending,pending,pending,"Неодобрено"]);
   const prov=d.prevented;
   values.push(["ДОКАЗАНИ ПРЕДОТВРАТЕНИ КРАЖБИ — отделно",prov.length,
     all.length?percent(prov.length/all.length):"0%",pending,pending,
     prov.length?num(average(prov,"detect")):"Няма случаи",
     prov.length?num(average(prov,"react")):"Няма случаи",pending,pending,pending,pending,
     pending,pending,pending,pending,"—","—","Проверете U/O и доказателствата",pending,pending,pending,"Неодобрено"]);
   riskEl.replaceChildren(riskOverview(d),fullExcelTable("Разгледай пълната Excel таблица на риска (A–V)", 
     note("Източник: съществуващият регистър „Инциденти“ ("+all.length+"/399). За основна оценка: "+d.real.length+"; доказани предотвратени кражби: "+d.prevented.length+"; кражби за проверка: "+d.review.length+"."),table(RISK_COLS,values),
     note("Excel A–V: 22 позиции, от които 21 с оригинални заглавия и Q без заглавие. Q2 препраща към „Контрол входни данни“!B19; докато този контрол не е пренесен, стойността е обозначена като неизчислена. В пълната таблица можете да превъртате хоризонтално за колони P–V."),drawRiskDetails(d)));
 }

 // Additional Excel rows 12–29, previously omitted from the web page.
 // This is a direct projection of the verified incident records, not an approval.
 function valueState(value){
   if(value===null||value===undefined||value==="")return "Неизвестна";
   if(typeof value==="number"&&Number.isFinite(value)&&value>=0)return "Числова";
   return "Невалидна";
 }
 function numericStatistics(rows,key){
   const known=rows.filter(r=>valueState(r[key])==="Числова").map(r=>r[key]);
   const unknown=rows.filter(r=>valueState(r[key])==="Неизвестна").length;
   const invalid=rows.length-known.length-unknown;
   const total=known.reduce((s,x)=>s+x,0);
   const status=!rows.length?"Няма случаи":invalid?"Невалидни данни":unknown?
     "Частична — има неизвестни "+key:"Пълна";
   return {known:known.length,unknown,invalid,total,
     average:known.length?total/known.length:"Няма известни стойности",
     maximum:known.length?Math.max(...known):"Няма известни стойности",status};
 }
 function drawRiskDetails(data){
   const block=document.createElement("div");
   const h=document.createElement("h3");
   h.textContent="Excel A13:D22 — U (застрашена стойност) и O (действителни щети)";
   block.append(h);
   const U=numericStatistics(data.prevented,"threatened");
   const O=numericStatistics(data.prevented,"damage");
   const uStatus=!data.prevented.length?"Няма случаи":U.invalid?"Невалидни данни":U.unknown?
     "Частична — има неизвестни U":"Пълна";
   const oStatus=!data.prevented.length?"Няма случаи":O.invalid?"Невалидни данни":O.unknown?
     "Частична — има неизвестни O":"Пълна";
   const actualReal=numericStatistics(data.real,"damage");
   const actualRealTotal=!data.real.length?0:actualReal.invalid?"Непроверени данни":
     actualReal.unknown?"Размерът на щетата не е установен":actualReal.total;
   const actualPreventTotal=!data.prevented.length?0:O.invalid?"Непроверени данни":
     O.unknown?"Размерът на щетата не е установен":O.total;
   // Original Excel A14:D21: two parallel sets of labels and measures.
   const tableRows=[
      ["Брой известни U",U.known,"Брой известни O",O.known],
      ["Брой неизвестни U",U.unknown,"Брой неизвестни O",O.unknown],
      ["Брой невалидни U",U.invalid,"Брой невалидни O",O.invalid],
      ["Обща известна застрашена стойност U",cash(U.total),"Обща известна действителна щета O",cash(O.total)],
      ["Средна застрашена стойност U",U.known?cash(U.average):U.average,
       "Средна действителна щета O",O.known?cash(O.average):O.average],
      ["Максимална известна застрашена U",U.known?cash(U.maximum):U.maximum,
       "Максимална известна действителна O",O.known?cash(O.maximum):O.maximum],
      ["Пълнота на U",uStatus,"Пълнота на O",oStatus],
      ["Действителна O — основни категории",typeof actualRealTotal==="number"?cash(actualRealTotal):actualRealTotal,
       "Действителна O — предотвратени кражби",typeof actualPreventTotal==="number"?cash(actualPreventTotal):actualPreventTotal]
   ];
   block.append(table(["A · ЗАСТРАШЕНА СТОЙНОСТ U","B · ЕВРО",
                        "C · ДЕЙСТВИТЕЛНИ ЩЕТИ O","D · ЕВРО"],tableRows));
   block.append(note("Excel A22–C22: РАЗДЕЛЯНЕ НА O — действителните щети при предотвратяване са отделни от основните категории. U е застрашена стойност; тя не е реализирана загуба."));
   const heading=document.createElement("h3");
   heading.textContent="Excel A24:B29 — Разпределение на експертната тежест H";
   block.append(heading);
   const levels=["Нисък","Среден","Висок","Критичен"];
   const levelRows=levels.map(level=>[level,data.prevented.filter(x=>x.expert===level).length]);
   const counted=levelRows.reduce((s,row)=>s+row[1],0);
   levelRows.push(["Липсващ/невалиден H",data.prevented.length-counted]);
   block.append(table(["A · Разпределение на експертната тежест H","B · Брой"],levelRows));
   block.append(note("Excel A12: ред 11 е сравнителен финансов индекс, а не измерена вероятност. Щетите O се отчитат отделно. Показателите, които зависят от непроверени доказателства, остават предварителни."));
   return block;
 }

 const parameters=[["Тежест на общите загуби",0.55],["Тежест на базовия риск",0.30],["Тежест на максималната щета",0.15],["Праг висок приоритет",0.75],["Праг среден приоритет",0.45],["",""],["Условие","Тълкуване"],["Критичен сценарий","ДА = задължителен критичен приоритет независимо от резултата"]];
 function drawPriority(d){
   const preview=financialPreview(d);
   const checked=d.risks.map((r,i)=>{
     const f=preview.find(x=>x.riskId===r.riskId);
     return {r,f,p:safetyFor(d,r,f),i};
   });
   const results=checked.map(({r,f,p,i})=>{
     const rank=p.priorityCode>0?1+checked.filter(x=>x.p.priorityCode>p.priorityCode).length:"Изисква проверка";
     const flag=p.safetyCode===2?"ДА":p.safetyCode===1?"ВРЕМЕННО":p.safetyCode===0?"НЕ":"НЕПОТВЪРДЕНО";
     return [r.category,r.count,cash(f.loss),r.count?cash(r.maxDamage):"Няма случаи",
       num(f.base),num(f.normalizedLoss),num(f.normalizedBase),num(f.normalizedMax),scoreText(f.score),flag,
       p.priorityCode>0?p.priority+" (НЕОДОБРЕНО)":p.priority,rank,
       "Предварително. Защитата на живота и здравето е с предимство пред финансовия ред.",
       r.riskId,parameters[i][0],parameters[i][1],p.safetyLabel,
       "Проверка на безопасността + категория риск + балансиран финансов резултат.",
       p.approval,p.action,
       p.stale?"Променени входни данни":"Няма удостоверена проверена версия",
       p.priority,num(r.finalRiskCode),p.priorityCode||"Неизчислено",f.rank??"Няма случаи",
       p.approval+" | "+p.blockers.slice(0,2).join("; ")];
   });
   priorityEl.replaceChildren(priorityOverview(d),fullExcelTable("Разгледай пълната Excel таблица за приоритет (26 колони)",
     note("Колони E–I: сравнение по Excel. J–L и кодът на приоритета показват само предварително изчисление, без права за одобрение. При потвърдена опасност се показва незабавно защитно действие дори при липса на документи."),
     table(PRIORITY_COLS,results),
     note("Системата не удостоверява самоличност, права, истинност на доказателствата или проверена версия. Окончателното одобрение остава блокирано.")));
 }

 function readPlan(){
   const raw=localStorage.getItem(PLAN_KEY),rows=raw===null?[]:JSON.parse(raw);
   if(!Array.isArray(rows)||rows.length>1000)throw Error("Невалидни данни за плана");
   const ids=new Set();
   for(const r of rows){
     if(!r||typeof r.internalId!=="string"||ids.has(r.internalId)||!/^R-0[1-8]$/.test(r.riskId)||
       FIELDS.some(k=>typeof r[k]!=="string"))throw Error("Невалиден ред в плана");
     ids.add(r.internalId);
   }
   return rows;
 }
 let editing=null;
 function planField(k){return $("plan-"+(k==="riskId"?"risk-id":k))}
 function drawPlan(){
   try{
     const items=readPlan();
     planEl.replaceChildren(table(PLAN_COLS,items.map(item=>FIELDS.map(k=>item[k]||"—"))),
       note(items.length+" локално записани мерки. Планът не е одобрен и не променя инцидентите."));
     const choose=$("plan-row-picker");choose.replaceChildren(new Option("Нова мярка",""));
     for(const item of items)choose.append(new Option(item.riskId+" · "+item.measure,item.internalId));
     if(editing&&items.some(x=>x.internalId===editing))choose.value=editing;
     else {editing=null;choose.value=""}
   }catch(e){planEl.textContent="Не може да се прочете планът: "+e.message+". Данните са запазени."; $("treatment-form").querySelector('[type="submit"]').disabled=true}
 }
 function clearPlan(){
   editing=null;
   $("treatment-form").reset();
   $("plan-row-picker").value="";
   planField("risk").value=TYPES[Number(planField("riskId").value.slice(-2))-1]||"";
   $("plan-message").textContent="";
 }
 const sel=planField("riskId");
 TYPES.forEach((name,i)=>sel.append(new Option("R-"+String(i+1).padStart(2,"0")+" · "+name,"R-"+String(i+1).padStart(2,"0"))));
 sel.addEventListener("change",()=>{if(!editing)planField("risk").value=TYPES[Number(sel.value.slice(-2))-1]||""});
 $("plan-row-picker").addEventListener("change",()=>{
   const id=$("plan-row-picker").value;
   if(!id){clearPlan();return}
   try{
     const item=readPlan().find(x=>x.internalId===id);
     if(!item)throw Error("Мярката липсва");
     editing=id;FIELDS.forEach(k=>{planField(k).value=item[k]});
     $("plan-message").textContent="Редактирате локално записана мярка.";
   }catch(e){$("plan-message").textContent=e.message}
 });
 $("plan-clear").addEventListener("click",clearPlan);
 $("treatment-form").addEventListener("submit",event=>{
   event.preventDefault();
   try{
     const plan=readPlan(),values=Object.fromEntries(FIELDS.map(k=>[k,planField(k).value.trim()]));
     if(!/^R-0[1-8]$/.test(values.riskId)||!values.risk||!values.measure)throw Error("Изберете Risk ID, риск и мярка");
     if(editing){
       const index=plan.findIndex(r=>r.internalId===editing);
       if(index<0)throw Error("Редът не е намерен");
       plan[index]={...plan[index],...values};
     }else{
       if(plan.length>=1000)throw Error("Лимит от 1000 локални мерки");
       const newId="PLAN-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
       plan.push({...values,internalId:newId});
     }
     localStorage.setItem(PLAN_KEY,JSON.stringify(plan));
     clearPlan();drawPlan();
     $("plan-message").textContent="Мярката е записана само в този браузър.";
   }catch(e){$("plan-message").textContent="Записът не е извършен: "+e.message}
 });
 function render(){
   let d;
   try{d=calculations()}
   catch(e){const message="Изчислението е блокирано: "+e.message+". Инцидентите не са променени.";riskEl.textContent=message;priorityEl.textContent=message;return}
   // A damaged safety-review record must not hide otherwise valid risk calculations.
   try{drawRisk(d)}catch(e){riskEl.textContent="Не може да се покаже оценката на риска: "+e.message}
   try{drawPriority(d)}catch(e){priorityEl.textContent="Проверката на безопасността/приоритета е блокирана: "+e.message+". Инцидентите са запазени."}
 }
 window.addEventListener("lucifer:incidents-changed",render);
 window.addEventListener("lucifer:safety-changed",render);
 window.addEventListener("lucifer:tab-changed",e=>{if(["home","risk","priority"].includes(e.detail?.tab)){render();drawPlan()}});
 window.addEventListener("storage",e=>{if([INCIDENT_KEY,"lucifer-web-safety-review-demo-v1",null].includes(e.key))render();if(e.key===PLAN_KEY||e.key===null)drawPlan()});
 clearPlan();drawPlan();render();
})();
