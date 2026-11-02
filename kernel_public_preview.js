"use strict";
(() => {
  // Public-only input-form preview of KERNEL-B-09. No auth, no API, no risk calculation.
  // All records remain in RAM, without storage or requests to a server.
  const categories=["Нерегламентиран достъп","Кражба","Конфликт","Вандализъм",
    "Технически отказ","Забравен/подозрителен предмет","Инцидент на паркинг","Пожарен сигнал"];
  const $=id=>document.getElementById(id);
  const rows=[];
  const category=$("category");
  for(const value of categories)category.append(new Option(value,value));
  const theftFields=$("theft-fields");
  const theftOutcome=$("theft_outcome");
  function showTheft(){
    const theft=category.value==="Кражба";
    theftFields.hidden=!theft;
    $("evidence_reference").required=theft;
  }
  category.addEventListener("change",showTheft);
  theftOutcome.addEventListener("change",()=>{
    if(theftOutcome.value==="Доказан предотвратен опит")$("loss_eur").value="";
  });
  function cell(tr,value){
    const td=document.createElement("td");td.textContent=String(value??"—");tr.append(td);
  }
  function numberField(id,required){
    const str=$(id).value.trim();
    if(!str&&!required)return null;
    const n=Number(str);
    if(!str||!Number.isFinite(n)||n<0)throw Error("Невалидна числова стойност: "+id);
    return n;
  }
  function render(){
    const body=$("incident-list");body.replaceChildren();
    rows.forEach((r,index)=>{
      const tr=document.createElement("tr");
      [r.id,r.date,r.category,r.level,r.damage??"Неизвестна"].forEach(x=>cell(tr,x));
      const td=document.createElement("td"),button=document.createElement("button");
      button.type="button";button.textContent="Премахни";
      button.addEventListener("click",()=>{rows.splice(index,1);render();});
      td.append(button);tr.append(td);body.append(tr);
    });
    $("incident-count").textContent=rows.length+" / 399";
    $("status").textContent="Публична визуална демонстрация — няма сървърно изчисление. Добавени примерни инциденти: "+rows.length+".";
  }
  $("incident-form").addEventListener("submit",event=>{
    event.preventDefault();
    try {
      const id=$("incident_id").value.trim();
      if(!id)throw Error("Въведете ID на инцидент.");
      if(rows.length>=399)throw Error("Достигнат е лимитът 399.");
      if(rows.some(r=>r.id.toLocaleLowerCase("bg")===id.toLocaleLowerCase("bg")))throw Error("Повтарящ се ID.");
      const prevented=category.value==="Кражба"&&theftOutcome.value==="Доказан предотвратен опит";
      const damage=numberField("loss_eur",!prevented);
      numberField("detection_minutes",true);
      numberField("reaction_minutes",true);
      numberField("guards",true);
      numberField("visitors",false);
      if(category.value==="Кражба"&&!$("evidence_reference").value.trim()){
        throw Error("Въведете примерна препратка към доказателство.");
      }
      const row={id,date:$("incident_date").value,category:category.value,
        level:$("risk_level").value,damage};
      rows.push(row);
      $("incident_id").value="";
      $("entry-status").textContent="Примерният инцидент е добавен само на този екран. Не е записан в база данни.";
      render();
    }catch(e){$("entry-status").textContent=e.message;}
  });
  $("calculate").addEventListener("click",()=>{
    $("status").textContent="Сървърното изчисление и PostgreSQL не са свързани към публичното DEMO. Тази страница е преглед на интерфейса, а не резултат от риска. Използвайте основното DEMO за вече наличните демонстрационни функции.";
  });
  showTheft();render();
})();