"use strict";
(()=>{
const ROOT="lucifer-standalone-register-v1",LINK="lucifer-standalone-register-links-v1",SYNC="lucifer-standalone-register-sync-v1",TARGET="lucifer-web-site-001-demo-v1";
const fields=["id","date","time","weekday","shift","zone","category","damage","threatened","description","actions","coordination","source","author","expert","guards","visitors","detect","react","cctv","access","sot"];
const $=id=>document.getElementById(id),str=v=>String(v??""),status=s=>$("status").textContent=s;
const parse=(key,otherwise)=>{const v=localStorage.getItem(key);return v===null?otherwise:JSON.parse(v)};
const validId=id=>/^REG-\d{4}$/.test(id)&&Number(id.slice(4))>0;
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
function nextId(rows){const used=new Set(rows.map(x=>x.id));for(let i=1;i<=5000;i++){const id="REG-"+String(i).padStart(4,"0");if(!used.has(id))return id}throw Error("Регистърът е пълен")}
const days=["неделя","понеделник","вторник","сряда","четвъртък","петък","събота"];
function weekday(){const d=$("date").value;const date=new Date(d+"T12:00:00");$("weekday").value=Number.isNaN(date.getTime())?"":days[date.getDay()]}
$("date").addEventListener("change",weekday);
function fresh(){for(const k of fields)if($(k))$(k).value="";$("id").value=nextId(read());$("form").dataset.edit="";weekday()}
function show(){const rows=read();$("count").textContent=rows.length+" записа";$("rows").replaceChildren();for(const r of rows){const tr=document.createElement("tr");for(const k of ["id","date","time","shift","zone","category","damage","threatened"]){const td=document.createElement("td");td.textContent=r[k];tr.append(td)}const td=document.createElement("td");for(const [name,action] of [["Преглед","view"],["Редактирай","edit"],["Изтрий","delete"]]){const b=document.createElement("button");b.type="button";b.textContent=name;b.dataset.action=action;b.dataset.id=r.id;td.append(b)}tr.append(td);$("rows").append(tr)}}
function ready(r){const required=["expert","guards","visitors","detect","react","cctv","access","sot"];if(required.some(k=>!r[k].trim()))return false;return ["guards","visitors","detect","react"].every(k=>Number.isFinite(+r[k])&&+r[k]>=0)&&["guards","visitors"].every(k=>Number.isInteger(+r[k]))}
function project(r,id){return {id,date:r.date+"T"+r.time,weekday:r.weekday,shift:r.shift,guards:+r.guards,cctv:r.cctv,access:r.access,sot:r.sot,visitors:+r.visitors,detect:+r.detect,react:+r.react,zone:r.zone,category:r.category,expert:r.expert,damage:+r.damage,threatened:+r.threatened,prevented:"no",evidence:"Не са проверени",reference:"",result:"В процес на проверка",description:r.description}}
function syncAll(){
 const rows=read(),old=parse(TARGET,[]),links=parse(LINK,{});
 if(!Array.isArray(old)||old.length>399||!links||typeof links!=="object"||Array.isArray(links))throw Error("Невалиден регистър на LUCIFER или връзки");
 const used=new Set(old.map(r=>r.id));if(used.size!==old.length)throw Error("Повтарящи се ID в Инциденти");
 const pending=[],next=old.map(r=>({...r})),mapping={...links};
 for(const r of rows){
  if(!ready(r)){pending.push(r.id+" — липсват данни за оценка");continue}
  let target=mapping[r.id];let index=target?next.findIndex(x=>x.id===target):-1;
  if(target&&index<0){pending.push(r.id+" — липсва свързаният запис "+target);continue}
  if(!target){for(let n=1;n<=399;n++){const id="INC-"+String(n).padStart(3,"0");if(!used.has(id)){target=id;break}}if(!target){pending.push(r.id+" — достигнат лимитът 399");continue}used.add(target);mapping[r.id]=target;index=-1}
  const mapped=project(r,target);
  if(index<0)next.push(mapped);
  else {
   // Existing records may have been edited independently; never silently erase those edits.
   const previous=next[index],baseline=parse(ROOT+"-baseline",{})[r.id];
   if(!baseline||JSON.stringify(previous)!==JSON.stringify(baseline)){pending.push(r.id+" — променен запис в Инциденти, необходима е ръчна проверка");continue}
   next[index]=mapped;
  }
 }
 // Commit only when all eligible records can be safely written; avoid partial transfers.
 if(pending.length)throw Error("Прехвърлянето е спряно; нищо не е променено.\n"+pending.slice(0,12).join("\n")+(pending.length>12?"\n…":""));
 const baseline={...parse(ROOT+"-baseline",{})};for(const r of rows)baseline[r.id]=project(r,mapping[r.id]);
 // Avoid unbounded growth and ensure all writes can be completed before publishing incident changes.
 localStorage.setItem(LINK,JSON.stringify(mapping));
 localStorage.setItem(ROOT+"-baseline",JSON.stringify(baseline));
 localStorage.setItem(TARGET,JSON.stringify(next));
 window.dispatchEvent(new CustomEvent("lucifer:incidents-changed"));
 return rows.length;
}
function runSync(){if(!$("sync").checked)return;try{const n=syncAll();status("Прехвърлени / актуализирани: "+n+" записа. Няма дублиране по свързан ID.")}catch(e){status("ВНИМАНИЕ: "+e.message)}}
$("sync").checked=localStorage.getItem(SYNC)==="true";
$("sync").addEventListener("change",()=>{if($("sync").checked){if(!confirm("Съгласни ли сте да прехвърлите ВСИЧКИ натрупани инциденти към лист „Инциденти“?\\n\\nЩе се прехвърлят само пълните записи. Вече свързаните записи ще се актуализират без дублиране.")){ $("sync").checked=false;status("Прехвърлянето е отказано. Данните остават в самостоятелния регистър.");return;}localStorage.setItem(SYNC,"true");runSync()}else{localStorage.setItem(SYNC,"false");status("Автоматичното прехвърляне е изключено. Съществуващите записи в Инциденти остават.")}});
$("form").addEventListener("submit",e=>{e.preventDefault();try{const rows=read(),r={};for(const k of fields)r[k]=$(k).value.trim();const v=validate([r])[0];const index=rows.findIndex(x=>x.id===v.id);if(index>=0)rows[index]=v;else rows.push(v);validate(rows);localStorage.setItem(ROOT,JSON.stringify(rows));show();fresh();status("Записът е съхранен в самостоятелния регистър.");runSync()}catch(error){status("Записът е спрян: "+error.message)}});
$("cancel").addEventListener("click",fresh);
$("rows").addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;try{const rows=read(),r=rows.find(x=>x.id===b.dataset.id);if(!r)return;if(b.dataset.action==="view"){const labels={id:"ID",date:"Дата",time:"Час",weekday:"Ден от седмицата",shift:"Смяна",zone:"Място / зона",category:"Тип инцидент",damage:"Щета (EUR)",threatened:"Застрашена сума (EUR)",description:"Подробно описание / хронология",actions:"Предприети действия",coordination:"Взаимодействие между звената",source:"Източник / доказателства",author:"Попълнил / дата",expert:"Експертно ниво",guards:"Брой охранители",visitors:"Посетители",detect:"Време за откриване",react:"Време за реакция",cctv:"Видеонаблюдение",access:"Контрол на достъпа",sot:"СОТ"};const dialog=document.createElement("dialog");dialog.setAttribute("aria-label","Преглед на инцидент "+r.id);dialog.style.cssText="max-width:min(760px,94vw);max-height:85vh;overflow:auto;background:#0b1728;color:#fff;border:1px solid #7991a8;border-radius:12px;padding:22px";const title=document.createElement("h2");title.textContent="Преглед на инцидент "+r.id;dialog.append(title);for(const k of fields){const p=document.createElement("p");p.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px solid #35516b;padding:5px 0";const strong=document.createElement("strong");strong.textContent=(labels[k]||k)+": ";p.append(strong,document.createTextNode(r[k]||"—"));dialog.append(p)}const close=document.createElement("button");close.textContent="Затвори";close.type="button";close.style.cssText="padding:10px 18px;background:#246a9b;color:white;border:1px solid #88b8d5;border-radius:6px";close.addEventListener("click",()=>dialog.close());dialog.addEventListener("close",()=>dialog.remove());dialog.append(close);document.body.append(dialog);dialog.showModal();return}if(b.dataset.action==="edit"){for(const k of fields)$(k).value=r[k];$("form").dataset.edit=r.id;$("form").scrollIntoView({block:"start"});return}if(!confirm("Да изтрием "+r.id+" само от самостоятелния регистър? Вече прехвърлените записи в Инциденти остават."))return;localStorage.setItem(ROOT,JSON.stringify(rows.filter(x=>x.id!==r.id)));show();fresh();status("Изтрито само от самостоятелния регистър.")}catch(error){status(error.message)}});
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$("export").addEventListener("click",()=>{try{download("LUCIFER-register-backup.json",JSON.stringify({kind:"LUCIFER-INDEPENDENT-REGISTER",schema:1,exportedAt:new Date().toISOString(),rows:read()},null,2),"application/json")}catch(e){status(e.message)}});
$("csv").addEventListener("click",()=>{try{const rows=read(),keys=["id","date","time","weekday","shift","zone","category","damage","threatened","description","actions","coordination","source","author"];const labels=["ID на инцидента","Дата","Час","Ден от седмицата","Смяна","Място / зона","Тип инцидент","Щета (EUR)","Застрашена сума (EUR)","Подробно описание / хронология","Предприети действия","Взаимодействие между звената","Източник / доказателства","Попълнил / дата"];const esc=v=>'"'+str(v).replace(/"/g,'""').replace(/^[=+@\-\t\r]/,"'")+'"';const csv=[labels.map(esc).join(";"),...rows.map(r=>keys.map(k=>esc(r[k])).join(";"))].join("\r\n");download("LUCIFER-register.csv","\uFEFF"+csv,"text/csv;charset=utf-8")}catch(e){status(e.message)}});
$("restore").addEventListener("click",()=>$("file").click());
$("file").addEventListener("change",async()=>{const f=$("file").files?.[0];$("file").value="";if(!f)return;try{if(f.size>5*1024*1024)throw Error("Файлът е твърде голям");const data=JSON.parse(await f.text());if(!data||data.kind!=="LUCIFER-INDEPENDENT-REGISTER"||data.schema!==1)throw Error("Невалиден формат на резервното копие");const rows=validate(data.rows);if(!confirm("Да заменим "+read().length+" текущи записа с "+rows.length+" записа от резервното копие? Предварително експортирайте текущите данни."))return;localStorage.setItem(ROOT,JSON.stringify(rows));show();fresh();status("Възстановени "+rows.length+" записа. Автоматичното прехвърляне е временно изключено за безопасност.");$("sync").checked=false;localStorage.setItem(SYNC,"false")}catch(e){status("Възстановяването е отказано: "+e.message)}});
try{show();fresh()}catch(e){status("Регистърът не може да бъде прочетен: "+e.message)}
})();