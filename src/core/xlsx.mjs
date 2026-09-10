import { localDate } from "./dashboard-query.mjs";

const encoder = new TextEncoder();

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

const styleIndexes = {
  Normal: 0,
  Title: 1,
  Subtitle: 2,
  Section: 3,
  HeaderBlue: 4,
  HeaderDark: 5,
  Card: 6,
  CardStrong: 7,
  Number: 8,
  KpiLabel: 9,
  KpiValueGreen: 10,
  KpiValueBlue: 11,
  KpiValueAmber: 12,
  KpiValueRed: 13,
  Todo: 14,
  Doing: 15,
  Done: 16,
  Risk: 17,
  Warning: 18,
  Muted: 19
};

function worksheetXml(sheet) {
  const renderedRows = (sheet.rows ?? []).map((row, rowIndex) => {
    const height = sheet.rowHeights?.[rowIndex];
    const heightAttribute = height ? ` ht="${height}" customHeight="1"` : "";
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = styleIndexes[sheet.cellStyles?.[rowIndex]?.[columnIndex]] ?? styleIndexes.Normal;
      const styleAttribute = ` s="${style}"`;
      if (value === null || value === undefined || value === "") return `<c r="${reference}"${styleAttribute}/>`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
      return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}"${heightAttribute}>${cells}</row>`;
  }).join("");
  const columns = (sheet.columnWidths ?? []).map((width, index) => width
    ? `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
    : "").join("");
  const columnXml = columns ? `<cols>${columns}</cols>` : "";
  const freezeXml = sheet.freezeRow
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const mergeXml = sheet.mergedCells?.length
    ? `<mergeCells count="${sheet.mergedCells.length}">${sheet.mergedCells.map((merge) => `<mergeCell ref="${xml(merge)}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freezeXml}${columnXml}<sheetData>${renderedRows}</sheetData>${mergeXml}</worksheet>`;
}

function contentTypes(sheetCount) {
  const overrides = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`;
}

function workbookXml(sheets) {
  const list = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list}</sheets></workbook>`;
}

function workbookRelationships(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function stylesXml() {
  const fonts = [
    `<font><sz val="11"/><name val="Calibri"/><color rgb="FF1F2937"/></font>`,
    `<font><b/><sz val="16"/><name val="Calibri"/><color rgb="FF171A2F"/></font>`,
    `<font><sz val="10"/><name val="Calibri"/><color rgb="FF475569"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF171A2F"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF047857"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF1E40AF"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFB45309"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFB91C1C"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF334155"/></font>`
  ];
  const fills = [
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF9"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF1E40AF"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF171A2F"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>`
  ];
  const borders = [
    `<border><left/><right/><top/><bottom/><diagonal/></border>`,
    `<border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>`,
    `<border><left style="thin"><color rgb="FFBFDBFE"/></left><right style="thin"><color rgb="FFBFDBFE"/></right><top style="thin"><color rgb="FFBFDBFE"/></top><bottom style="thin"><color rgb="FFBFDBFE"/></bottom><diagonal/></border>`,
    `<border><left/><right/><top/><bottom style="medium"><color rgb="FF1E40AF"/></bottom><diagonal/></border>`,
    `<border><left/><right/><top/><bottom style="medium"><color rgb="FF171A2F"/></bottom><diagonal/></border>`
  ];
  const fillByStyle = [0, 0, 0, 2, 3, 4, 5, 2, 5, 2, 7, 6, 8, 9, 10, 8, 7, 9, 8, 0];
  const fontByStyle = [0, 1, 2, 4, 3, 3, 0, 4, 0, 4, 5, 6, 7, 8, 9, 7, 5, 8, 7, 2];
  const borderByStyle = [0, 4, 0, 3, 3, 4, 1, 2, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0];
  const alignmentByStyle = ["", ` horizontal="center" vertical="center"`, ` vertical="center"`, ` horizontal="left" vertical="center"`, ` horizontal="center" vertical="center" wrapText="1"`, ` horizontal="center" vertical="center" wrapText="1"`, ` vertical="top" wrapText="1"`, ` vertical="center"`, ` horizontal="right"`, ` horizontal="center" vertical="center" wrapText="1"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="center" vertical="center"`, ` horizontal="left" vertical="center" wrapText="1"`, ` horizontal="left" vertical="center" wrapText="1"`, ` vertical="center" wrapText="1"`];
  const xfs = fillByStyle.map((fill, index) => `<xf numFmtId="0" fontId="${fontByStyle[index]}" fillId="${fill}" borderId="${borderByStyle[index]}" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${alignmentByStyle[index]}/></xf>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs></styleSheet>`;
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(8, localParts.length, true);
  endView.setUint16(10, localParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of localParts) { result.set(part, cursor); cursor += part.length; }
  for (const part of centralParts) { result.set(part, cursor); cursor += part.length; }
  result.set(end, cursor);
  return result;
}

export function createXlsxWorkbook(inputSheets) {
  const sheets = inputSheets.map((sheet) => ({
    ...sheet,
    name: String(sheet.name).slice(0, 31),
    rows: sheet.rows ?? []
  }));
  const files = {
    "[Content_Types].xml": contentTypes(sheets.length),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": workbookXml(sheets),
    "xl/_rels/workbook.xml.rels": workbookRelationships(sheets.length),
    "xl/styles.xml": stylesXml()
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = worksheetXml(sheet); });
  return zip(files);
}

function taskRows(tasks) {
  return [["Attività", "Note", "Conclusioni", "Stato", "Priorità", "Tag", "Persone", "Scadenza", "Creata", "Aggiornata"], ...tasks.map((task) => [task.title, task.notes, task.conclusions, task.statusLabel, task.priorityLabel, task.tags, task.assigneeName ?? task.assignees, task.dueDate ?? "", task.createdAt ?? "", task.updatedAt ?? ""])];
}

function legacyProjectWorkbookSheets(report) {
  const tasks = report.tasks ?? [];
  const taskSheet = (status) => taskRows(tasks.filter((task) => task.status === status));
  return [
    { name: "Dashboard", rows: [["Progetto", report.project.name], ["Descrizione", report.project.description ?? ""], [], ["KPI", "Valore"], ["Attività totali", report.metrics.totalTasks], ["Da fare", report.metrics.todoTasks], ["Presa in carico", report.metrics.doingTasks], ["Fatti", report.metrics.doneTasks], ["Rischi scadenza", report.metrics.overdueTasks], ["Scadenze vicine", report.metrics.dueSoonTasks], ["Completamento", `${Math.round(report.metrics.completionRate * 100)}%`]] },
    { name: "Anagrafica", rows: [["Campo", "Valore"], ["Nome progetto", report.project.name], ["Descrizione", report.project.description ?? ""], ["Esportato", report.exportedAt ?? ""]] },
    { name: "Persone", rows: [["Persona", "Ruolo", "Azienda", "Da fare", "In corso", "Fatte"], ...(report.people ?? []).map((person) => [person.displayName, person.role, person.company, person.todoCount, person.doingCount, person.doneCount])] },
    { name: "Kanban", rows: taskRows(tasks) },
    { name: "Task Da Fare", rows: taskSheet("Todo") },
    { name: "Task Presa in carico", rows: taskSheet("Doing") },
    { name: "Task Fatti", rows: taskSheet("Done") },
    { name: "Note Finali", rows: [["Note"], [report.finalNotes]] }
  ];
}

function legacyPortfolioWorkbookSheets(report) {
  return [
    { name: "Executive Dashboard", rows: [["KPI", "Valore"], ["Progetti totali", report.metrics.totalProjects], ["Progetti attivi", report.metrics.activeProjects], ["Attività totali", report.metrics.totalTasks], ["Da fare", report.metrics.todoTasks], ["In corso", report.metrics.doingTasks], ["Completate", report.metrics.doneTasks], ["Completate questa settimana", report.metrics.completedThisWeek], ["Rischi", report.metrics.overdueTasks], ["Scadenze vicine", report.metrics.dueSoonTasks]] },
    { name: "Riepilogo Progetti", rows: [["Progetto", "Totali", "Da fare", "In corso", "Fatte", "Completate settimana", "Scadute", "In scadenza"], ...(report.projects ?? []).map((project) => [project.projectName, project.totalTasks, project.todoTasks, project.doingTasks, project.doneTasks, project.completedThisWeek, project.overdueTasks, project.dueSoonTasks])] },
    { name: "Settimana Corrente", rows: taskRows(report.completedThisWeek ?? []) },
    { name: "Sforzo Progetti", rows: [["Progetto", "Attività completate"], ...[...(report.projects ?? [])].sort((a, b) => b.doneTasks - a.doneTasks).map((project) => [project.projectName, project.doneTasks])] },
    { name: "Persone", rows: [["Persona", "Ruolo", "Azienda", "Da fare", "In corso", "Fatte", "Completate settimana"], ...(report.people ?? []).map((person) => [person.displayName, person.role, person.company, person.todoCount, person.doingCount, person.doneCount, person.completedThisWeek])] },
    { name: "Rischi", rows: taskRows(report.risks ?? []) }
  ];
}

function makeSheet(name, columnWidths = []) {
  return { name, rows: [], cellStyles: [], rowHeights: [], columnWidths, mergedCells: [] };
}

function addRow(sheet, values, styles = [], height = null) {
  sheet.rows.push(values);
  sheet.cellStyles.push(styles);
  sheet.rowHeights.push(height);
  return sheet.rows.length;
}

function formatDate(value) {
  if (!value) return "";
  const date = localDate(value);
  if (!date) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function percentage(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function taskStyle(task) {
  if (!task) return "Normal";
  if (task.isOverdue) return "Risk";
  if (task.isDueSoon) return "Warning";
  return { Todo: "Card", Doing: "Warning", Done: "Done" }[task.status] ?? "Card";
}

function addStatusRow(sheet, label, count, total, style) {
  const ratio = total ? count / total : 0;
  const blocks = Math.max(0, Math.round(ratio * 8));
  addRow(
    sheet,
    ["", label, count, percentage(ratio), ...Array.from({ length: 8 }, () => " ")],
    ["Normal", style, "Number", "Card", ...Array.from({ length: 8 }, (_, index) => index < blocks ? style : "Card")],
    20
  );
}

function addProjectBars(sheet, projects, selector) {
  const ordered = [...projects];
  const max = Math.max(1, ...ordered.map(selector));
  for (const project of ordered) {
    const value = selector(project);
    const blocks = Math.max(0, Math.round(value / max * 20));
    addRow(sheet, ["", project.projectName, value, "|".repeat(blocks)], ["Normal", "Card", "Number", "Done"]);
  }
  if (!ordered.length) addRow(sheet, ["", "Nessun progetto disponibile."], ["Normal", "Muted"]);
}

function projectDashboard(report) {
  const sheet = makeSheet("Dashboard", [4, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18]);
  addRow(sheet, ["", `Broject Report - ${report.project.name}`], ["Normal", "Title"], 30);
  sheet.mergedCells.push("B1:L1");
  addRow(sheet, ["", `Export: ${formatDateTime(report.exportedAt)}  |  Dashboard progetto`], ["Normal", "Subtitle"]);
  sheet.mergedCells.push("B2:L2");
  addRow(sheet, []);
  const metrics = report.metrics;
  addRow(sheet, ["", "Totale task", "", "Completamento", "", "Aperti", "", "Scaduti"], ["Normal", "KpiLabel", "KpiLabel", "KpiLabel", "KpiLabel", "KpiLabel", "KpiLabel", "KpiLabel"], 20);
  sheet.mergedCells.push("B4:C4", "D4:E4", "F4:G4", "H4:I4");
  addRow(sheet, ["", metrics.totalTasks, "", percentage(metrics.completionRate), "", metrics.openTasks ?? metrics.todoTasks + metrics.doingTasks, "", metrics.overdueTasks], ["Normal", "KpiValueBlue", "KpiValueBlue", "KpiValueGreen", "KpiValueGreen", "KpiValueAmber", "KpiValueAmber", metrics.overdueTasks > 0 ? "KpiValueRed" : "KpiValueGreen"], 34);
  sheet.mergedCells.push("B5:C5", "D5:E5", "F5:G5", "H5:I5");
  addRow(sheet, []);
  addRow(sheet, ["", "Avanzamento lavori"], ["Normal", "Section"], 22);
  sheet.mergedCells.push("B7:L7");
  const completedCells = Math.round(Number(metrics.completionRate || 0) * 10);
  addRow(sheet, ["", percentage(metrics.completionRate), ...Array.from({ length: 10 }, () => " ")], ["Normal", "CardStrong", ...Array.from({ length: 10 }, (_, index) => index < completedCells ? "Done" : "Card")], 24);
  addRow(sheet, ["", "La barra mostra la percentuale di task completati sul totale del progetto."], ["Normal", "Subtitle"]);
  sheet.mergedCells.push("B9:L9");
  addRow(sheet, []);
  addRow(sheet, ["", "Distribuzione stato attuale"], ["Normal", "Section"], 22);
  sheet.mergedCells.push("B11:L11");
  addRow(sheet, ["", "Stato", "Task", "Percentuale", "Indicatore"], ["Normal", "HeaderBlue", "HeaderBlue", "HeaderBlue", "HeaderBlue"], 20);
  sheet.mergedCells.push("E12:L12");
  addStatusRow(sheet, "Da fare", metrics.todoTasks, metrics.totalTasks, "Todo");
  addStatusRow(sheet, "Presa in carico", metrics.doingTasks, metrics.totalTasks, "Doing");
  addStatusRow(sheet, "Fatti", metrics.doneTasks, metrics.totalTasks, "Done");
  addRow(sheet, []);
  addRow(sheet, ["", "Carico per persona"], ["Normal", "Section"], 22);
  sheet.mergedCells.push(`B${sheet.rows.length}:L${sheet.rows.length}`);
  addRow(sheet, ["", "Persona", "Ruolo", "Azienda", "Da fare", "Presa in carico", "Fatti", "Totale"], ["Normal", ...Array(7).fill("HeaderDark")], 20);
  const people = [...(report.people ?? [])].sort((a, b) => (b.todoCount + b.doingCount + b.doneCount) - (a.todoCount + a.doingCount + a.doneCount));
  if (!people.length) {
    addRow(sheet, ["", "Nessuna persona assegnata ai task del progetto."], ["Normal", "Muted"]);
    sheet.mergedCells.push(`B${sheet.rows.length}:H${sheet.rows.length}`);
  } else {
    for (const person of people) addRow(sheet, ["", person.displayName, person.role, person.company, person.todoCount, person.doingCount, person.doneCount, person.todoCount + person.doingCount + person.doneCount], ["Normal", "Card", "Card", "Card", "Number", "Number", "Number", "Number"]);
  }
  addRow(sheet, []);
  addRow(sheet, ["", "Scadenze e rischi"], ["Normal", "Section"], 22);
  sheet.mergedCells.push(`B${sheet.rows.length}:L${sheet.rows.length}`);
  addRow(sheet, ["", "Task", "Stato", "Assegnatario", "Scadenza", "Segnale"], ["Normal", ...Array(5).fill("HeaderBlue")], 20);
  const risks = [...(report.tasks ?? [])].filter((task) => task.isOverdue || task.isDueSoon).sort((a, b) => (localDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) - (localDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY)).slice(0, 10);
  if (!risks.length) {
    addRow(sheet, ["", "Nessun task scaduto o in scadenza nei prossimi 7 giorni."], ["Normal", "Muted"]);
    sheet.mergedCells.push(`B${sheet.rows.length}:F${sheet.rows.length}`);
  } else {
    for (const task of risks) {
      const style = task.isOverdue ? "Risk" : "Warning";
      addRow(sheet, ["", task.title, task.statusLabel, task.assigneeName, formatDate(task.dueDate), task.isOverdue ? "Scaduto" : "Entro 7 giorni"], ["Normal", style, style, style, style, style]);
    }
  }
  return sheet;
}

function projectRegistry(report) {
  const sheet = makeSheet("Anagrafica", [24, 52, 24, 24]);
  addRow(sheet, ["Anagrafica progetto"], ["Title"], 30);
  sheet.mergedCells.push("A1:D1");
  const pairs = [["Nome progetto", report.project.name], ["Descrizione", report.project.description ?? ""], ["Creato il", formatDateTime(report.project.createdAt)], ["Ultima modifica", formatDateTime(report.project.updatedAt)], ["Export generato il", formatDateTime(report.exportedAt)], ["Totale task", report.metrics.totalTasks], ["Completamento", percentage(report.metrics.completionRate)], ["Task scaduti", report.metrics.overdueTasks]];
  for (const [label, value] of pairs) {
    addRow(sheet, [label, value], ["HeaderDark", "Card"]);
    sheet.mergedCells.push(`B${sheet.rows.length}:D${sheet.rows.length}`);
  }
  return sheet;
}

function projectPeople(report) {
  const sheet = makeSheet("Persone", [20, 20, 24, 26, 14, 14, 14, 14]);
  sheet.freezeRow = 2;
  addRow(sheet, ["Persone coinvolte"], ["Title"], 30);
  sheet.mergedCells.push("A1:H1");
  addRow(sheet, ["Nome", "Cognome", "Ruolo", "Azienda", "Da fare", "Presa in carico", "Fatti", "Totale"], Array(8).fill("HeaderBlue"), 22);
  for (const person of report.people ?? []) addRow(sheet, [person.firstName, person.lastName, person.role, person.company, person.todoCount, person.doingCount, person.doneCount, person.todoCount + person.doingCount + person.doneCount], ["Card", "Card", "Card", "Card", "Number", "Number", "Number", "Number"]);
  if (!(report.people ?? []).length) {
    addRow(sheet, ["Nessuna persona coinvolta nel progetto."], ["Muted"]);
    sheet.mergedCells.push("A3:H3");
  }
  return sheet;
}

function kanbanCard(task) {
  if (!task) return "";
  const due = formatDate(task.dueDate) || "Nessuna scadenza";
  const conclusions = task.conclusions ? `\nConclusioni: ${task.conclusions}` : "";
  const tags = task.tags ? `\nTag: ${task.tags}` : "";
  return `${task.title}\nPriorita: ${task.priorityLabel}\nPersone: ${task.assigneeName}\nScadenza: ${due}${tags}${conclusions}`;
}

function projectKanban(report) {
  const sheet = makeSheet("Kanban", [34, 34, 34]);
  addRow(sheet, ["Kanban - stato attuale all'export"], ["Title"], 30);
  sheet.mergedCells.push("A1:C1");
  addRow(sheet, ["Da fare", "Presa in carico", "Fatti"], ["Todo", "Doing", "Done"], 24);
  const columns = ["Todo", "Doing", "Done"].map((status) => (report.tasks ?? []).filter((task) => task.status === status));
  const max = Math.max(...columns.map((column) => column.length), 0);
  if (!max) {
    addRow(sheet, ["Nessun task nel progetto."], ["Muted"], 40);
    sheet.mergedCells.push("A3:C3");
  } else {
    for (let index = 0; index < max; index++) addRow(sheet, columns.map((column) => kanbanCard(column[index])), columns.map((column) => taskStyle(column[index])), 82);
  }
  return sheet;
}

function projectTaskList(report, status, name) {
  const sheet = makeSheet(name, [30, 28, 22, 36, 36, 18, 24, 20, 24, 16, 18, 18]);
  sheet.freezeRow = 2;
  addRow(sheet, [name], ["Title"], 30);
  sheet.mergedCells.push("A1:L1");
  addRow(sheet, ["Task", "Priorita", "Tag", "Note", "Conclusioni", "Stato", "Persone", "Ruolo", "Azienda", "Scadenza", "Creato", "Aggiornato"], Array(12).fill("HeaderBlue"), 22);
  const tasks = (report.tasks ?? []).filter((task) => task.status === status);
  for (const task of tasks) {
    const row = [task.title, task.priorityLabel, task.tags, task.notes, task.conclusions, task.statusLabel, task.assigneeName, task.assigneeRole, task.assigneeCompany, formatDate(task.dueDate), formatDateTime(task.createdAt), formatDateTime(task.updatedAt)];
    addRow(sheet, row, Array(10).fill(taskStyle(task)).concat(["Card", "Card"]));
  }
  if (!tasks.length) {
    addRow(sheet, ["Nessun task in questa sezione."], ["Muted"]);
    sheet.mergedCells.push("A3:L3");
  }
  return sheet;
}

function projectNotes(report) {
  const sheet = makeSheet("Note Finali", [110]);
  addRow(sheet, ["Note finali"], ["Title"], 30);
  addRow(sheet, [report.finalNotes], ["Card"], 130);
  return sheet;
}

export function projectWorkbookSheets(report) {
  return [projectDashboard(report), projectRegistry(report), projectPeople(report), projectKanban(report), projectTaskList(report, "Todo", "Task Da Fare"), projectTaskList(report, "Doing", "Task Presa in carico"), projectTaskList(report, "Done", "Task Fatti"), projectNotes(report)];
}

function portfolioDashboard(report) {
  const sheet = makeSheet("Executive Dashboard", [4, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
  addRow(sheet, ["", "Broject - Resoconto generale"], ["Normal", "Title"], 30);
  sheet.mergedCells.push("B1:J1");
  addRow(sheet, ["", `Settimana ${formatDate(report.weekStart)} - ${formatDate(report.weekEnd)} | Export ${formatDateTime(report.exportedAt)}`], ["Normal", "Subtitle"]);
  sheet.mergedCells.push("B2:J2");
  addRow(sheet, []);
  const metrics = report.metrics;
  addRow(sheet, ["", "Completate settimana", "Progetti attivi", "Task aperte", "Rischi"], ["Normal", ...Array(4).fill("KpiLabel")], 20);
  addRow(sheet, ["", metrics.completedThisWeek, metrics.activeProjects, metrics.openTasks ?? metrics.todoTasks + metrics.doingTasks, metrics.overdueTasks + metrics.dueSoonTasks], ["Normal", "KpiValueGreen", "KpiValueBlue", "KpiValueAmber", metrics.overdueTasks > 0 ? "KpiValueRed" : "KpiValueAmber"], 34);
  addRow(sheet, []);
  addRow(sheet, ["", "Stato portfolio"], ["Normal", "Section"], 22);
  sheet.mergedCells.push(`B${sheet.rows.length}:J${sheet.rows.length}`);
  addStatusRow(sheet, "Da fare", metrics.todoTasks, metrics.totalTasks, "Todo");
  addStatusRow(sheet, "Presa in carico", metrics.doingTasks, metrics.totalTasks, "Doing");
  addStatusRow(sheet, "Completati", metrics.doneTasks, metrics.totalTasks, "Done");
  addRow(sheet, []);
  addRow(sheet, ["", "Top progetti per task completate questa settimana"], ["Normal", "Section"], 22);
  sheet.mergedCells.push(`B${sheet.rows.length}:J${sheet.rows.length}`);
  addProjectBars(sheet, [...(report.projects ?? [])].sort((a, b) => b.completedThisWeek - a.completedThisWeek || a.projectName.localeCompare(b.projectName, "it")).slice(0, 8), (project) => project.completedThisWeek);
  return sheet;
}

function portfolioProjectSummary(report) {
  const sheet = makeSheet("Riepilogo Progetti", [32, 14, 14, 18, 14, 18, 14, 14, 18]);
  sheet.freezeRow = 2;
  addRow(sheet, ["Riepilogo progetti"], ["Title"], 30);
  sheet.mergedCells.push("A1:I1");
  addRow(sheet, ["Progetto", "Totale", "Da fare", "Presa in carico", "Fatti", "Fatti settimana", "Aperti", "Rischi", "Completamento"], Array(9).fill("HeaderBlue"), 22);
  for (const project of [...(report.projects ?? [])].sort((a, b) => b.completedThisWeek - a.completedThisWeek || a.projectName.localeCompare(b.projectName, "it"))) {
    const open = project.openTasks ?? project.todoTasks + project.doingTasks;
    const risks = project.overdueTasks + project.dueSoonTasks;
    addRow(sheet, [project.projectName, project.totalTasks, project.todoTasks, project.doingTasks, project.doneTasks, project.completedThisWeek, open, risks, percentage(project.completionRate ?? (project.totalTasks ? project.doneTasks / project.totalTasks : 0))], ["Card", "Number", "Number", "Number", "Number", "Number", "Number", project.overdueTasks > 0 ? "Risk" : "Number", "Card"]);
  }
  return sheet;
}

function portfolioCurrentWeek(report) {
  const sheet = makeSheet("Settimana Corrente", [28, 32, 16, 24, 32, 36, 28, 18, 18]);
  sheet.freezeRow = 2;
  addRow(sheet, [`Task completate ${formatDate(report.weekStart)} - ${formatDate(report.weekEnd)}`], ["Title"], 30);
  sheet.mergedCells.push("A1:I1");
  addRow(sheet, ["Progetto", "Task", "Priorita", "Tag", "Note", "Conclusioni", "Persone", "Scadenza", "Completata"], Array(9).fill("HeaderBlue"), 22);
  for (const task of report.completedThisWeek ?? []) addRow(sheet, [task.projectName, task.title, task.priorityLabel, task.tags, task.notes, task.conclusions, task.assignees, formatDate(task.dueDate), formatDateTime(task.completedAt)], ["Card", "Done", "Done", "Card", "Card", "Done", "Card", "Card", "Done"]);
  if (!(report.completedThisWeek ?? []).length) {
    addRow(sheet, ["Nessuna task completata nella settimana corrente."], ["Muted"]);
    sheet.mergedCells.push("A3:I3");
  }
  return sheet;
}

function portfolioEffort(report) {
  const sheet = makeSheet("Sforzo Progetti", [34, 16, 70]);
  addRow(sheet, ["Sforzo per progetto"], ["Title"], 30);
  sheet.mergedCells.push("A1:C1");
  addRow(sheet, ["Progetto", "Completate", "Indicatore"], Array(3).fill("HeaderDark"), 22);
  addProjectBars(sheet, [...(report.projects ?? [])].sort((a, b) => b.doneTasks - a.doneTasks || a.projectName.localeCompare(b.projectName, "it")), (project) => project.doneTasks);
  return sheet;
}

function portfolioPeople(report) {
  const sheet = makeSheet("Persone", [28, 24, 24, 14, 18, 14, 18, 14]);
  sheet.freezeRow = 2;
  addRow(sheet, ["Carico per persona"], ["Title"], 30);
  sheet.mergedCells.push("A1:H1");
  addRow(sheet, ["Persona", "Ruolo", "Azienda", "Da fare", "Presa in carico", "Fatti", "Fatti settimana", "Totale"], Array(8).fill("HeaderBlue"), 22);
  for (const person of [...(report.people ?? [])].sort((a, b) => (b.todoCount + b.doingCount + b.doneCount) - (a.todoCount + a.doingCount + a.doneCount))) addRow(sheet, [person.displayName, person.role, person.company, person.todoCount, person.doingCount, person.doneCount, person.completedThisWeek, person.todoCount + person.doingCount + person.doneCount], ["Card", "Card", "Card", "Number", "Number", "Number", "Number", "Number"]);
  return sheet;
}

function portfolioRisks(report) {
  const sheet = makeSheet("Rischi", [28, 34, 20, 16, 28, 18, 18]);
  sheet.freezeRow = 2;
  addRow(sheet, ["Scadenze e rischi"], ["Title"], 30);
  sheet.mergedCells.push("A1:G1");
  addRow(sheet, ["Progetto", "Task", "Stato", "Priorita", "Persone", "Scadenza", "Segnale"], Array(7).fill("HeaderBlue"), 22);
  for (const task of report.risks ?? []) {
    const style = task.isOverdue ? "Risk" : "Warning";
    addRow(sheet, [task.projectName, task.title, task.statusLabel, task.priorityLabel, task.assignees, formatDate(task.dueDate), task.isOverdue ? "Scaduto" : "Entro 7 giorni"], Array(7).fill(style));
  }
  if (!(report.risks ?? []).length) {
    addRow(sheet, ["Nessun rischio rilevato."], ["Muted"]);
    sheet.mergedCells.push("A3:G3");
  }
  return sheet;
}

export function portfolioWorkbookSheets(report) {
  return [portfolioDashboard(report), portfolioProjectSummary(report), portfolioCurrentWeek(report), portfolioEffort(report), portfolioPeople(report), portfolioRisks(report)];
}

export function downloadXlsx(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
