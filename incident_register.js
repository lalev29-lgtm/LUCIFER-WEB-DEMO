"use strict";
(()=>{
const ROOT="lucifer-standalone-register-v1",LINK="lucifer-standalone-register-links-v1",SYNC="lucifer-standalone-register-sync-v1",TARGET="lucifer-web-site-001-demo-v1";
const BASE=ROOT+"-baseline",LAST=ROOT+"-last-inc-v2",BACKUP=ROOT+"-pre-inc-migration-backup-v2",TRANSFER=ROOT+"-transfer-journal-v2",MAX_ID=5000,ANALYTIC_MAX=399;
const fields=["id","date","time","weekday","shift","zone","category","damage","threatened","description","actions","coordination","source","author","expert","guards","visitors","detect","react","cctv","access","sot"];
const $=id=>document.getElementById(id),str=v=>String(v??"");
function status(message,warning=false){const el=$("status");el.textContent=message;el.dataset.level=warning?"warning":"normal";}
const parse=(key,otherwise)=>{const v=localStorage.getItem(key);return v===null?otherwise:JSON.parse(v)};
const validId=id=>/^INC-\d{3,4}$/.test(id)&&Number(id.slice(4))>=1&&Number(id.slice(4))<=MAX_ID&&id===fmtId(Number(id.slice(4)));
const validAnalyticId=id=>validId(id)&&Number(id.slice(4))<=ANALYTIC_MAX;
const legacyId=id=>/^REG-\d{4}$/.test(id)&&Number(id.slice(4))>0;
const idNum=id=>validId(id)?Number(id.slice(4)):0;
const fmtId=n=>"INC-"+String(n).padStart(3,"0");
function targetRows(){
 const rows=parse(TARGET,[]);
 if(!Array.isArray(rows)||rows.length>ANALYTIC_MAX||rows.some(r=>!r||!validAnalyticId(r.id)))throw Error("Невалидни INC идентификатори в лист „Инциденти“");
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("Повтарящ се INC ID в лист „Инциденти“");
 return rows;
}
function idError(id,origin){return "ID "+id+" вече е заето в "+origin+". Записът НЕ е прехвърлен и никой съществуващ запис не е заменен."}
function legacyCheck(rows){
 if(!Array.isArray(rows)||rows.length>5000)throw Error("Невалиден архивен регистър");
 const used=new Set();
 for(const r of rows){
  if(!r||typeof r!=="object"||Array.isArray(r)||!(legacyId(r.id)||validId(r.id))||used.has(r.id))throw Error("Повтарящ се или невалиден архивен ID");
  used.add(r.id);
  for(const k of fields)if(typeof r[k]!=="string"||r[k].length>3000)throw Error("Невалидно архивно поле "+k);
 }
}
function migrateRows(rows,sourceLinks={},sourceBaseline={},target=targetRows()){
 legacyCheck(rows);
 const occupied=new Set(target.map(r=>r.id)),result=[],mapping={},baseline={},newUsed=new Set();
 // Preserve established links first; never guess that two independently-created
 // incidents are the same merely because their display IDs match.
 for(const r of rows)if(validId(r.id))newUsed.add(r.id);
 for(const r of rows)if(legacyId(r.id)&&sourceLinks[r.id]){
  const linked=sourceLinks[r.id];
  if(!validAnalyticId(linked)||newUsed.has(linked))throw Error("Конфликт при преобразуването на "+r.id+"; данните не са променени");
  newUsed.add(linked);
 }
 let high=Math.max(0,...[...occupied,...newUsed].map(idNum));
 for(const old of rows){
  let id=old.id;
  if(legacyId(id)){
   if(sourceLinks[id])id=sourceLinks[id];
   else{
    do{high++;if(high>MAX_ID)throw Error("Достигнат лимит "+MAX_ID+" при преномериране; архивът е запазен");id=fmtId(high)}while(occupied.has(id)||newUsed.has(id));
    newUsed.add(id);
   }
  }
  if(result.some(r=>r.id===id))throw Error("Повтарящ се INC ID "+id+" при преобразуването");
  result.push({...old,id});
  if(sourceLinks[old.id]){
   if(sourceLinks[old.id]!==id)throw Error("Несъответстваща стара връзка "+old.id);
   mapping[id]=id;
   if(sourceBaseline[old.id])baseline[id]=sourceBaseline[old.id];
  }
 }
 if(result.some(r=>!validId(r.id)))throw Error("Неуспешно INC преобразуване");
 return {rows:result,links:mapping,baseline};
}
function migrateLegacy(){
 const original=parse(ROOT,[]);
 if(!original.some(r=>legacyId(r?.id)))return false;
 legacyCheck(original);
 const originalRaw=JSON.stringify(original);
 const oldBack=parse(BACKUP,null);
 if(oldBack&&oldBack.root!==originalRaw)throw Error("Има различен предишен архив. Изисква се проверка; нищо не е променено");
 const links=oldBack?oldBack.links:parse(LINK,{});
 const baseline=oldBack?oldBack.baseline:parse(BASE,{});
 const converted=migrateRows(original,links,baseline);
 if(!oldBack)localStorage.setItem(BACKUP,JSON.stringify({root:originalRaw,links,baseline}));
 // Original source is written last, so an interrupted migration can safely retry
 // from the original and the preserved backup.
 localStorage.setItem(LINK,JSON.stringify(converted.links));
 localStorage.setItem(BASE,JSON.stringify(converted.baseline));
 localStorage.setItem(ROOT,JSON.stringify(converted.rows));
 localStorage.setItem(LAST,String(Math.max(0,...converted.rows.map(r=>idNum(r.id)),...targetRows().map(r=>idNum(r.id)))));
 return true;
}
function validate(rows){
 if(!Array.isArray(rows)||rows.length>5000)throw Error("Невалиден брой записи (макс. 5000)");
 const seen=new Set();
 return rows.map(r=>{
  if(!r||typeof r!=="object"||Array.isArray(r)||!validId(r.id)||seen.has(r.id))throw Error("Невалиден или дублиран ID");
  seen.add(r.id);
  if(Object.keys(r).some(k=>!fields.includes(k)))throw Error("Непознато поле в регистъра");
  const out={};for(const k of fields){if(typeof r[k]!=="string"||r[k].length>3000)throw Error("Невалидно поле: "+k);out[k]=r[k]}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!/^\d{2}:\d{2}$/.test(r.time)||!r.zone||!r.category||!r.shift)throw Error("Липсват основни данни");
  for(const k of ["damage","threatened"])if(r[k].trim()===""||!Number.isFinite(+r[k])||+r[k]<0)throw Error("Невалидна сума");
  return out;
 });
}
const read=()=>validate(parse(ROOT,[]));
function nextId(rows){
 const target=targetRows();
 const used=new Set([...rows,...target].map(x=>x.id));
 // Reset is permitted only if the analytical incident sheet is completely
 // empty; any IDs still present in the source register remain reserved.
 if(!target.length){
  for(let i=1;i<=MAX_ID;i++)if(!used.has(fmtId(i)))return fmtId(i);
 }else{
  const last=Number(localStorage.getItem(LAST))||0;
  const max=Math.max(last,...[...used].map(idNum),0);
  if(max<MAX_ID)return fmtId(max+1);
 }
 throw Error("Лимитът INC-5000 е достигнат. Не се използват повторно ID при частично изтриване");
}
const days=["неделя","понеделник","вторник","сряда","четвъртък","петък","събота"];
function weekday(){const d=$("date").value;const date=new Date(d+"T12:00:00");$("weekday").value=Number.isNaN(date.getTime())?"":days[date.getDay()]}
$("date").addEventListener("change",weekday);
function incidentIdAvailability(rawId,original="",rows=read(),existing=targetRows(),links=parse(LINK,{})){
 const id=String(rawId??"").trim().toUpperCase();
 if(!validId(id))return {ok:false,message:"Невалиден номер. Използвай INC-001 до INC-5000."};
 if(!links||typeof links!=="object"||Array.isArray(links))return {ok:false,message:"Невалидни връзки между листовете. Записът е блокиран."};
 if(original&&!rows.some(r=>r.id===original))return {ok:false,message:"Редактираният запис липсва. Обнови страницата."};
 if(rows.some(r=>r.id===id&&r.id!==original))return {ok:false,message:"Зает: "+id+" вече съществува в „Регистър инциденти“."};
 if(id!==original&&existing.some(r=>r.id===id))return {ok:false,message:"Зает: "+id+" вече съществува в „Инциденти“."};
 if(original&&id!==original&&links[original]===original&&existing.some(r=>r.id===original))
  return {ok:false,message:"Промяната е блокирана: "+original+" е активно свързан с „Инциденти“. Изтриване/промяна само тук не е разрешено."};
 if(original&&id!==original&&links[original]&&links[original]!==original)
  return {ok:false,message:"Блокирано: конфликтна история на връзката "+original+"."};
 if(id===original)return {ok:true,message:"Текущото ID "+id+" е на редактирания запис. Няма дублиране."};
 return {ok:true,message:"Свободен: "+id+" не присъства в нито един от двата листа към момента на проверката."};
}
function checkIncidentId(){
 const el=$("id-availability");
 try{
  const result=incidentIdAvailability($("id").value,$("form").dataset.edit||"");
  el.dataset.state=result.ok?"free":"busy";
  el.textContent=result.message;
  return result.ok;
 }catch(error){
  el.dataset.state="unknown";
  el.textContent="Не може да се провери ID: "+error.message+". Няма разрешение за запис без проверка.";
  return false;
 }
}
function fresh(){
 for(const k of fields)if($(k))$(k).value="";
 $("form").dataset.edit="";
 $("id").readOnly=false;
 $("id").value=nextId(read());
 $("form").dataset.suggestedId=$("id").value;
 weekday();checkIncidentId();
}
$("check-inc-id").addEventListener("click",checkIncidentId);
$("id").addEventListener("input",checkIncidentId);
$("id").addEventListener("blur",()=>{
 $("id").value=$("id").value.trim().toUpperCase();
 checkIncidentId();
});
const bulkRegisterSelection=new Set();
function updateRegisterBulkSelection(rows=read()){
 const allIds=new Set(rows.map(r=>r.id));
 for(const id of bulkRegisterSelection)if(!allIds.has(id))bulkRegisterSelection.delete(id);
 const n=bulkRegisterSelection.size,all=$("bulk-reg-select-all");
 all.checked=rows.length>0&&n===rows.length;
 all.indeterminate=n>0&&n<rows.length;
 all.disabled=rows.length===0;
 $("bulk-register-count").textContent="Избрани: "+n+" от "+rows.length;
 $("bulk-register-delete").disabled=n===0;
}
function show(){const rows=read();$("count").textContent=rows.length+" записа";$("rows").replaceChildren();for(const r of rows){const tr=document.createElement("tr");const idCell=document.createElement("td");idCell.textContent=r.id;tr.append(idCell);
 const cbCell=document.createElement("td");cbCell.className="bulk-reg-cell";const cb=document.createElement("input");cb.type="checkbox";cb.className="bulk-reg-check";cb.dataset.bulkRegId=r.id;cb.setAttribute("aria-label","Избери "+r.id);cb.checked=bulkRegisterSelection.has(r.id);cbCell.append(cb);tr.append(cbCell);
 for(const k of ["date","time","shift","zone","category","damage","threatened"]){const td=document.createElement("td");td.textContent=r[k];tr.append(td)}const td=document.createElement("td");for(const [name,action] of [["Преглед","view"],["Редактирай","edit"],["Изтрий","delete"]]){const b=document.createElement("button");b.type="button";b.textContent=name;b.dataset.action=action;b.dataset.id=r.id;td.append(b)}tr.append(td);$("rows").append(tr)}updateRegisterBulkSelection(rows)}
function ready(r){const required=["expert","guards","visitors","detect","react","cctv","access","sot"];if(required.some(k=>!r[k].trim()))return false;return ["guards","visitors","detect","react"].every(k=>Number.isFinite(+r[k])&&+r[k]>=0)&&["guards","visitors"].every(k=>Number.isInteger(+r[k]))}
function project(r,id){return {id,date:r.date+"T"+r.time,weekday:r.weekday,shift:r.shift,guards:+r.guards,cctv:r.cctv,access:r.access,sot:r.sot,visitors:+r.visitors,detect:+r.detect,react:+r.react,zone:r.zone,category:r.category,expert:r.expert,damage:+r.damage,threatened:+r.threatened,prevented:"no",evidence:"Не са проверени",reference:"",result:"В процес на проверка",description:r.description}}
function recoverTransfer(){
 const journal=parse(TRANSFER,null);if(!journal)return false;
 if(!journal||typeof journal!=="object"||!Array.isArray(journal.afterTarget))throw Error("Невалиден прекъснат пренос");
 const current=JSON.stringify(targetRows());
 if(current!==journal.beforeTarget&&current!==JSON.stringify(journal.afterTarget))
  throw Error("Прехвърлянето е прекъснато и „Инциденти“ е редактиран междувременно. Не правете нов пренос без резервно копие");
 localStorage.setItem(LINK,JSON.stringify(journal.afterLinks));
 localStorage.setItem(BASE,JSON.stringify(journal.afterBaseline));
 if(current===journal.beforeTarget)localStorage.setItem(TARGET,JSON.stringify(journal.afterTarget));
 localStorage.removeItem(TRANSFER);
 return true;
}
function syncAll(){
 recoverTransfer();
 const rows=read(),old=targetRows(),links=parse(LINK,{}),base=parse(BASE,{});
 if(!links||typeof links!=="object"||Array.isArray(links)||!base||typeof base!=="object"||Array.isArray(base))
  throw Error("Невалидни връзки на регистрите");
 const next=old.map(r=>({...r})),mapping={...links},baseline={...base},pending=[];
 const oldById=new Map(old.map((r,i)=>[r.id,i]));
 for(const r of rows){
  if(!validAnalyticId(r.id)){pending.push(r.id+" — самостоятелният регистър допуска до INC-5000, но аналитичният лист „Инциденти“ допуска до INC-399");continue}
  if(!ready(r)){pending.push(r.id+" — липсват допълнителни данни за оценка");continue}
  const index=oldById.has(r.id)?oldById.get(r.id):-1;
  const linked=mapping[r.id]===r.id;
  if(mapping[r.id]&&mapping[r.id]!==r.id){pending.push(r.id+" — противоречива стара връзка");continue}
  if(index>=0&&!linked){pending.push(idError(r.id,"лист „Инциденти“"));continue}
  if(index<0&&linked){
   pending.push(r.id+" — свързаният инцидент е изтрит от „Инциденти“. Редактирайте ID в Регистъра или проверете записа ръчно");
   continue;
  }
  const mapped=project(r,r.id);
  if(index>=0){
   if(!baseline[r.id]||JSON.stringify(next[index])!==JSON.stringify(baseline[r.id])){
    pending.push(r.id+" — променен прехвърлен инцидент; необходима е ръчна проверка");continue
   }
   next[index]=mapped;
  }else{oldById.set(r.id,next.length);next.push(mapped)}
  mapping[r.id]=r.id;
  baseline[r.id]=mapped;
 }
 if(pending.length)throw Error("Прехвърлянето е спряно. Няма заменени записи:\n"+pending.slice(0,12).join("\n")+(pending.length>12?"\n…":""));
 if(next.length>ANALYTIC_MAX)throw Error("Лимитът от 399 инцидента в аналитичния лист е достигнат");
 if(rows.length===0)return 0;
 localStorage.setItem(TRANSFER,JSON.stringify({beforeTarget:JSON.stringify(old),afterTarget:next,afterLinks:mapping,afterBaseline:baseline}));
 // The journal permits safe completion if any of the three localStorage
 // writes is interrupted. The target registry is committed last.
 localStorage.setItem(LINK,JSON.stringify(mapping));
 localStorage.setItem(BASE,JSON.stringify(baseline));
 localStorage.setItem(TARGET,JSON.stringify(next));
 localStorage.removeItem(TRANSFER);
 window.dispatchEvent(new CustomEvent("lucifer:incidents-changed"));
 return rows.length;
}
function transferRiskPriorityWarning(n){
 return "Прехвърлянето или добавянето на "+(n===1?"този 1 запис":"тези "+n+" записа")+
  " към „Инциденти“ ще доведе до автоматично преизчисляване на „Оценка на риска“ и „Приоритет за третиране“ според актуалните данни.\n"+
  "Автоматичното преизчисляване не означава одобрение на оценката.";
}
function runSync(){if(!$("sync").checked)return;try{const n=syncAll();status("Успешно прехвърлени / актуализирани: "+n+" записа. INC номерата се запазват."+(n?"\n"+transferRiskPriorityWarning(n):""))}catch(e){status("ВНИМАНИЕ — ПРЕХВЪРЛЯНЕТО Е ОТКАЗАНО: "+e.message,true)}}
$("sync").checked=localStorage.getItem(SYNC)==="true";
$("sync").addEventListener("change",()=>{if($("sync").checked){if(!confirm("Съгласни ли сте да прехвърлите ВСИЧКИ "+read().length+" натрупани инцидента към лист „Инциденти“?\n"+transferRiskPriorityWarning(read().length)+"\n\nЩе се прехвърлят само пълните записи. Вече свързаните записи ще се актуализират без дублиране.")){ $("sync").checked=false;status("Прехвърлянето е отказано. Данните остават в самостоятелния регистър.");return;}localStorage.setItem(SYNC,"true");runSync()}else{localStorage.setItem(SYNC,"false");status("Автоматичното прехвърляне е изключено. Съществуващите записи в Инциденти остават.")}});
$("form").addEventListener("submit",e=>{
 e.preventDefault();
 try{
  recoverTransfer();
  const rows=read(),existing=targetRows(),links=parse(LINK,{}),base=parse(BASE,{});
  const original=$("form").dataset.edit;
  const r={};for(const k of fields)r[k]=$(k).value.trim();
  r.id=r.id.toUpperCase();
  if(!validId(r.id))throw Error("ID трябва да е от INC-001 до INC-5000 (прехвърляне само до INC-399)");
  const v=validate([r])[0];
  let index=-1;
  if(original){
   index=rows.findIndex(x=>x.id===original);
   if(index<0)throw Error("Редактираният запис вече липсва. Обновете страницата");
  }
  const availability=incidentIdAvailability(v.id,original,rows,existing,links);
  if(!availability.ok)throw Error(availability.message);
  if(rows.some((x,i)=>i!==index&&x.id===v.id))
   throw Error(idError(v.id,"самостоятелния Регистър"));
  if(index<0&&existing.some(x=>x.id===v.id))throw Error(idError(v.id,"лист „Инциденти“"));
  if(index>=0&&v.id!==original){
   if(existing.some(x=>x.id===v.id))throw Error(idError(v.id,"лист „Инциденти“"));
   if(links[original]===original&&existing.some(x=>x.id===original))
    throw Error("INC "+original.slice(4)+" вече е прехвърлен. Промяната на ID само в Регистъра е блокирана, докато свързаният запис съществува в „Инциденти“.");
   if(links[original]&&links[original]!==original)throw Error("Конфликтна история на ID "+original);
   // Old identifier no longer points to an incident. Clear its mapping
   // before replacing the source record, so a reused ID cannot overwrite.
   delete links[original];delete base[original];
   localStorage.setItem(LINK,JSON.stringify(links));
   localStorage.setItem(BASE,JSON.stringify(base));
  }
  if(!original&&v.id!==$("form").dataset.suggestedId){
   if(!confirm("Ръчно избран е "+v.id+" вместо автоматично предложения "+$("form").dataset.suggestedId+".\n"+
     "Проверено: "+v.id+" е свободен в „Регистър инциденти“ и „Инциденти“ към този момент.\n"+
     "Внимание: номерът може да съществува в предишни JSON резервни копия.\n\nДа запишем новия инцидент с този номер?")){
    status("Ръчната промяна на ID е отменена. Няма записани промени.");
    return;
   }
  }
  if(JSON.stringify(read())!==JSON.stringify(rows)||JSON.stringify(targetRows())!==JSON.stringify(existing))
   throw Error("Данните в един от двата листа са се променили. Повтори проверката за ID преди запис.");
  if(index>=0)rows[index]=v;else rows.push(v);
  validate(rows);
  localStorage.setItem(ROOT,JSON.stringify(rows));
  if(existing.length&&idNum(v.id)>(Number(localStorage.getItem(LAST))||0))
   localStorage.setItem(LAST,String(idNum(v.id)));
  show();fresh();
  status("Записът "+v.id+" е съхранен в Регистъра. Без подмяна на чуждо ID.");
  runSync();
 }catch(error){status("ВНИМАНИЕ — ЗАПИСЪТ Е ОТКАЗАН: "+error.message,true)}
});
$("cancel").addEventListener("click",fresh);
$("bulk-reg-select-all").addEventListener("change",e=>{
 const rows=read();
 bulkRegisterSelection.clear();
 if(e.target.checked)for(const r of rows)bulkRegisterSelection.add(r.id);
 show();
});
$("rows").addEventListener("change",e=>{
 const cb=e.target.closest("input[data-bulk-reg-id]");
 if(!cb)return;
 if(!read().some(r=>r.id===cb.dataset.bulkRegId)){show();return;}
 if(cb.checked)bulkRegisterSelection.add(cb.dataset.bulkRegId);
 else bulkRegisterSelection.delete(cb.dataset.bulkRegId);
 updateRegisterBulkSelection();
});
$("bulk-register-delete").addEventListener("click",()=>{
 try{
  recoverTransfer();
  const rows=read(),selected=rows.filter(r=>bulkRegisterSelection.has(r.id));
  if(!selected.length){updateRegisterBulkSelection(rows);return;}
  const inAnalytics=new Set(targetRows().map(r=>r.id));
  const linked=selected.filter(r=>inAnalytics.has(r.id)).length;
  const ids=selected.map(r=>r.id).join(", ");
  if(!confirm("Изтриване на "+selected.length+" избрани записа САМО от „Регистър инциденти“?\n"+
   "ID: "+(ids.length>220?ids.slice(0,220)+"…":ids)+"\n"+
   "От тях "+linked+" ID присъстват и в „Инциденти“; те ще ОСТАНАТ там.\n"+
   "Останалите "+(rows.length-selected.length)+" записа в Регистъра се запазват.\n"+
   "Изтритите записи не могат да се възстановят без предварително JSON резервно копие."))return;
  if(JSON.stringify(read())!==JSON.stringify(rows))throw Error("Списъкът се е променил. Обновете и проверете избора.");
  const keys=[ROOT,LINK,BASE],before=new Map(keys.map(key=>[key,localStorage.getItem(key)]));
  const links=parse(LINK,{}),base=parse(BASE,{});
  if(!links||typeof links!=="object"||Array.isArray(links)||!base||typeof base!=="object"||Array.isArray(base))throw Error("Невалидни данни за свързаните записи");
  const idsSet=new Set(selected.map(r=>r.id));
  for(const id of idsSet){delete links[id];delete base[id];}
  try{
   localStorage.setItem(LINK,JSON.stringify(links));
   localStorage.setItem(BASE,JSON.stringify(base));
   localStorage.setItem(ROOT,JSON.stringify(rows.filter(r=>!idsSet.has(r.id))));
  }catch(error){
   let failed=false;
   for(const [key,value] of before)try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{failed=true}
   throw Error(failed?"Прекъснато изтриване; възстановяването не е сигурно. Проверете данните и JSON архива.":"Изтриването е отказано и първоначалните записи са възстановени.");
  }
  bulkRegisterSelection.clear();show();fresh();
  status("Изтрити са "+selected.length+" записа само от Регистъра. В „Инциденти“ нищо не е изтрито.");
 }catch(error){status("ВНИМАНИЕ — масовото изтриване е блокирано: "+error.message,true)}
});
$("rows").addEventListener("click",e=>{if(e.target.closest("input[data-bulk-reg-id]"))return;const b=e.target.closest("button[data-action]");if(!b)return;try{const rows=read(),r=rows.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.action==="view"){const labels={id:"ID",date:"Дата",time:"Час",weekday:"Ден от седмицата",shift:"Смяна",zone:"Място / зона",category:"Тип инцидент",damage:"Щета (EUR)",threatened:"Застрашена сума (EUR)",description:"Подробно описание / хронология",actions:"Предприети действия",coordination:"Взаимодействие между звената",source:"Източник / доказателства",author:"Попълнил / дата",expert:"Експертно ниво",guards:"Брой охранители",visitors:"Посетители",detect:"Време за откриване",react:"Време за реакция",cctv:"Видеонаблюдение",access:"Контрол на достъпа",sot:"СОТ"};const dialog=document.createElement("dialog");dialog.setAttribute("aria-label","Преглед на инцидент "+r.id);dialog.style.cssText="max-width:min(760px,94vw);max-height:85vh;overflow:auto;background:#0b1728;color:#fff;border:1px solid #7991a8;border-radius:12px;padding:22px";const title=document.createElement("h2");title.textContent="Преглед на инцидент "+r.id;dialog.append(title);for(const k of fields){const p=document.createElement("p");p.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px solid #35516b;padding:5px 0";const strong=document.createElement("strong");strong.textContent=(labels[k]||k)+": ";p.append(strong,document.createTextNode(r[k]||"—"));dialog.append(p)}const close=document.createElement("button");close.textContent="Затвори";close.type="button";close.style.cssText="padding:10px 18px;background:#246a9b;color:white;border:1px solid #88b8d5;border-radius:6px";close.addEventListener("click",()=>dialog.close());dialog.addEventListener("close",()=>dialog.remove());dialog.append(close);document.body.append(dialog);dialog.showModal();return}if(b.dataset.action==="edit"){for(const k of fields)$(k).value=r[k];$("form").dataset.edit=r.id;$("id").readOnly=false;checkIncidentId();status("Редактираш "+r.id+". Можеш да коригираш ID само ако новият номер е свободен и няма активна връзка към „Инциденти“.");$("form").scrollIntoView({block:"start"});return}if(!confirm("Да изтрием "+r.id+" само от самостоятелния регистър? Вече прехвърлените записи в Инциденти остават."))return;{const links=parse(LINK,{}),baseline=parse(BASE,{});delete links[r.id];delete baseline[r.id];localStorage.setItem(LINK,JSON.stringify(links));localStorage.setItem(BASE,JSON.stringify(baseline));localStorage.setItem(ROOT,JSON.stringify(rows.filter(x=>x.id!==r.id)))}show();fresh();status("Изтрито само от самостоятелния регистър. Прехвърленият инцидент остава в „Инциденти“.")}catch(error){status(error.message)}});
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$("export").addEventListener("click",()=>{try{download("LUCIFER-register-backup.json",JSON.stringify({kind:"LUCIFER-INDEPENDENT-REGISTER",schema:1,exportedAt:new Date().toISOString(),rows:read()},null,2),"application/json")}catch(e){status(e.message)}});
$("csv").addEventListener("click",()=>{try{const rows=read(),keys=["id","date","time","weekday","shift","zone","category","damage","threatened","description","actions","coordination","source","author"];const labels=["ID на инцидента","Дата","Час","Ден от седмицата","Смяна","Място / зона","Тип инцидент","Щета (EUR)","Застрашена сума (EUR)","Подробно описание / хронология","Предприети действия","Взаимодействие между звената","Източник / доказателства","Попълнил / дата"];const esc=v=>'"'+str(v).replace(/"/g,'""').replace(/^[=+@\-\t\r]/,"'")+'"';const csv=[labels.map(esc).join(";"),...rows.map(r=>keys.map(k=>esc(r[k])).join(";"))].join("\r\n");download("LUCIFER-register.csv","\uFEFF"+csv,"text/csv;charset=utf-8")}catch(e){status(e.message)}});
$("restore").addEventListener("click",()=>$("file").click());
$("file").addEventListener("change",async()=>{const f=$("file").files?.[0];$("file").value="";if(!f)return;try{if(f.size>5*1024*1024)throw Error("Файлът е твърде голям");const data=JSON.parse(await f.text());if(!data||data.kind!=="LUCIFER-INDEPENDENT-REGISTER"||data.schema!==1)throw Error("Невалиден формат на резервното копие");const fromBackup=data.rows;
legacyCheck(fromBackup);
const original=read(),target=targetRows(),priorLinks=parse(LINK,{}),priorBase=parse(BASE,{});
const candidate=fromBackup.some(x=>legacyId(x.id))?
  migrateRows(fromBackup,{}, {},target).rows:validate(fromBackup);
if(candidate.some(r=>target.some(t=>t.id===r.id)&&!(original.some(o=>o.id===r.id)&&priorLinks[r.id]===r.id)))
 throw Error("Резервното копие съдържа ID, вече използван в „Инциденти“. Няма заместване.");
if(!confirm("Да заменим "+original.length+" записа с "+candidate.length+"? Старите архивни REG номера ще станат свободни INC номера. Първо запазете текущия JSON."))return;
const keep=new Set(candidate.map(x=>x.id)),newLinks={},newBase={};
for(const id of keep)if(priorLinks[id]===id&&original.some(o=>o.id===id)){
 newLinks[id]=id;if(priorBase[id])newBase[id]=priorBase[id];
}
localStorage.setItem(LINK,JSON.stringify(newLinks));
localStorage.setItem(BASE,JSON.stringify(newBase));
localStorage.setItem(ROOT,JSON.stringify(candidate));
$("sync").checked=false;localStorage.setItem(SYNC,"false");
bulkRegisterSelection.clear();show();fresh();status("Възстановени "+candidate.length+" записа с INC номера. Автоматичният пренос е изключен; проверете ID преди включване.");}catch(e){status("Възстановяването е отказано: "+e.message)}});
window.addEventListener("storage",event=>{
 // Ако отворен друг раздел изчисти аналитичния лист и Регистъра,
 // обновяваме и тази страница, без да възстановяваме старите данни.
 if(event.key===ROOT&&event.newValue===null){
  try{bulkRegisterSelection.clear();show();fresh();status("Регистърът е изчистен заедно с лист „Инциденти“. Следващ ID: INC-001.");}
  catch(error){status("Нужна е повторна проверка на Регистъра: "+error.message,true)}
 }
});
try{const recovered=recoverTransfer(),migrated=migrateLegacy();show();fresh();if(recovered||migrated)status("Извършено безопасно възстановяване/преобразуване към единен INC формат. Оригиналните REG записи са архивирани локално.");}
catch(e){status("ВНИМАНИЕ — РЕГИСТЪРЪТ Е БЛОКИРАН: "+e.message,true);$("id").readOnly=true;$("form").querySelector('button[type="submit"]').disabled=true;}
})();