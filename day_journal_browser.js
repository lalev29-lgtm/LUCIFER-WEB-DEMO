"use strict";
/* LUCIFER-WEB DEMO — isolated, browser-only DAY reports.
 * Real authorized PostgreSQL records live exclusively in the Railway app.
 * Never copy DAY items into the INC key or the Excel/risk calculation inputs.
 */
(() => {
  const KEY = "lucifer-web-day-journal-demo-v1";
  const INCIDENT_KEY = "lucifer-web-site-001-demo-v1";
  const MAX = 5000;
  const FIELDS = ["description", "actions", "coordination", "source", "authorNote"];
  const DELETE_AUDIT_NOTE = "Автоматичен запис: изтриване след потвърждение";
  const $ = (id) => document.getElementById(id);
  const pad = (n) => "DAY-" + String(n).padStart(3, "0");
  const nowLocal = () => {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return { date: d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()), time: p(d.getHours()) + ":" + p(d.getMinutes()) };
  };
  function validDate(x) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x));
    if (!m || +m[1] < 2000 || +m[1] > 9999) return false;
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
  }
  const validTime = x => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x));
  function validated(raw) {
    if (raw === null) return { schema: 1, lastNumber: 0, entries: [] };
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object" || Array.isArray(data) || data.schema !== 1 ||
        !Number.isInteger(data.lastNumber) || data.lastNumber < 0 || data.lastNumber > MAX ||
        !Array.isArray(data.entries) || data.entries.length > MAX) throw Error("Невалиден архив на DAY.");
    const seen = new Set(), dates = new Set();
    for (const r of data.entries) {
      if (!r || typeof r !== "object" || Array.isArray(r) ||
          typeof r.id !== "string" || !/^DAY-(?:\d{3}|\d{4})$/.test(r.id) ||
          +r.id.slice(4) < 1 || +r.id.slice(4) > data.lastNumber ||
          pad(+r.id.slice(4)) !== r.id || seen.has(r.id) ||
          !validDate(r.date) || !validTime(r.time) || (r.status !== "deleted" && dates.has(r.date)) ||
          !["active", "archived", "deleted"].includes(r.status) ||
          !Number.isInteger(r.version) || r.version < 1 || r.version > 10000 ||
          !Array.isArray(r.audit) || r.audit.length < 1 || r.audit.length > 10000 ||
          typeof r.createdAt !== "string" || typeof r.updatedAt !== "string" ||
          FIELDS.some(k => typeof r[k] !== "string" || r[k].length > 3000) ||
          r.audit.some(a => !a || !["created", "amended", "archived", "restored", "deleted"].includes(a.action) ||
            typeof a.at !== "string" || typeof a.reason !== "string" || a.reason.length > 500 ||
            !Number.isInteger(a.version) || a.version < 1 || typeof a.before !== "string" ||
            a.before.length > 20000)) throw Error("DAY данните са повредени или невалидни.");
      seen.add(r.id); if (r.status !== "deleted") dates.add(r.date);
    }
    return data;
  }
  function readIncidents(raw) {
    if (raw === null) return [];
    const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(rows) || rows.length > 399 ||
        rows.some(x => !x || typeof x !== "object" ||
          !/^INC-\d{3}$/.test(x.id) || typeof x.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T/.test(x.date))) throw Error("Невалиден регистър на инцидентите.");
    return rows;
  }
  function statusFor(row, incidents) {
    if (row.status === "deleted") return "Изтрит (историята е запазена)";
    if (row.status === "archived") return "Архивиран";
    return incidents.some(x => x.date.slice(0, 10) === row.date)
      ? "Нужна проверка — има инцидент на същата дата" : "Без инциденти";
  }
  function timeline(rows, incidents, from = "", to = "") {
    if (from && !validDate(from) || to && !validDate(to) || from && to && from > to) throw Error("Невалиден период.");
    const eligible = d => (!from || d >= from) && (!to || d <= to);
    const events = [];
    for (const i of incidents) {
      const d = i.date.slice(0, 10);
      if (eligible(d)) events.push({ id: i.id, kind: "INC", date: d, time: i.date.slice(11, 16),
        category: typeof i.category === "string" ? i.category : "Инцидент",
        description: typeof i.description === "string" ? i.description : "",
        status: "Регистриран инцидент" });
    }
    for (const r of rows) if (r.status !== "deleted" && eligible(r.date)) events.push({
      id: r.id, kind: "DAY", date: r.date, time: r.time,
      category: "Без инциденти", description: r.description,
      status: statusFor(r, incidents)
    });
    return events.sort((a,b) => (a.date + "T" + a.time).localeCompare(b.date + "T" + b.time) || a.id.localeCompare(b.id));
  }

  // A single localStorage write follows complete validation; history and DAY numbering survive.
  function deleteBatch(db, snapshots, reason, at, all = false) {
    if (!Array.isArray(snapshots) || !snapshots.length) throw Error("Няма DAY записи за изтриване.");
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 500)
      throw Error("Посочете основание от 10 до 500 символа.");
    if (typeof at !== "string" || !at) throw Error("Липсва време на действието.");
    const rows = new Map(db.entries.map(r => [r.id, r]));
    const ids = new Set(snapshots.map(s => s.id));
    if (ids.size !== snapshots.length) throw Error("Повторен DAY номер в избора.");
    const live = db.entries.filter(r => r.status !== "deleted");
    if (all && (live.length !== snapshots.length || live.some(r => !ids.has(r.id))))
      throw Error("Списъкът е променен. Обновете го, преди да изтриете всички.");
    for (const s of snapshots) {
      const r = rows.get(s.id);
      if (!r || r.status === "deleted" || r.version !== s.version)
        throw Error("DAY записът е променен. Обновете списъка и избора.");
      if (r.audit.length >= 10000) throw Error("Лимитът на историята на DAY е достигнат.");
    }
    for (const s of snapshots) {
      const r = rows.get(s.id);
      const before = JSON.stringify({date:r.date,time:r.time,status:r.status,
        description:r.description,actions:r.actions,coordination:r.coordination,
        source:r.source,authorNote:r.authorNote});
      r.version += 1; r.updatedAt = at;
      r.audit.push({action:"deleted", at, reason:reason.trim(), version:r.version, before});
      r.status = "deleted";
    }
    return snapshots.length;
  }
  const api = { validDate, validTime, validated, readIncidents, statusFor, timeline, pad, deleteBatch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  function boot() {
    const panel = $("day-journal");
    if (!panel) return;
    const form = $("day-demo-form"), message = $("day-demo-message");
    const list = $("day-demo-rows"), auditBox = $("day-demo-audit");
    let editing = null, selected = new Map();
    const stamp = () => new Date().toISOString();
    const documentState = () => validated(localStorage.getItem(KEY));
    const incidents = () => readIncidents(localStorage.getItem(INCIDENT_KEY));
    function notify(text, error = false) {
      message.textContent = text;
      message.dataset.level = error ? "error" : "ok";
    }
    function fresh() {
      editing = null;
      form.reset();
      $("day-demo-edit-label").hidden = true;
      $("day-demo-edit-reason").required = false;
      $("day-demo-edit-reason").value = "";
      $("day-demo-save").textContent = "Запиши DAY отчет";
      const now = nowLocal();
      $("day-demo-date").value = now.date;
      $("day-demo-time").value = now.time;
      try { $("day-demo-number").textContent = pad(documentState().lastNumber + 1); }
      catch { $("day-demo-number").textContent = "—"; }
    }

    function activeRows(db) { return db.entries.filter(r => r.status !== "deleted"); }
    function selectionStatus(db) {
      const active = activeRows(db), latest = new Map(active.map(r => [r.id, r.version]));
      for (const [id, version] of selected) if (latest.get(id) !== version) selected.delete(id);
      const master = $("day-demo-select-all");
      const visible = active; // Deleted history rows are never selectable.
      const checked = visible.filter(r => selected.get(r.id) === r.version).length;
      master.disabled = visible.length === 0;
      master.checked = visible.length > 0 && checked === visible.length;
      master.indeterminate = checked > 0 && checked < visible.length;
      $("day-demo-selected-count").textContent = "Отбелязани DAY: " + selected.size;
      $("day-demo-delete-selected").disabled = selected.size === 0;
      $("day-demo-delete-all").disabled = active.length === 0;
    }
    function render() {
      try {
        const db = documentState(), inc = incidents();
        selectionStatus(db);
        $("day-demo-save").disabled = false;
        $("day-demo-count").textContent = db.entries.filter(r => r.status === "active").length + " активни DAY";
        $("day-demo-review-count").textContent = db.entries.filter(r => statusFor(r, inc).startsWith("Нужна")).length + " за проверка";
        if (!editing) $("day-demo-number").textContent = db.lastNumber < MAX ? pad(db.lastNumber + 1) : "Лимит";
        list.replaceChildren();
        if (!db.entries.length || !db.entries.some(r => r.status !== "deleted" || $("day-demo-show-deleted").checked)) {
          const tr = document.createElement("tr"), td = document.createElement("td");
          td.colSpan = 7; td.textContent = "Няма въведени дневни отчети.";
          tr.append(td); list.append(tr);
        }
        const byRecent = db.entries.filter(r => r.status !== "deleted" || $("day-demo-show-deleted").checked).sort((a,b) =>
          (b.date + "T" + b.time).localeCompare(a.date + "T" + a.time) || b.id.localeCompare(a.id));
        for (const row of byRecent) {
          const tr = document.createElement("tr"), status = statusFor(row, inc);
          if (status.startsWith("Нужна")) tr.className = "day-demo-alert-row";
          const td = value => { const el = document.createElement("td"); el.textContent = value; return el; };
          const selectCell = document.createElement("td");
          if (row.status !== "deleted") {
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox"; checkbox.dataset.daySelect = row.id;
            checkbox.className = "day-demo-row-check";
            checkbox.setAttribute("aria-label", "Отбележи " + row.id + " за изтриване");
            checkbox.checked = selected.get(row.id) === row.version;
            selectCell.append(checkbox);
          }
          tr.append(selectCell, td(row.id), td(row.date), td(row.time), td(status), td("v" + row.version));
          const actions = document.createElement("td");
          const action = (code, title, disabled = false) => {
            const button = document.createElement("button"); button.type = "button";
            button.dataset.dayAction = code; button.dataset.dayId = row.id;
            button.textContent = title; button.disabled = disabled; actions.append(button);
          };
          action("view", "Преглед");
          if (row.status === "active") {
            action("edit", "Редактирай", status.startsWith("Нужна"));
            action("archive", "Архивирай");
          } else if (row.status === "archived") {
            action("restore", "Възстанови", inc.some(i => i.date.slice(0,10) === row.date));
          }
          if (row.status !== "deleted") action("delete", "Изтрий");
          tr.append(actions); list.append(tr);
        }
        try { paintTimeline(); }
        catch(e) { $("day-demo-timeline-count").textContent = "Проверете периода: " + e.message; }
      } catch (e) {
        $("day-demo-save").disabled = true;
        notify("DAY данните не могат да бъдат прочетени: " + e.message + " Не изтривайте данните от браузъра.", true);
        $("day-demo-count").textContent = "Недостъпно"; list.replaceChildren();
        selected.clear(); $("day-demo-selected-count").textContent = "Отбелязани DAY: 0";
        $("day-demo-delete-selected").disabled = true; $("day-demo-delete-all").disabled = true;
        $("day-demo-select-all").disabled = true; $("day-demo-select-all").checked = false;
      }
    }
    function inputData() {
      const date = $("day-demo-date").value, time = $("day-demo-time").value;
      if (!validDate(date) || date > nowLocal().date || !validTime(time))
        throw Error("Изберете валидна дата (не бъдеща) и час.");
      const fields = {};
      for (const k of FIELDS) {
        const el = $("day-demo-" + k);
        fields[k] = el.value.trim();
        if (fields[k].length > 3000) throw Error("Превишена дължина на поле.");
      }
      return { date, time, ...fields };
    }
    function change(action, row, reason) {
      if (row.audit.length >= 10000) throw Error("Лимитът на одита е достигнат.");
      const before = JSON.stringify({date:row.date,time:row.time,status:row.status,
        description:row.description,actions:row.actions,coordination:row.coordination,
        source:row.source,authorNote:row.authorNote});
      row.version += 1; row.updatedAt = stamp();
      row.audit.push({ action, at:row.updatedAt, reason, version:row.version, before });
    }
    form.addEventListener("submit", e => {
      e.preventDefault();
      try {
        const db = documentState(), inc = incidents(), values = inputData();
        if (inc.some(i => i.date.slice(0,10) === values.date))
          throw Error("За тази дата има регистриран инцидент. DAY отчет „Без инциденти“ е блокиран.");
        if (db.entries.some(r => r.status !== "deleted" && r.date === values.date && r.id !== editing?.id))
          throw Error("За тази дата вече има DAY отчет (включително архивиран).");
        if (editing) {
          const current = db.entries.find(r => r.id === editing.id);
          if (!current || current.version !== editing.version || current.status !== "active")
            throw Error("Записът е променен. Обновете списъка преди редакция.");
          const reason = $("day-demo-edit-reason").value.trim();
          if (reason.length < 10 || reason.length > 500)
            throw Error("Въведете основание за редакция от 10 до 500 символа.");
          change("amended", current, reason);
          Object.assign(current, values);
          localStorage.setItem(KEY, JSON.stringify(db));
          notify("Коригираният " + current.id + " е записан с версия " + current.version + ".");
        } else {
          if (db.lastNumber >= MAX) throw Error("Достигнат е лимитът DAY-5000.");
          const id = pad(db.lastNumber + 1), at = stamp();
          db.lastNumber++;
          db.entries.push({...values, id, status:"active", version:1,
            createdAt:at, updatedAt:at,
            audit:[{action:"created", at, reason:"Нов дневен отчет", version:1, before:""}]});
          localStorage.setItem(KEY, JSON.stringify(db));
          notify("Записан е " + id + " — само в този браузър.");
        }
        fresh(); render();
      } catch (err) { notify("Записът е отказан: " + err.message, true); }
    });
    $("day-demo-new").addEventListener("click", () => { fresh(); notify("Нов DAY отчет."); });
    $("day-demo-show-deleted").addEventListener("change", render);

    list.addEventListener("change", e => {
      const input = e.target.closest("input[data-day-select]");
      if (!input) return;
      try {
        const db = documentState(), r = db.entries.find(x => x.id === input.dataset.daySelect);
        if (!r || r.status === "deleted") throw Error("Този DAY вече не е активен.");
        if (input.checked) selected.set(r.id, r.version);
        else selected.delete(r.id);
        selectionStatus(db);
      } catch (err) { notify("Изборът е отказан: " + err.message, true); render(); }
    });
    $("day-demo-select-all").addEventListener("change", e => {
      try {
        const db = documentState(), mark = e.target.checked;
        for (const r of activeRows(db)) {
          if (mark) selected.set(r.id, r.version);
          else selected.delete(r.id);
        }
        render();
      } catch (err) { notify("Изборът е отказан: " + err.message, true); render(); }
    });
    function deleteMany(all) {
      try {
        const db = documentState();
        const snapshots = all
          ? activeRows(db).map(r => ({id:r.id,version:r.version}))
          : [...selected].map(([id,version]) => ({id,version}));
        if (!snapshots.length) throw Error("Няма избрани DAY записи за изтриване.");
        const count = snapshots.length;
        if (!window.confirm("Изтриване на " + (all ? "ВСИЧКИ " : "") + count +
          " DAY записа?\nТова ще промени статистиката за дните без инциденти. " +
          "Инцидентите INC, оценката на риска и приоритетът няма да се променят.\n" +
          "DAY номерата и историята се запазват. Потвърждавате ли?")) return;
        const latest = documentState();
        const deleted = deleteBatch(latest, snapshots, DELETE_AUDIT_NOTE, stamp(), all);
        localStorage.setItem(KEY, JSON.stringify(latest));
        selected.clear(); fresh(); render();
        notify("Изтрити са " + deleted + " DAY записа. Историята е запазена; " +
          "статистиката за дните без инциденти е актуализирана.");
      } catch (err) { notify("Масовото изтриване е отказано: " + err.message, true); render(); }
    }
    $("day-demo-delete-selected").addEventListener("click", () => deleteMany(false));
    $("day-demo-delete-all").addEventListener("click", () => deleteMany(true));
    list.addEventListener("click", e => {
      const btn = e.target.closest("button[data-day-action]");
      if (!btn) return;
      try {
        const db = documentState(), inc = incidents();
        const r = db.entries.find(x => x.id === btn.dataset.dayId);
        if (!r) throw Error("Записът вече не съществува.");
        const action = btn.dataset.dayAction;
        if (action === "view") {
          const lines = ["ID: " + r.id, "Дата и час: " + r.date + " " + r.time,
            "Статус: " + statusFor(r,inc), "Версия: " + r.version,
            "Описание: " + r.description, "Действия: " + r.actions,
            "Взаимодействие: " + r.coordination, "Източник: " + r.source,
            "Попълнил (бележка): " + r.authorNote, "", "История:"];
          for (const x of r.audit) lines.push("v" + x.version + " · " + x.at + " · " + x.action +
            (x.reason ? " · " + x.reason : "") + (x.before ? "\nПреди: " + x.before : ""));
          auditBox.textContent = lines.join("\n"); auditBox.hidden = false;
          auditBox.scrollIntoView({block:"nearest"});
        } else if (action === "edit") {
          if (r.status !== "active" || statusFor(r, inc).startsWith("Нужна"))
            throw Error("Не може да се редактира архивиран или оспорен DAY отчет.");
          editing = {id:r.id,version:r.version};
          $("day-demo-number").textContent = r.id + " · v" + r.version;
          $("day-demo-date").value = r.date; $("day-demo-time").value = r.time;
          for (const k of FIELDS) $("day-demo-" + k).value = r[k];
          $("day-demo-edit-label").hidden = false;
          $("day-demo-edit-reason").required = true;
          $("day-demo-save").textContent = "Запази корекцията";
          form.scrollIntoView({block:"start",behavior:"smooth"});
          notify("Редактиране на " + r.id + ". Основанието е задължително.");
        } else if (action === "archive" || action === "restore") {
          if (action === "archive" && r.status !== "active" ||
              action === "restore" && r.status !== "archived") throw Error("Статусът вече е променен.");
          if (action === "restore" && inc.some(i=>i.date.slice(0,10)===r.date))
            throw Error("DAY не може да се възстанови при инцидент на същата дата.");
          if (!confirm((action === "archive" ? "Архивиране на " : "Възстановяване на ") + r.id +
            "?\nИсторията се запазва. Това не променя инцидентите и оценката на риска.")) return;
          change(action === "archive" ? "archived" : "restored", r,
            action === "archive" ? "Архивиране от DEMO интерфейса" : "Възстановяване от DEMO интерфейса");
          r.status = action === "archive" ? "archived" : "active";
          localStorage.setItem(KEY, JSON.stringify(db));
          fresh(); render(); notify("Нов статус на " + r.id + ": " + statusFor(r,inc) + ".");
        } else if (action === "delete") {
          if (r.status !== "active" && r.status !== "archived")
            throw Error("Този отчет вече е изтрит.");
          if (!window.confirm("Изтриване на " + r.id + "?\n" +
            "Отчетът ще бъде скрит от активния списък и статистиката. " +
            "Историята и номерът DAY се запазват. Продължавате ли?")) return;
          change("deleted", r, DELETE_AUDIT_NOTE);
          r.status = "deleted";
          localStorage.setItem(KEY, JSON.stringify(db));
          fresh(); render();
          notify(r.id + " е изтрит от активните отчети. Номерът и одитната следа се пазят; " +
            "може да го видите чрез „Покажи изтритите“.");
        }
      } catch (err) { notify("Действието е отказано: " + err.message, true); }
    });
    function filtered() {
      const from = $("day-demo-from").value, to = $("day-demo-to").value;
      return timeline(documentState().entries, incidents(), from, to);
    }
    function paintTimeline() {
      const body = $("day-demo-timeline-rows");
      body.replaceChildren();
      const events = filtered();
      $("day-demo-timeline-count").textContent = "Записи: " + events.length +
        ". DAY не се включват в броя инциденти и не преизчисляват риска.";
      if (!events.length) { const tr = document.createElement("tr"), td = document.createElement("td");
        td.colSpan = 6; td.textContent = "Няма записи за избрания период."; tr.append(td); body.append(tr); }
      for (const entry of events.slice(0, 300)) {
        const tr = document.createElement("tr");
        if (entry.status.startsWith("Нужна")) tr.className="day-demo-alert-row";
        for (const v of [entry.id, entry.date, entry.time, entry.category, entry.description, entry.status]) {
          const td=document.createElement("td");td.textContent=v||"—";tr.append(td);
        }
        body.append(tr);
      }
      if (events.length > 300) $("day-demo-timeline-count").textContent += " Показани са първите 300.";
    }
    $("day-demo-timeline-refresh").addEventListener("click", () => {
      try {paintTimeline();notify("Хронологията е обновена.");}
      catch(e){notify("Невалиден период: "+e.message,true);}
    });
    function escapeHTML(s) {
      return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    }
    function exportTable(events) {
      let rows="";
      for (const e of events) rows += "<tr>" + [e.id,e.date,e.time,e.category,e.description,e.status]
        .map(v=>"<td>"+escapeHTML(v)+"</td>").join("") + "</tr>";
      return '<!doctype html><html lang="bg"><head><meta charset="utf-8"><title>LUCIFER INC/DAY — DEMO</title>' +
        '<style>body{font:14px Arial;color:#12263b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:7px;text-align:left}h1{font-size:22px}</style>' +
        '</head><body><h1>LUCIFER-WEB · Хронология INC/DAY</h1><p>Демонстрационни локални записи. Не е официален отчет и не удостоверява липса на инциденти.</p>' +
        '<table><thead><tr><th>ID</th><th>Дата</th><th>Час</th><th>Категория</th><th>Описание</th><th>Статус</th></tr></thead><tbody>'+rows+'</tbody></table></body></html>';
    }
    function download(content, type, name) {
      const url=URL.createObjectURL(new Blob([content],{type}));
      const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2500);
    }
    $("day-demo-word").addEventListener("click", () => {
      try {download(exportTable(filtered()),"application/msword;charset=utf-8","LUCIFER-INC-DAY-DEMO.doc");
        notify("Изтеглен е Word-съвместим отчет. Не е официален документ.");}
      catch(e){notify("Експортът е отказан: "+e.message,true);}
    });
    $("day-demo-print").addEventListener("click", () => {
      try {
        const events=filtered(), sheet=$("day-demo-print-sheet");
        sheet.replaceChildren();
        const heading=document.createElement("h1");heading.textContent="LUCIFER-WEB · Хронология INC/DAY";sheet.append(heading);
        const note=document.createElement("p");note.textContent="Демонстрационни локални данни. Не е официален отчет.";sheet.append(note);
        const table=document.createElement("table"), head=table.createTHead().insertRow(), tbody=table.createTBody();
        for (const label of ["ID","Дата","Час","Категория","Описание","Статус"]) {
          const th=document.createElement("th");th.textContent=label;head.append(th);
        }
        for(const entry of events){const tr=tbody.insertRow();
          for(const v of [entry.id,entry.date,entry.time,entry.category,entry.description,entry.status]){
            const td=tr.insertCell();td.textContent=v||"—";
          }
        }
        sheet.append(table);
        window.print();
        notify("Отворен е печатният диалог — изберете „Запиши като PDF“.");
      } catch(e) {notify("Печатът е отказан: "+e.message,true);}
    });
    $("day-demo-backup").addEventListener("click", () => {
      try {download(JSON.stringify({kind:"LUCIFER-DAY-DEMO-BACKUP",data:documentState()},null,2),
        "application/json;charset=utf-8","LUCIFER-DAY-DEMO-backup.json");notify("DAY резервното копие е изтеглено.");}
      catch(e){notify("Архивът е отказан: "+e.message,true);}
    });
    $("day-demo-import").addEventListener("click",()=>$("day-demo-file").click());
    $("day-demo-file").addEventListener("change",async e => {
      const file=e.target.files?.[0];e.target.value="";if(!file)return;
      try {
        if(file.size>2*1024*1024)throw Error("Файлът е над 2 MB.");
        const backup=JSON.parse(await file.text());
        if(!backup||backup.kind!=="LUCIFER-DAY-DEMO-BACKUP")throw Error("Неправилен тип DAY архив.");
        const next=validated(backup.data);
        documentState(); // A damaged existing store must not be silently overwritten.
        if(!confirm("Заменяне на всички локални DAY отчети с "+next.entries.length+
          " от архива? Инцидентите остават непроменени. Направете резервно копие преди операцията."))return;
        localStorage.setItem(KEY,JSON.stringify(next));
        selected.clear();fresh();render();notify("Възстановени са "+next.entries.length+" DAY отчета (само в DEMO).");
      } catch(err){notify("Възстановяването е отказано: "+err.message,true);}
    });
    window.addEventListener("lucifer:tab-changed", e => {
      if(e.detail?.tab==="day-journal") {render();if(editing)notify("Редакция на "+editing.id+" — довършете или изберете „Нов отчет“.");}
    });
    window.addEventListener("storage", e => {if(e.key===KEY||e.key===INCIDENT_KEY)render();});
    fresh();render();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
