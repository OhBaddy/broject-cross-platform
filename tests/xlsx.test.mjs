import test from "node:test";
import assert from "node:assert/strict";
import { createXlsxWorkbook, projectWorkbookSheets, portfolioWorkbookSheets } from "../src/core/xlsx.mjs";

test("xlsx writer creates a zip workbook with readable sheet names and cells", async () => {
  const bytes = await createXlsxWorkbook([{ name: "Dashboard", rows: [["Titolo", "Valore"], ["Progetto", "Alpha"]] }]);
  const text = new TextDecoder().decode(bytes);

  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  assert.match(text, /xl\/workbook\.xml/);
  assert.match(text, /Dashboard/);
  assert.match(text, /Progetto/);
  assert.match(text, /Alpha/);
});

test("project workbook keeps existing sheet contract and task grouping", async () => {
  const report = {
    project: { name: "Alpha", description: "Descrizione" },
    metrics: { totalTasks: 1, todoTasks: 1, doingTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, completionRate: 0 },
    people: [],
    tasks: [{ title: "Kickoff", notes: "Agenda", conclusions: "", status: "Todo", statusLabel: "Da fare", priorityLabel: "Alta", tags: "planning", assigneeName: "Non assegnato", assigneeRole: "", assigneeCompany: "", dueDate: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", isOverdue: false, isDueSoon: false }],
    finalNotes: "Nota"
  };
  const sheets = projectWorkbookSheets(report);

  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Dashboard", "Anagrafica", "Persone", "Kanban", "Task Da Fare", "Task Presa in carico", "Task Fatti", "Note Finali"]);
  assert.equal(sheets.find((sheet) => sheet.name === "Task Da Fare").rows.some((row) => row.includes("Kickoff")), true);
});

test("portfolio workbook keeps executive and risk sheets", () => {
  const sheets = portfolioWorkbookSheets({
    metrics: { totalProjects: 1, activeProjects: 1, totalTasks: 1, todoTasks: 1, doingTasks: 0, doneTasks: 0, completedThisWeek: 0, overdueTasks: 0, dueSoonTasks: 0 },
    projects: [{ projectName: "Alpha", totalTasks: 1, todoTasks: 1, doingTasks: 0, doneTasks: 0, completedThisWeek: 0, overdueTasks: 0, dueSoonTasks: 0 }],
    completedThisWeek: [],
    people: [],
    risks: []
  });

  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Executive Dashboard", "Riepilogo Progetti", "Settimana Corrente", "Sforzo Progetti", "Persone", "Rischi"]);
});

test("report workbooks preserve the WPF dashboard sections and empty-state copy", () => {
  const projectSheets = projectWorkbookSheets({
    project: { name: "Alpha", description: "Descrizione" },
    metrics: { totalTasks: 0, todoTasks: 0, doingTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, completionRate: 0 },
    people: [],
    tasks: [],
    finalNotes: "Nessuna nota finale inserita."
  });
  const dashboard = projectSheets.find((sheet) => sheet.name === "Dashboard");
  const taskList = projectSheets.find((sheet) => sheet.name === "Task Da Fare");
  assert.equal(dashboard.rows.some((row) => row.includes("Carico per persona")), true);
  assert.equal(taskList.rows.some((row) => row.includes("Nessun task in questa sezione.")), true);
  assert.deepEqual(dashboard.mergedCells.slice(0, 2), ["B1:L1", "B2:L2"]);

  const portfolioSheets = portfolioWorkbookSheets({
    metrics: { totalProjects: 0, activeProjects: 0, totalTasks: 0, todoTasks: 0, doingTasks: 0, doneTasks: 0, completedThisWeek: 0, overdueTasks: 0, dueSoonTasks: 0 },
    projects: [],
    completedThisWeek: [],
    people: [],
    risks: [],
    weekStart: new Date("2026-01-05"),
    weekEnd: new Date("2026-01-11"),
    exportedAt: new Date("2026-01-05T10:00:00Z")
  });
  const summary = portfolioSheets.find((sheet) => sheet.name === "Riepilogo Progetti");
  const currentWeek = portfolioSheets.find((sheet) => sheet.name === "Settimana Corrente");
  assert.equal(summary.rows[1].includes("Aperti"), true);
  assert.equal(summary.rows[1].includes("Completamento"), true);
  assert.equal(currentWeek.rows.some((row) => row.includes("Nessuna task completata nella settimana corrente.")), true);
});

test("xlsx writer emits numeric cells, merged regions and frozen rows", () => {
  const bytes = createXlsxWorkbook([{ name: "Sheet", rows: [["Titolo", 3]], mergedCells: ["A1:B1"], freezeRow: 1 }]);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /<pane ySplit="1"/);
  assert.match(text, /<mergeCell ref="A1:B1"\/>/);
  assert.match(text, /<v>3<\/v>/);
});

test("xlsx theme uses high-contrast semantic colors and visible borders", () => {
  const bytes = createXlsxWorkbook([{
    name: "Theme",
    rows: [["Header", "Status"], ["Done", "Risk"]],
    cellStyles: [["HeaderBlue", "HeaderDark"], ["Done", "Risk"]]
  }]);
  const text = new TextDecoder().decode(bytes);

  assert.match(text, /FF1E40AF/);
  assert.match(text, /FF047857/);
  assert.match(text, /FFB91C1C/);
  assert.match(text, /<font><b\/><sz val="11"\/><name val="Calibri"\/><color rgb="FFFFFFFF"\/><\/font>/);
  assert.match(text, /<borders count="[2-9]/);
  assert.match(text, /<border><left style="thin"><color rgb="FFCBD5E1"\/><\/left>/);
});

test("xlsx date-only cells keep the local calendar day", () => {
  const sheets = projectWorkbookSheets({
    project: { name: "Alpha", description: "" },
    metrics: { totalTasks: 1, todoTasks: 1, doingTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, completionRate: 0 },
    people: [],
    tasks: [{
      title: "Date only",
      status: "Todo",
      statusLabel: "Da fare",
      priorityLabel: "Media",
      tags: "",
      notes: "",
      conclusions: "",
      assigneeName: "Non assegnato",
      assigneeRole: "",
      assigneeCompany: "",
      dueDate: "2026-09-08",
      createdAt: "2026-09-08",
      updatedAt: "2026-09-08",
      isOverdue: false,
      isDueSoon: true
    }],
    finalNotes: ""
  });
  const taskSheet = sheets.find((sheet) => sheet.name === "Task Da Fare");
  assert.equal(taskSheet.rows.some((row) => row.includes("08/09/2026")), true);
});
