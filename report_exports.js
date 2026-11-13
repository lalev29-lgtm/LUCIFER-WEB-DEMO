"use strict";
/* Client-side report exports for the three LUCIFER demo pages.
 * No network requests, no changes to saved data, no approval inference.
 * Word produces a Word-compatible .doc; PDF uses the browser print-to-PDF dialog.
 */
(function () {
  const INCIDENT_KEY = "lucifer-web-site-001-demo-v1";
  const REVIEW_KEY = "lucifer-web-safety-review-demo-v1";
  const LABELS = [
    ["id","ID"],["date","Дата и час (оригинална стойност)"],
    ["shift","Смяна"],["weekday","Ден от седмицата"],["zone","Зона"],
    ["category","Категория"],["expert","Експертно ниво H"],
    ["guards","Брой охранители"],["cctv","Видеонаблюдение CCTV"],
    ["access","Контрол на достъпа"],["sot","СОТ"],
    ["visitors","Посетители в зоната"],["detect","Откриване (мин)"],
    ["react","Реакция (мин)"],["result","Резултат"],
    ["prevented","Предотвратена кражба"],["evidence","Статус на проверката"],
    ["reference","Препратка към доказателства"],
    ["threatened","Застрашена стойност V (евро)"],
    ["damage","Действителна щета P (евро)"],["description","Описание"]
  ];
  const REVIEW_LABELS = {
    checkStatus:"Статус на проверката",signal:"Експертен сигнал",
    severity:"Степен на опасност",description:"Описание на опасността",
    basis:"Основание за решението",source:"Източник",
    evidenceRef:"Препратка към доказателства",
    evidenceStatus:"Доказателствен статус",evaluator:"Оценяващ",
    reviewDate:"Дата на оценката",firstReviewer:"Първи проверяващ",
    firstDate:"Дата на първа проверка",firstOpinion:"Първо становище",
    firstMotive:"Мотиви на първия проверяващ",
    secondReviewer:"Втори проверяващ",secondDate:"Дата на втора проверка",
    secondOpinion:"Второ становище",secondMotive:"Мотиви на втория проверяващ",
    measure:"Защитна мярка",owner:"Отговорник",deadline:"Срок",
    version:"Версия",incidentSnapshot:"Контролен отпечатък на инцидентите"
  };
  const PAGE = {
    incidents:["Инциденти","Incidents"],
    risk:["Оценка на риска","Risk"],
    priority:["Приоритет на третиране и 02 План третиране","Priority"]
  };
  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;").replace(/\r?\n/g,"<br>");
  }
  function plain(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }
  function safeRead(key,limit) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    if (raw.length > limit) throw new Error("Прекалено голям или невалиден локален регистър.");
    try { return JSON.parse(raw); }
    catch (_) { throw new Error("Невалиден локален регистър. Експортът е спрян, без промяна на данните."); }
  }
  function kvTable(entries) {
    return '<table class="report-fields"><tbody>' + entries.map(function (entry) {
      return "<tr><th>" + esc(entry[0]) + "</th><td>" + esc(plain(entry[1])) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function incidentRows() {
    const rows = safeRead(INCIDENT_KEY,1000000) || [];
    if (!Array.isArray(rows) || rows.length > 399)
      throw new Error("Регистърът „Инциденти“ не може да бъде прочетен.");
    const seen = new Set();
    rows.forEach(function (row) {
      if (!row || typeof row !== "object" || Array.isArray(row) ||
          !/^INC-\d{3}$/.test(row.id) || Number(row.id.slice(4)) < 1 ||
          Number(row.id.slice(4)) > 399 || seen.has(row.id))
        throw new Error("Невалиден или повторен INC идентификатор. Експортът е спрян.");
      seen.add(row.id);
    });
    return rows;
  }
  function incidentReport() {
    const rows = incidentRows();
    const known = new Set(LABELS.map(function (x) { return x[0]; }));
    let html = "<p><strong>Общо записани инциденти: " + rows.length +
      "</strong> (максимум 399). Всички записи, не само избраните.</p>";
    if (!rows.length) return html + "<p>Няма записани инциденти.</p>";
    rows.forEach(function (row,index) {
      const entries = LABELS.map(function (f) {
        const value = f[0] === "prevented" ? (row.prevented === "yes" ? "Да" :
          row.prevented === "no" ? "Не" : (row.prevented || "")) : row[f[0]];
        return [f[1],value];
      });
      Object.keys(row).filter(function (k) { return !known.has(k); })
        .sort().forEach(function (k) { entries.push([k,row[k]]); });
      html += "<h2>Запис " + (index+1) + ": " + esc(row.id) + "</h2>" +
        kvTable(entries);
    });
    return html;
  }
  function extractTable(table,index) {
    const headerRow = table.tHead && table.tHead.rows[0];
    const headers = headerRow ? Array.from(headerRow.cells).map(function (c) {
      return c.textContent.trim();
    }) : [];
    const rows = Array.from(table.tBodies).flatMap(function (body) {
      return Array.from(body.rows);
    });
    let html = "<h3>Пълна таблица " + index + " — " +
      headers.length + " колони, " + rows.length + " реда</h3>";
    if (!rows.length) return html + "<p>Няма записи.</p>";
    rows.forEach(function (row,i) {
      const cells = Array.from(row.cells);
      if (cells.length === 1 && cells[0].colSpan > 1) {
        html += "<p>" + esc(cells[0].textContent.trim()) + "</p>";
        return;
      }
      const title = cells[0] ? cells[0].textContent.trim() : "";
      html += "<h4>Ред " + (i+1) + (title ? " — " + esc(title) : "") + "</h4>";
      html += kvTable(cells.map(function (cell,j) {
        return [headers[j] || "Колона " + (j+1),cell.textContent.trim()];
      }));
    });
    return html;
  }
  function walk(node,state) {
    if (!node || node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (["script","style","form","button","input","select","textarea","svg"].includes(tag))
      return "";
    if (tag === "table") return extractTable(node,++state.tables);
    if (node.classList.contains("lucifer-stat")) {
      return kvTable([[
        node.querySelector(".lucifer-stat-name")?.textContent.trim() || "Показател",
        node.querySelector(".lucifer-stat-value")?.textContent.trim() || ""
      ]]);
    }
    if (node.classList.contains("lucifer-fact")) {
      return kvTable([[
        node.querySelector("dt")?.textContent.trim() || "Показател",
        node.querySelector("dd")?.textContent.trim() || ""
      ]]);
    }
    if (tag === "summary") return "<h3>" + esc(node.textContent.trim()) + "</h3>";
    if (["h2","h3","h4","h5"].includes(tag))
      return "<" + tag + ">" + esc(node.textContent.trim()) + "</" + tag + ">";
    if (["p","li"].includes(tag))
      return "<p>" + esc(node.textContent.trim()) + "</p>";
    if (tag === "dl") return Array.from(node.children).map(function (c) {
      return walk(c,state);
    }).join("");
    if (tag === "dt" || tag === "dd") return "<p>" + esc(node.textContent.trim()) + "</p>";
    const children = Array.from(node.children);
    if (!children.length) {
      const value = node.textContent.trim();
      return value ? "<p>" + esc(value) + "</p>" : "";
    }
    return children.map(function (child) { return walk(child,state); }).join("");
  }
  function resultReport(id) {
    const root = document.getElementById(id+"-results");
    if (!root) throw new Error("Страницата не е заредена.");
    const state = {tables:0};
    const body = walk(root,state);
    if (!body.trim()) throw new Error("Резултатите не са налични за експорт.");
    return body;
  }
  function safetyReport() {
    const reviews = window.LuciferSafetyPriority?.read();
    if (!reviews || typeof reviews !== "object")
      throw new Error("Не може да се прочетат проверките за безопасност.");
    const ids = Object.keys(reviews).sort();
    let result = "<h2>Всички локално записани проверки на безопасността</h2>" +
      "<p>Брой проверки: " + ids.length +
      ". Това са въведени данни, не официално одобрени експертни решения.</p>";
    if (!ids.length) return result + "<p>Няма въведени проверки.</p>";
    ids.forEach(function (id) {
      const item = reviews[id];
      result += "<h3>" + esc(id) + "</h3>" +
        kvTable(Object.keys(item).map(function (key) {
          return [REVIEW_LABELS[key] || key,item[key]];
        }));
    });
    return result;
  }
  function buildReport(page) {
    if (!PAGE[page]) throw new Error("Неизвестна страница.");
    // Verify local incident data even when an old calculation remains visible.
    incidentRows();
    let body;
    if (page === "incidents") body = incidentReport();
    else if (page === "risk") {
      const notice = document.querySelector("#risk > .notice");
      body = "<p>" + esc(notice ? notice.textContent.trim() : "Предварителна оценка.") +
        "</p>" + resultReport("risk");
    } else {
      const notice = document.querySelector("#priority > .notice");
      const planNotice = document.querySelector("#priority #treatment-heading + .notice");
      body = "<p>" + esc(notice ? notice.textContent.trim() : "Предварителен приоритет.") +
        "</p>" + resultReport("priority") +
        "<h2>02 План третиране — всички записани мерки</h2>" +
        (planNotice ? "<p>" + esc(planNotice.textContent.trim()) + "</p>" : "") +
        walk(document.getElementById("treatment-results"),{tables:0}) +
        safetyReport();
    }
    return {
      title: PAGE[page][0],
      filename: "LUCIFER_" + PAGE[page][1] + "_" +
        new Date().toISOString().slice(0,10) ,
      body: body
    };
  }
  function documentHtml(report) {
    const css = "@page{size:A4;margin:16mm}" +
      "body{font:11pt Arial,Calibri,sans-serif;color:#162538;background:#fff}" +
      "h1{font-size:21pt;color:#173a62;border-bottom:2px solid #9ab9d1;padding-bottom:8pt}" +
      "h2{font-size:15pt;color:#173a62;margin-top:22pt}h3{font-size:12pt;color:#243f5d}" +
      "h4{font-size:11pt;color:#34506a;margin:15pt 0 5pt}" +
      "p{line-height:1.5;margin:7pt 0;overflow-wrap:anywhere}" +
      "table.report-fields{border-collapse:collapse;width:100%;margin:7pt 0 13pt;" +
      "table-layout:fixed;page-break-inside:auto}" +
      "table.report-fields th,table.report-fields td{border:1px solid #a9bacb;" +
      "padding:5pt;text-align:left;vertical-align:top;white-space:normal;" +
      "overflow-wrap:anywhere;word-break:break-word}" +
      "table.report-fields th{background:#eaf1f7;width:38%;font-weight:bold}" +
      "table.report-fields tr{break-inside:avoid;page-break-inside:avoid}" +
      "@media print{h2,h3,h4{break-after:avoid;page-break-after:avoid}" +
      "table.report-fields{width:100%}body{background:#fff}}";
    return '<!doctype html><html lang="bg"><head><meta charset="utf-8">' +
      "<title>" + esc(report.title) + "</title><style>" + css +
      '</style></head><body><h1>LUCIFER-WEB · ' + esc(report.title) +
      "</h1><p>Експортирано: " + esc(new Date().toLocaleString("bg-BG")) +
      "</p><p><strong>Източник:</strong> локални записи в този браузър. " +
      "Оценките и приоритетите са предварителни и НЕОДОБРЕНИ. " +
      "Документът не представлява експертно одобрение или заверен архив.</p>" +
      report.body + "</body></html>";
  }
  function wordExport(html,filename) {
    const blob = new Blob(["\ufeff",html],{type:"application/msword;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename + ".doc";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); },30000);
  }
  function pdfExport(html) {
    const popup = window.open("","_blank");
    if (!popup) throw new Error("Разрешете изскачащия прозорец за печат / PDF.");
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    let printed = false;
    function printOnce() {
      if (printed || popup.closed) return;
      printed = true;
      popup.focus();
      popup.print();
    }
    popup.addEventListener("load",printOnce,{once:true});
    // about:blank can finish loading before its printable content is written.
    setTimeout(printOnce,350);
  }
  function handle(event) {
    const button = event.target.closest("[data-report-export]");
    if (!button) return;
    const page = button.getAttribute("data-report-export");
    const format = button.getAttribute("data-report-format");
    const status = document.getElementById("report-export-status-" + page);
    try {
      const report = buildReport(page),html = documentHtml(report);
      if (format === "word") wordExport(html,report.filename);
      else if (format === "pdf") pdfExport(html);
      else throw new Error("Непознат формат.");
      if (status) status.textContent = format === "word" ?
        "Word отчетът е подготвен за изтегляне." :
        "В прозореца за печат изберете „Запази като PDF“.";
    } catch (error) {
      if (status) status.textContent = "Експортът е спрян: " + error.message;
    }
  }
  document.addEventListener("click",handle);
  window.LuciferReportExports = Object.freeze({buildReport:buildReport,documentHtml:documentHtml});
})();
