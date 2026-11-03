"use strict";
/* LUCIFER-WEB DEMO: Safety review and safety-first priority assessment.
   Excel sources: 'Проверка безопасност' AL/AM, 'Приоритет за третиране' J/K/W/Y.
   This browser-only prototype NEVER validates real identity, authority, or documents.
   It does not issue an approved decision. Records stay in localStorage, apart from incidents. */
(() => {
 const REVIEW_KEY="lucifer-web-safety-review-demo-v1";
 const INCIDENT_KEY="lucifer-web-site-001-demo-v1";
 const CATEGORIES=[
  "Нерегламентиран достъп","Кражба","Конфликт","Вандализъм",
  "Технически отказ","Забравен/подозрителен предмет","Инцидент на паркинг","Пожарен сигнал"
 ];
 const riskId=i=>"R-"+String(i+1).padStart(2,"0");
 const riskIndex=id=>/^R-0[1-8]$/.test(id)?Number(id.slice(-2))-1:-1;
 const text=v=>typeof v==="string"?v.trim():"";
 const nonempty=v=>text(v).length>0;
 const defaults={
  checkStatus:"Непроверено",signal:"Неоценена",severity:"Неоценена",
  description:"",basis:"",source:"",evidenceRef:"",evidenceStatus:"Не са проверени",
  evaluator:"",reviewDate:"",firstReviewer:"",firstDate:"",firstOpinion:"Непроверено",
  firstMotive:"",secondReviewer:"",secondDate:"",secondOpinion:"Непроверено",
  secondMotive:"",measure:"",owner:"",deadline:"",version:""
 };
 const allowed={
  checkStatus:["Непроверено","Потвърдена опасност","Проверено — без непосредствена опасност"],
  signal:["Неоценена","Подозирана","Потвърдена","Не е установена"],
  severity:["Неоценена","Тежка","Друга","Не е установена"],
  evidenceStatus:["Не са проверени","Недостатъчни","Проверени — достатъчни"],
  firstOpinion:["Непроверено","Съгласен","Не съм съгласен","Не мога да потвърдя"],
  secondOpinion:["Непроверено","Съгласен","Не съм съгласен","Не мога да потвърдя"]
 };
 function validate(r){
  if(!r||typeof r!=="object"||Array.isArray(r))throw Error("Невалиден запис за безопасност");
  const o={};
  for(const [k,def] of Object.entries(defaults)){
   const value=r[k]===undefined?def:r[k];
   if(typeof value!=="string"||value.length>800)throw Error("Невалидно поле за безопасност: "+k);
   if(allowed[k]&&!allowed[k].includes(value))throw Error("Невалидна стойност за безопасност: "+k);
   o[k]=value;
  }
  if(typeof r.incidentSnapshot!=="string"||r.incidentSnapshot.length>200000)
   throw Error("Невалиден отпечатък на входните данни");
  o.incidentSnapshot=r.incidentSnapshot;
  return o;
 }
 function read(){
  const raw=localStorage.getItem(REVIEW_KEY);
  if(raw===null)return {};
  if(raw.length>300000)throw Error("Твърде много локални данни за безопасност");
  const object=JSON.parse(raw);
  if(!object||typeof object!=="object"||Array.isArray(object))throw Error("Невалиден регистър за безопасност");
  if(Object.keys(object).length>8)throw Error("Невалиден брой оценки за безопасност");
  const parsed={};
  for(const [id,value] of Object.entries(object)){
   if(riskIndex(id)<0)throw Error("Невалиден Risk ID в регистъра за безопасност");
   parsed[id]=validate(value);
  }
  return parsed;
 }
 function snapshot(rows,id){
  const index=riskIndex(id);
  if(index<0||!Array.isArray(rows))throw Error("Невалиден Risk ID за контрол");
  const subset=rows.filter(r=>r.category===CATEGORIES[index]).map(r=>[
   r.id,r.date,r.category,r.expert,r.damage,r.threatened,r.prevented,
   r.evidence,r.reference,r.result,r.detect,r.react,r.cctv,r.access,r.sot
  ]);
  subset.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify(subset);
 }
 function localIncidents(){
  const raw=localStorage.getItem(INCIDENT_KEY);
  const rows=raw===null?[]:JSON.parse(raw);
  if(!Array.isArray(rows)||rows.length>399||rows.some(r=>!r||!/^INC-\d{3}$/.test(r.id)))
   throw Error("Невалиден регистър „Инциденти“");
  return rows;
 }
 function safetySignal(review,stale){
  if(!review)return -1;
  const d=review.checkStatus,o=review.signal,p=review.severity;
  // Excel AL: protect people even if input documents are incomplete.
  if(d==="Потвърдена опасност"||o==="Потвърдена")return 2;
  if(o==="Подозирана"&&(p==="Тежка"||p==="Неоценена"))return 1;
  // Changed incident evidence invalidates the assertion of safety.
  if(!stale&&d==="Проверено — без непосредствена опасност"&&o==="Не е установена")return 0;
  return -1;
 }
 function contradictions(r){
  if(!r)return [];
  const list=[];
  if(r.checkStatus==="Потвърдена опасност"&&r.signal==="Не е установена")
   list.push("Противоречие между потвърдена опасност и липса на сигнал");
  if(r.checkStatus==="Проверено — без непосредствена опасност"&&
     (r.signal==="Подозирана"||r.signal==="Потвърдена"))
   list.push("Противоречие между проверката и експертния сигнал");
  if(["Подозирана","Потвърдена"].includes(r.signal)&&r.severity==="Не е установена")
   list.push("Противоречива степен на опасност");
  if(r.evidenceStatus==="Проверени — достатъчни"&&(!nonempty(r.evidenceRef)||!nonempty(r.firstReviewer)||!nonempty(r.firstDate)))
   list.push("Заявени проверени доказателства без препратка и проверяващ");
  return list;
 }
 function requiresSecond(r,signal){
  return !!r&&(r.severity==="Тежка"||(signal>0&&r.severity==="Неоценена"));
 }
 function approvalBlockers(r,signal,stale,conflicts){
  const blockers=[...conflicts];
  if(!r){blockers.push("Няма въведена проверка на безопасността");return blockers}
  if(stale)blockers.push("Инцидентите са променени след проверката");
  if(signal<0||r.signal==="Подозирана"||r.severity==="Неоценена")
   blockers.push("Опасността не е изяснена");
  for(const [key,label] of [
   ["description","Описание на опасността"],["basis","Основание за решение"],
   ["source","Източник на информация"],["evidenceRef","Доказателство — ID/версия"],
   ["evaluator","Оценяващ експерт"],["firstReviewer","Първи проверяващ"],
   ["reviewDate","Дата на оценката"],["firstDate","Дата на проверката"],
   ["deadline","Срок за повторна оценка"]
  ])if(!nonempty(r[key]))blockers.push("Липсва: "+label);
  if(signal>0&&(!nonempty(r.measure)||!nonempty(r.owner)))
   blockers.push("Липсва защитна мярка или отговорник");
  if(r.evidenceStatus!=="Проверени — достатъчни")
   blockers.push("Доказателствата не са проверени като достатъчни");
  if(nonempty(r.evaluator)&&r.evaluator===r.firstReviewer)
   blockers.push("Оценяващият и първият проверяващ трябва да са различни");
  if(r.firstOpinion!=="Съгласен")
   blockers.push("Първото становище не е положително");
  if(requiresSecond(r,signal)||nonempty(r.secondReviewer)||r.secondOpinion!=="Непроверено"){
   if(!nonempty(r.secondReviewer)||!nonempty(r.secondDate)||r.secondOpinion!=="Съгласен")
    blockers.push("Необходим е втори проверяващ с положително становище");
   if(nonempty(r.secondReviewer)&&[r.evaluator,r.firstReviewer].includes(r.secondReviewer))
    blockers.push("Вторият проверяващ трябва да бъде различно лице");
  }
  if(["Не съм съгласен","Не мога да потвърдя"].includes(r.firstOpinion)&&!nonempty(r.firstMotive))
   blockers.push("Липсват мотиви за първото становище");
  if(["Не съм съгласен","Не мога да потвърдя"].includes(r.secondOpinion)&&!nonempty(r.secondMotive))
   blockers.push("Липсват мотиви за второто становище");
  if(r.firstOpinion==="Не съм съгласен"||r.secondOpinion==="Не съм съгласен")
   blockers.push("Несъгласие блокира одобрението");
  if(!/^[1-9]\d{0,4}$/.test(text(r.version)))
   blockers.push("Липсва валиден номер на версия");
  // Browser form cannot prove signature, identity or permissions; never return approved.
  blockers.push("Липсва независима проверка на правомощията и версията в сървър");
  return blockers;
 }
 function evaluate(d,r,financial){
  if(!r||riskIndex(r.riskId)<0||!Array.isArray(d.all))
   throw Error("Невалиден риск за оценка на безопасността");
  const entry=read()[r.riskId]||null;
  const stale=!!entry&&entry.incidentSnapshot!==snapshot(d.all,r.riskId);
  const conflicts=contradictions(entry);
  const signal=safetySignal(entry,stale);
  const blocked=approvalBlockers(entry,signal,stale,conflicts);
  const code=r.count>0?r.finalRiskCode:0;
  let priority="Неоценен";
  if(r.count>0){
   if(signal===2)priority="Критичен";
   else if(code===4)priority="Критичен";
   else if(signal===1)priority="Временно критичен";
   else if(code===3)priority="Висок";
   else if(signal<0)priority="Изисква проверка";
   else if(!financial||typeof financial.score!=="number"||!Number.isFinite(financial.score))
    priority="Изисква проверка";
   else if(financial.score>=0.75)priority="Висок";
   else if(financial.score>=0.45||code===2)priority="Среден";
   else priority="Планов";
  }
  const priorityCode=priority==="Критичен"||priority==="Временно критичен"?4:
   priority==="Висок"?3:priority==="Среден"?2:priority==="Планов"?1:0;
  const action=signal===2?"Незабавно защитно действие":
   signal===1?"Временно защитно действие":
   signal===0?"Финансово-рисков ред след проверка":"Изисква експертен преглед";
  let label=entry?"Проверка въведена — без официално одобрение":"Проверка не е въведена";
  if(stale)label="Входните данни са променени — необходима е повторна проверка";
  if(conflicts.length)label="Противоречиви данни — необходимо изясняване";
  if(signal===2)label="Сигнал за потвърдена опасност — незабавна защитна реакция";
  else if(signal===1)label="Подозирана тежка опасност — временно защитно действие";
  return {
   riskId:r.riskId, priority,priorityCode,action,safetyCode:signal,
   safetyLabel:label,checked:!!entry,stale,conflicts,
   secondCheckerRequired:requiresSecond(entry,signal),blockers:blocked,
   approval:"НЕОДОБРЕНО",verifiedBySystem:false
  };
 }
 function write(id,fields){
  if(riskIndex(id)<0)throw Error("Невалиден Risk ID");
  const rows=localIncidents();
  if(!rows.some(r=>r.category===CATEGORIES[riskIndex(id)]))
   throw Error("За избраната категория няма инциденти");
  const updated=read();
  updated[id]=validate({...defaults,...fields,incidentSnapshot:snapshot(rows,id)});
  localStorage.setItem(REVIEW_KEY,JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent("lucifer:safety-changed",{detail:{riskId:id}}));
 }
 function remove(id){
  if(riskIndex(id)<0)throw Error("Невалиден Risk ID");
  const entries=read();delete entries[id];
  localStorage.setItem(REVIEW_KEY,JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("lucifer:safety-changed",{detail:{riskId:id}}));
 }
 const fieldSpecs=[
  ["checkStatus","D · Статус на проверката","select",allowed.checkStatus],
  ["signal","O · Експертен сигнал","select",allowed.signal],
  ["severity","P · Степен на опасност","select",allowed.severity],
  ["description","B · Описание на опасността","textarea"],
  ["basis","I · Основание за решение","textarea"],
  ["source","Q · Източник на информация (код, без лични данни)","text"],
  ["evidenceRef","R · Доказателство — ID и версия (без съдържание)","text"],
  ["evidenceStatus","T · Достатъчност на доказателствата (декларация)","select",allowed.evidenceStatus],
  ["evaluator","S · Оценяващ — тестов ID","text"],
  ["reviewDate","G · Дата на оценката","date"],
  ["firstReviewer","U · Първи проверяващ — тестов ID","text"],
  ["firstDate","V · Дата на първата проверка","date"],
  ["firstOpinion","AB · Становище 1","select",allowed.firstOpinion],
  ["firstMotive","AC · Мотиви 1 (при несъгласие)","textarea"],
  ["secondReviewer","AD · Втори проверяващ — тестов ID","text"],
  ["secondDate","AG · Дата на втория проверяващ","date"],
  ["secondOpinion","AE · Становище 2","select",allowed.secondOpinion],
  ["secondMotive","AF · Мотиви 2","textarea"],
  ["measure","E · Временна или незабавна защитна мярка","textarea"],
  ["owner","F · Отговорник — тестов ID","text"],
  ["deadline","K · Срок за повторна оценка","date"],
  ["version","AI · Номер на проверяваната версия","text"]
 ];
 function init(){
  const section=document.getElementById("priority"),results=document.getElementById("priority-results");
  if(!section||!results)return;
  const style=document.createElement("style");
  style.textContent=".safety-review-box{margin:20px 0;padding:14px;border:1px solid #547393;border-radius:11px;background:#0d2a42;color:#f3f7fe}"+
   ".safety-review-box summary{font-size:1.07rem;font-weight:700;cursor:pointer;padding:5px 0}"+
   ".safety-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}"+
   ".safety-review-field{display:flex;flex-direction:column;gap:6px;min-width:0}"+
   ".safety-review-field label{font-size:.89rem;color:#d6e6f3;font-weight:600}"+
   ".safety-review-field input,.safety-review-field select,.safety-review-field textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid #66819f;border-radius:8px;background:#071a2d;color:white;font:inherit;padding:10px}"+
   ".safety-review-field textarea{min-height:74px;resize:vertical}"+
   ".safety-review-actions{display:flex;flex-wrap:wrap;gap:10px}"+
   ".safety-review-actions button{font:inherit;padding:10px 12px}"+
   "@media(max-width:700px){.safety-review-grid{grid-template-columns:minmax(0,1fr)}}";
  document.head.append(style);
  const wrapper=document.createElement("div");wrapper.className="safety-review-box";
  const details=document.createElement("details");
  const summary=document.createElement("summary");
  summary.textContent="Проверка на безопасността по Risk ID — тестов въвеждащ модул";
  details.append(summary);
  const warn=document.createElement("p");
  warn.textContent="DEMO: локална експертна декларация, не доказателство и не одобрение. При реална опасност се следват приложимите процедури за защита на хората. Не въвеждайте лични данни или съдържание на документи.";
  details.append(warn);
  const form=document.createElement("form");form.id="safety-review-form";
  const chooser=document.createElement("div");chooser.className="safety-review-field";
  const chooseLabel=document.createElement("label");chooseLabel.htmlFor="safety-riskid";chooseLabel.textContent="Категория / Risk ID";
  const choose=document.createElement("select");choose.id="safety-riskid";
  CATEGORIES.forEach((cat,i)=>{const option=document.createElement("option");option.value=riskId(i);option.textContent=riskId(i)+" · "+cat;choose.append(option)});
  chooser.append(chooseLabel,choose);form.append(chooser);
  const grid=document.createElement("div");grid.className="safety-review-grid";
  const inputs={};
  for(const [key,label,type,options] of fieldSpecs){
   const wrap=document.createElement("div");wrap.className="safety-review-field";
   const lab=document.createElement("label");lab.htmlFor="safety-"+key;lab.textContent=label;
   const el=document.createElement(type==="select"?"select":type==="textarea"?"textarea":"input");
   el.id="safety-"+key;el.name=key;
   if(type!=="select"&&type!=="textarea"){el.type=type;el.maxLength=800}
   if(type==="textarea")el.maxLength=800;
   if(type==="select")for(const value of options){const opt=document.createElement("option");opt.value=value;opt.textContent=value;el.append(opt)}
   wrap.append(lab,el);grid.append(wrap);inputs[key]=el;
  }
  form.append(grid);
  const actions=document.createElement("div");actions.className="safety-review-actions";
  const save=document.createElement("button");save.type="submit";save.textContent="Запази тестовата проверка локално";
  const clear=document.createElement("button");clear.type="button";clear.textContent="Изчисти само тази проверка";
  actions.append(save,clear);form.append(actions);
  const state=document.createElement("p");state.setAttribute("role","status");state.setAttribute("aria-live","polite");form.append(state);
  function load(){
   try{
    const r=read()[choose.value]||defaults;
    for(const [key,el] of Object.entries(inputs))el.value=r[key]??defaults[key];
    state.textContent=read()[choose.value]?"Заредена локална проверка — НЕОДОБРЕНА.":"Няма записана проверка за този Risk ID.";
   }catch(e){state.textContent="Проблем при зареждане: "+e.message;save.disabled=true}
  }
  choose.addEventListener("change",load);
  form.addEventListener("submit",event=>{
   event.preventDefault();
   try{
    const values=Object.fromEntries(Object.entries(inputs).map(([k,el])=>[k,el.value.trim()]));
    write(choose.value,values);state.textContent="Тестовата проверка е записана само в този браузър. Одобрение НЕ е извършено.";
   }catch(e){state.textContent="Не е записано: "+e.message}
  });
  clear.addEventListener("click",()=>{
   if(!window.confirm("Да се изчисти само тестовата проверка за "+choose.value+"? Инцидентите няма да се променят."))return;
   try{remove(choose.value);load()}catch(e){state.textContent="Проверката не е изчистена: "+e.message}
  });
  details.append(form);wrapper.append(details);results.insertAdjacentElement("afterend",wrapper);
  load();
 }
 window.LuciferSafetyPriority=Object.freeze({evaluate,read,write,remove,snapshot,safetySignal,contradictions,approvalBlockers});
 if(typeof document!=="undefined")init();
})();