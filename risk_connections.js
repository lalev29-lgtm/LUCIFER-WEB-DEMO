"use strict";
/* Direct Excel-column projection. Workbook: Луцефер-Знанието е сила(7).xlsx.
 * Preserve the existing incident register and its localStorage key.
 * Never infer approvals or substitute an invented safety decision.
 */
(() => {
 const INCIDENT_KEY="lucifer-web-site-001-demo-v1";
 const PLAN_KEY="lucifer-web-treatment-plan-v1";
 const RISK_COLS=["Тип инцидент","Брой инциденти","Вероятност в набора","Средна щета (евро)","Макс. щета (евро)","Средно откриване (мин)","Средна реакция (мин)","Средна тежест (1–4)","Вероятност (1–5)","Последствия (1–5)","Финансов индекс","Крайна категория на риска","Ефективност на контрол (%)","Остатъчен финансов риск","Крайна категория на остатъчния риск","Risk ID (постоянен ключ)","Статус на данните (тест)","Максимално експертно ниво 1–4","Финансова категория","Код на крайната категория","Статус на оценката"];
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
   heads.forEach(t=>{const th=document.createElement("th");th.textContent=t;h.append(th)});
   const body=tbl.createTBody();
   for(const cells of rows){if(cells.length!==heads.length)throw Error("Несъответствие в броя на колоните");
     const tr=body.insertRow();
     for(const val of cells){const td=tr.insertCell();td.textContent=String(val??"—")}}
   if(!rows.length){const td=body.insertRow().insertCell();td.colSpan=heads.length;td.textContent="Няма записи"}
   outer.append(tbl);return outer;
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
   if(!r.count)return [r.category,0,"0%","Няма случаи","Няма случаи","Няма случаи","Няма случаи","Няма случаи",0,0,0,"Неоценен","Няма случаи","Няма случаи","Няма случаи",r.riskId,"Няма регистрирани инциденти",0,"Неоценен",0,"Няма случаи"];
   return [r.category,r.count,percent(r.frequency),cash(r.meanDamage),cash(r.maxDamage),num(r.meanDetection),num(r.meanReaction),num(r.meanSeverity),num(r.likelihood),num(r.impact),num(r.financialIndex),r.finalRisk,r.controlStatus==="OK"?percent(r.controlEffectiveness):r.controlStatus,num(r.residualFinancialIndex),r.residualRisk??pending,r.riskId,"Предварително — контролът на входните данни не е завършен",num(r.expertMax),r.financialCategory,num(r.finalRiskCode),"Неодобрено — проверката на безопасността не е завършена"];
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
    pending,pending,pending,pending,pending,pending,pending,"—","Предварителни данни",pending,pending,pending,"Неодобрено"]);
   const prov=d.prevented;
   values.push(["ДОКАЗАНИ ПРЕДОТВРАТЕНИ КРАЖБИ — отделно",prov.length,
     all.length?percent(prov.length/all.length):"0%",pending,pending,
     prov.length?num(average(prov,"detect")):"Няма случаи",
     prov.length?num(average(prov,"react")):"Няма случаи",pending,pending,pending,pending,
     pending,pending,pending,pending,"—","Проверете U/O и доказателствата",pending,pending,pending,"Неодобрено"]);
   riskEl.replaceChildren(note("Източник: съществуващият регистър „Инциденти“ ("+all.length+"/399). За основна оценка: "+d.real.length+"; доказани предотвратени кражби: "+d.prevented.length+"; кражби за проверка: "+d.review.length+"."),table(RISK_COLS,values),
     note("Пълната структура на Excel „Оценка на риска“ е показана (21 озаглавени колони). Стойностите са предварителни от съществуващия модул; липсващите междулистови зависимости са ясно означени."));
 }
 const parameters=[["Тежест на общите загуби",0.55],["Тежест на базовия риск",0.30],["Тежест на максималната щета",0.15],["Праг висок приоритет",0.75],["Праг среден приоритет",0.45],["",""],["Условие","Тълкуване"],["Критичен сценарий","ДА = задължителен критичен приоритет независимо от резултата"]];
 function drawPriority(d){
   const results=d.risks.map((r,i)=>{
     const group=d.real.filter(x=>x.category===r.category);
     const loss=group.reduce((sum,x)=>sum+x.damage,0);
     return [r.category,r.count,cash(loss),r.count?cash(r.maxDamage):"Няма случаи",
       pending,pending,pending,pending,pending,"НЕПОТВЪРДЕНО",
       "Изисква проверка","Неизчислено",
       "ПРЕДВАРИТЕЛЕН финансово-рисков ред; безопасността на хората се оценява отделно и има предимство.",
       r.riskId,parameters[i][0],parameters[i][1],"Проверка на безопасността не е завършена",
       "За хората: първо проверка; при липса на потвърден критичен сценарий — балансираният модел",
       "НЕОДОБРЕНО",pending,pending,pending,num(r.finalRiskCode),pending,pending,
       "НЕОДОБРЕНО | липсва проверка безопасност"];
   });
   priorityEl.replaceChildren(note("Данните са свързани по Risk ID със същите инциденти и „Оценка на риска“. Клетките, зависещи от „Балансирана оценка“ и „Проверка безопасност“, не са подменени с измислени изчисления."),table(PRIORITY_COLS,results),
    note("Представени са всички 26 озаглавени колони от Excel „Приоритет за третиране“. Не е определен окончателен оперативен приоритет."));
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
   try{const d=calculations();drawRisk(d);drawPriority(d)}
   catch(e){const message="Изчислението е блокирано: "+e.message+". Инцидентите не са променени.";riskEl.textContent=message;priorityEl.textContent=message;}
 }
 window.addEventListener("lucifer:incidents-changed",render);
 window.addEventListener("lucifer:tab-changed",e=>{if(["home","risk","priority"].includes(e.detail?.tab)){render();drawPlan()}});
 window.addEventListener("storage",e=>{if(e.key===INCIDENT_KEY||e.key===null)render();if(e.key===PLAN_KEY||e.key===null)drawPlan()});
 clearPlan();drawPlan();render();
})();
