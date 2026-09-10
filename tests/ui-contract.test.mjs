import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceDirectory = new URL("../src/", import.meta.url);

test("native Tauri bootstrap does not require browser localStorage", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const nativeInvokeIndex = app.indexOf("const nativeInvoke = getGlobalNativeInvoke(globalThis);");
  const fallbackStoreIndex = app.indexOf('const fallbackStore = nativeInvoke ? null : new WorkspaceStore(globalThis.localStorage, "broject");');

  assert.ok(nativeInvokeIndex >= 0, "native invoke detection should remain explicit");
  assert.ok(fallbackStoreIndex > nativeInvokeIndex, "browser fallback storage must be created after native detection");
  assert.match(app, /const nativeBridge = createNativeBridge\(nativeInvoke, fallbackStore\);/);
});

test("project selection falls back to the WPF first project by name", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /function firstProjectByName\(projects\)/);
  assert.match(app, /let selectedProjectId = firstProjectByName\(state\.projects\)\?\.id \?\? null;/);
  const quickCreate = app.slice(app.indexOf("function openQuickCreateTask"), app.indexOf("function openTaskDrawer"));
  const openDrawer = app.slice(app.indexOf("function openTaskDrawer"), app.indexOf("function renderAssigneeOptions"));
  const deleteProject = app.slice(app.indexOf("async function deleteProject"), app.indexOf("function openPersonDialog"));
  assert.match(quickCreate, /firstProjectByName\(state\.projects\)\?\.id/);
  assert.match(openDrawer, /firstProjectByName\(state\.projects\)/);
  assert.match(deleteProject, /selectedProjectId = firstProjectByName\(state\.projects\)\?\.id \?\? null;/);
});

test("desktop document and Tauri window keep the WPF title", async () => {
  const [html, tauriConfig] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8")
  ]);
  const expectedTitle = "Broject — il lavoro, finalmente chiaro";

  assert.match(html, new RegExp(`<title>${expectedTitle}</title>`));
  assert.match(tauriConfig, new RegExp(`"title": "${expectedTitle}"`));
});

test("project surface keeps the WPF project actions and overview status distribution", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="exportProjectHeaderButton"/);
  assert.match(html, /id="editProjectButton"/);
  assert.match(html, /id="deleteProjectHeaderButton"/);
  assert.match(html, /id="projectProgressBar"/);
  assert.match(html, /id="statusSummaryList"/);
  assert.match(app, /exportProjectHeaderButton/);
  assert.match(app, /deleteProjectHeaderButton/);
  assert.match(app, /projectProgressBar.*style\.width/s);
  assert.match(app, /\$\("projectProgressText"\)\.textContent = `\$\{percentage\}% completato`/);
  assert.match(app, /statusSummaryList/);
  assert.match(app, /projectDialog.*addEventListener\("close"/s);
  assert.match(app, /personDialog.*addEventListener\("close"/s);
  assert.match(app, /function openQuickCreateTask\(/);
  const saveTask = app.slice(app.indexOf("async function saveTask"), app.indexOf("async function moveTask"));
  assert.doesNotMatch(saveTask, /activeSection = "project"/);
  const closeDrawer = app.slice(app.indexOf("function closeTaskDrawer"), app.indexOf("function rememberDialogFocus"));
  assert.match(closeDrawer, /offsetParent !== null/);
  assert.match(app, /function openProjectExportNotes\(project/);
  assert.match(app, /exportProjectHeaderButton.*projectById\(selectedProjectId\)/s);
  assert.match(app, /function openHelpDialog\(/);
  assert.match(app, /reportNotesDialog.*addEventListener\("close"/s);
  assert.match(app, /helpDialog.*addEventListener\("close"/s);
  assert.match(app, /function requestDialogCloseConfirmation\(/);
  assert.match(app, /projectDialogBaseline/);
  assert.match(app, /personDialogBaseline/);
  assert.match(app, /projectName.*select\(\)/s);
  assert.match(app, /personFirstName.*select\(\)/s);
  assert.match(app, /reportNotes.*select\(\)/s);
});

test("sidebar project rows keep the WPF separate open-count badge", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /class="project-nav-count"[^>]*>\$\{openCount\}</);
  assert.match(app, /aria-label="\$\{openCount\} attività aperte"/);
  assert.doesNotMatch(app, /class="project-nav-meta"/);
});

test("project surface keeps WPF empty-state copy and task ordering", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /Nessuna attività da fare\. Usa Aggiungi attività per iniziare\./);
  assert.match(app, /sortProjectTasks/);
  assert.match(app, /Aggiungi una descrizione per dare contesto al team\./);
  assert.match(app, /Questo progetto non ha ancora attività\. Usa Aggiungi attività per iniziare\./);
  assert.match(app, /Nessuna attività corrisponde ai filtri\. Usa Azzera filtri per rivederle\./);
});

test("empty WPF list state hides the task table", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);
  const projectRender = app.slice(app.indexOf("function renderProject"), app.indexOf("function renderCalendar"));

  assert.match(html, /<table class="task-table" id="tasksTable" aria-label="Attività del progetto">/);
  assert.match(projectRender, /\$\("tasksTable"\)\.classList\.toggle\("is-hidden", visible\.length === 0\)/);
});

test("project list table exposes the WPF automation name", async () => {
  const html = await readFile(new URL("index.html", sourceDirectory), "utf8");

  assert.match(html, /<table class="task-table" id="tasksTable" aria-label="Attività del progetto">/);
});

test("project filter reset keeps the WPF visible disabled affordance", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);
  const projectRender = app.slice(app.indexOf("function renderProject"), app.indexOf("function renderCalendar"));

  assert.match(html, /class="text-button" id="resetFiltersButton"/);
  assert.match(projectRender, /\$\("resetFiltersButton"\)\.disabled = !Boolean\(projectSearch \|\| statusFilter \|\| personFilter\);/);
  assert.doesNotMatch(projectRender, /setVisible\("resetFiltersButton"/);
});

test("closing WPF search returns focus to the global search box", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const closeSearch = app.slice(app.indexOf('$("closeSearchButton")'), app.indexOf('$("quickCreateButton")'));

  assert.match(closeSearch, /\$\("globalSearch"\)\.focus\(\);/);
});

test("Escape closing WPF search returns focus to the global search box", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const keydown = app.slice(app.indexOf("function handleKeydown"), app.indexOf('document.addEventListener("click"'));
  const searchEscape = keydown.slice(keydown.indexOf('} else if (!$('), keydown.indexOf('if (event.key === "F1"'));

  assert.match(searchEscape, /\$\("globalSearch"\)\.focus\(\);/);
});

test("WPF undo refresh preserves an active global search", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const refreshAll = app.slice(app.indexOf("function refreshAll"), app.indexOf("function renderProjectNav"));
  const undoHandler = app.slice(app.indexOf('$("undoButton")'), app.indexOf("for (const list of $$(\".task-stack\")"));

  assert.match(refreshAll, /preserveSearch/);
  assert.match(refreshAll, /refreshSearch\(\)/);
  assert.match(undoHandler, /refreshAll\(\{ preserveSearch: true \}\)/);
});

test("task cards and calendar keep WPF status, priority and assignee presentation", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  const taskCard = app.slice(app.indexOf("function projectTaskCard"), app.indexOf("function personCardMarkup"));
  assert.match(taskCard, /task-status-bar/);
  assert.match(taskCard, /task-status-label/);
  assert.match(taskCard, /priority-badge/);
  assert.match(app, /function assigneeCompactLabel\(task\)/);
  assert.match(app, /calendar-task[^`]*assigneeCompactLabel\(task\)/s);
  const taskTable = app.slice(app.indexOf('$("tasksTableBody")'), app.indexOf('setVisible("listEmpty"'));
  assert.match(taskTable, /assigneeCompactLabel\(task\)/);
  assert.match(taskTable, /class="status-pill/);
  assert.match(taskTable, /class="priority-label/);
  assert.match(styles, /\.task-status-bar\.todo[^}]*#626A80/);
  assert.match(styles, /\.task-status-bar\.doing[^}]*#93600E/);
  assert.match(styles, /\.task-status-bar\.done[^}]*#08785F/);
  assert.match(styles, /\.calendar-task\.todo[^}]*#EFF0F4/);
  assert.match(styles, /\.calendar-task\.doing[^}]*#FFF3DA/);
  assert.match(styles, /\.calendar-task\.done[^}]*#E3F5EF/);
});

test("task and week navigation keep the WPF text controls", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);
  const taskCard = app.slice(app.indexOf("function projectTaskCard"), app.indexOf("function personCardMarkup"));
  const calendarToolbar = html.slice(html.indexOf('class="calendar-toolbar"'), html.indexOf('id="calendarGrid"'));

  assert.match(taskCard, /aria-label="Sposta allo stato precedente"[^>]*>\s*<span class="wpf-chevron" aria-hidden="true">‹<\/span>/);
  assert.match(taskCard, /aria-label="Sposta allo stato successivo"[^>]*>\s*<span class="wpf-chevron" aria-hidden="true">›<\/span>/);
  assert.match(taskCard, /aria-label="Apri dettagli"[^>]*>Apri<\/button>/);
  assert.match(calendarToolbar, /class="icon-button calendar-nav-button" id="previousWeekButton"[^>]*>\s*<span class="wpf-chevron" aria-hidden="true">‹<\/span>/);
  assert.match(calendarToolbar, /class="icon-button calendar-nav-button" id="nextWeekButton"[^>]*>\s*<span class="wpf-chevron" aria-hidden="true">›<\/span>/);
  assert.match(styles, /\.task-card-actions \.micro-button\s*\{[^}]*width:\s*38px;[^}]*min-height:\s*38px/);
  assert.match(styles, /\.calendar-nav-button\s*\{[^}]*width:\s*38px;[^}]*height:\s*38px/);
});

test("WPF list headers, person action and close glyphs remain text-equivalent", async () => {
  const [html, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  assert.match(html, /<th>ATTIVITÀ<\/th><th>STATO<\/th><th>PERSONE<\/th><th>PRIORITÀ<\/th><th>SCADENZA<\/th>/);
  assert.match(html, /id="newProjectButton"[^>]*>\s*\+\s*<\/button>/);
  assert.match(html, /id="quickCreateButton"[^>]*>\s*\+\s*<\/button>/);
  assert.match(html, /id="helpButton"[^>]*>\s*\?\s*<\/button>/);
  assert.match(html, /id="addPersonButton"[^>]*>\+ Aggiungi persona<\/button>/);
  assert.match(html, /id="closeDrawerButton"[^>]*>×<\/button>/);
  assert.match(html, /id="projectDialog"[\s\S]*?aria-label="Chiudi">×<\/button>/);
  assert.match(html, /id="personDialog"[\s\S]*?aria-label="Chiudi">×<\/button>/);
  assert.match(html, /id="reportNotesDialog"[\s\S]*?aria-label="Chiudi">×<\/button>/);
  assert.match(styles, /#newProjectButton\s*\{[^}]*font-size:\s*18px/);
  assert.match(styles, /\.create-button\s*\{[^}]*font-size:\s*19px/);
});

test("shell dimensions and mutation feedback keep the WPF contract", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  assert.match(styles, /\.app-shell \{[^}]*grid-template-columns: 220px minmax\(0, 1fr\)/s);
  assert.match(styles, /\.topbar \{[^}]*min-height: 68px/s);
  assert.match(styles, /\.content-scroller \{[^}]*calc\(100vh - 68px\)/s);
  const saveTask = app.slice(app.indexOf("async function saveTask"), app.indexOf("async function moveTask"));
  assert.match(saveTask, /Salvataggio non riuscito\. I campi restano qui: correggi il problema e riprova\./);
  assert.match(saveTask, /showToast\(isEditing \? "Attività aggiornata" : "Attività aggiunta", "Il workspace è stato salvato automaticamente\."\)/);
  const deleteTask = app.slice(app.indexOf("async function deleteTask"), app.indexOf("function openProjectDialog"));
  assert.match(deleteTask, /Eliminare l’attività “\$\{task\.title\}”\?/);
  assert.match(deleteTask, /showToast\("Attività eliminata", `“\$\{task\.title\}” è stata rimossa\.`\)/);
  const saveProject = app.slice(app.indexOf("async function saveProject"), app.indexOf("async function deleteProject"));
  assert.match(saveProject, /showToast\(editingProjectId \? "Progetto aggiornato" : "Progetto creato", editingProjectId \? "Nome e descrizione sono stati salvati\." : `“\$\{project\.name\}” è pronto per essere pianificato\.`\)/);
  assert.match(app, /function saveReportFile\(bytes, fileName, dialogTitle/);
  assert.match(app, /saveReportFile\(createXlsxWorkbook\(portfolioWorkbookSheets\(report\)\), fileName, "Esporta report generale"\)/);
  assert.match(app, /saveReportFile\(createXlsxWorkbook\(projectWorkbookSheets\(report\)\), fileName, "Esporta report progetto"\)/);
});

test("deleting a task restores WPF add-task focus after rerender", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const deleteTask = app.slice(app.indexOf("async function deleteTask"), app.indexOf("function openProjectDialog"));

  assert.match(deleteTask, /closeTaskDrawer\(\);\s*refreshAll\(\);\s*\$\("addTaskButton"\)\?\.focus\(\);/);
});

test("quick create and task editor keep the WPF no-project paths", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /function showNoProjectNotice\(\)/);
  assert.match(app, /Crea o seleziona un progetto prima di aggiungere un’attività\./);
  const quickCreate = app.slice(app.indexOf("function openQuickCreateTask"), app.indexOf("function openTaskDrawer"));
  const openDrawer = app.slice(app.indexOf("function openTaskDrawer"), app.indexOf("function renderAssigneeOptions"));
  assert.match(quickCreate, /!state\.projects\.length\)\s*\{\s*openProjectDialog\(\);\s*return;/s);
  assert.match(openDrawer, /!state\.projects\.length\)\s*\{\s*showNoProjectNotice\(\);\s*return;/s);
});

test("dashboard and project labels keep WPF parity", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="overviewHintText"/);
  assert.match(html, /id="overviewGreetingText">Il lavoro di oggi<\/h2>/);
  assert.match(html, /id="overviewHintText">Parti dalle priorità\. Il resto è qui quando serve\.<\/p>/);
  assert.match(html, /id="pageSubtitle">Priorità e avanzamento<\/p>/);
  assert.match(html, /id="projectStatusText"/);
  assert.match(html, /id="overviewNewProjectButton"/);
  assert.match(html, />Bacheca</);
  assert.match(html, />Elenco</);
  assert.match(html, />Settimana</);
  assert.match(html, /placeholder="Cerca task\.\.\."/);
  assert.match(html, /id="projectSearch"[^>]*aria-label="Cerca attività nel progetto"/);
  assert.match(html, /\+ Aggiungi attività/);
  assert.match(html, /id="myWorkKpis"/);
  assert.match(html, />Attività recente</);
  assert.doesNotMatch(html, /Completate questa settimana<\/h3><p>Il lavoro che ha fatto avanzare il workspace<\/p>/);
  assert.doesNotMatch(html, /id="calendarRangeText"><\/strong><span>Settimana di lavoro<\/span>/);
  const calendarToolbar = html.slice(html.indexOf('class="calendar-toolbar"'), html.indexOf('id="calendarGrid"'));
  assert.match(calendarToolbar, /previousWeekButton.*nextWeekButton.*calendarRangeText.*currentWeekButton/s);
  assert.match(calendarToolbar, /id="previousWeekButton"[^>]*aria-label="Vai alla settimana precedente"/);
  assert.match(calendarToolbar, /id="nextWeekButton"[^>]*aria-label="Vai alla settimana successiva"/);
  assert.match(html, /id="editorState"[^>]*aria-live="polite"/);
  assert.match(app, /function calendarDayLabel\(value\)/);
  assert.match(app, /calendarDayLabel\(day\)/);
  const styles = await readFile(new URL("styles.css", sourceDirectory), "utf8");
  assert.doesNotMatch(styles, /\.calendar-day-header span \{[^}]*text-transform: uppercase/);
  assert.match(html, /id="myDoingEmpty">Nessuna attività in corso\. Sposta qui un’attività quando inizi\.<\/div>/);
  assert.match(app, /overviewFocusTasks/);
  assert.match(app, /overviewHint/);
  assert.match(app, /overview: \["Panoramica", "Priorità e avanzamento"\]/);
  assert.match(app, /"my-work": \["Il mio lavoro", "Priorità trasversali"\]/);
  assert.match(app, /reports: \["Report", "Report Excel"\]/);
  assert.match(app, /sortOverviewProjects/);
  assert.match(app, /myWorkSnapshot/);
  assert.match(app, /projectStatus/);
  assert.match(app, /overviewNewProjectButton.*openProjectDialog/s);
  assert.match(app, /const colors = \["#6C5CE7", "#08785F", "#2465BF", "#E14D72", "#93600E", "#8B5CF6", "#126A96", "#A124AF"\]/);
  assert.match(app, /\$\("weekRangeText"\)\.textContent = formatDateRange\(weekStart, weekEnd\)/);
  assert.doesNotMatch(app, /\$\("weekRangeText"\)\.textContent = `Settimana \$\{formatDateRange/);
  assert.match(app, /return `\$\{formatDate\(start\)\} — \$\{formatDate\(end, \{ year: "numeric" \}\)\}`/);
});

test("filters, report selector and export progress expose WPF automation names", async () => {
  const html = await readFile(new URL("index.html", sourceDirectory), "utf8");

  assert.match(html, /id="statusFilter"[^>]*aria-label="Filtra per stato"/);
  assert.match(html, /id="personFilter"[^>]*aria-label="Filtra per persona"/);
  assert.match(html, /id="reportProjectSelect"[^>]*aria-label="Progetto da esportare"/);
  assert.match(html, /class="spinner"[^>]*role="progressbar"[^>]*aria-label="Esportazione in corso"/);
});

test("undo action keeps the WPF recovery tooltip", async () => {
  const html = await readFile(new URL("index.html", sourceDirectory), "utf8");

  assert.match(html, /id="undoButton"[^>]*title="Ripristina l’ultima eliminazione di questa sessione"/);
});

test("primary action tooltips keep the WPF copy", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="globalSearch"[^>]*title="Cerca attività, progetti o persone \(Ctrl\+K\)"/);
  assert.match(html, /id="quickCreateButton"[^>]*title="Crea"/);
  assert.match(html, /id="saveTaskButton"[^>]*title="Salva \(Ctrl\+S\)"/);
  assert.match(app, /data-action="edit-person"[^>]*title="Modifica persona"/);
});

test("literal WPF automation names and tooltips remain represented in the replica", async () => {
  const [wpf, html, app] = await Promise.all([
    readFile(new URL("../../src/Broject.App/MainWindow.xaml", import.meta.url), "utf8"),
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);
  const replica = `${html}\n${app}`;
  const literals = [...wpf.matchAll(/(?:AutomationProperties\.Name|ToolTip)="([^"{]+)"/g)]
    .map((match) => match[1]);

  assert.ok(literals.length > 0, "the WPF source must expose literal accessibility contracts");
  for (const value of new Set(literals)) {
    assert.ok(replica.includes(value), `replica is missing WPF accessibility/tooltip copy: ${value}`);
  }
});

test("Tauri close requests keep the WPF window guard", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /__TAURI__\?\.window\?\.getCurrentWindow/);
  assert.match(app, /onCloseRequested/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /destroy\(\)/);
  assert.match(app, /Attendi la fine dell’esportazione prima di chiudere\./);
  assert.match(app, /requestTauriCloseDecision/);
  assert.match(app, /void installTauriCloseGuard\(\)/);
});

test("task editor keeps WPF unsaved-change flow and live state", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="unsavedTaskDialog"/);
  assert.match(html, /data-unsaved-choice="save"/);
  assert.match(html, /data-unsaved-choice="discard"/);
  assert.match(html, /data-unsaved-choice="cancel"/);
  assert.match(app, /Modifiche non salvate · Ctrl\+S per salvare/);
  assert.match(app, /function refreshEditorState\(/);
  assert.match(app, /pendingEditorClose/);
  assert.doesNotMatch(app, /confirm\("Hai modifiche non salvate/);
});

test("WPF destructive actions and report opening use the internal confirmation surface", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /<dialog class="modal action-confirm-dialog" id="actionConfirmDialog"/);
  assert.match(html, /aria-labelledby="actionConfirmDialogTitle"/);
  assert.match(html, /aria-describedby="actionConfirmDialogMessage"/);
  assert.match(html, /data-confirm-choice="cancel"[^>]*autofocus/);
  assert.match(html, /data-confirm-choice="confirm"/);
  assert.match(app, /function requestActionConfirmation\(/);
  assert.match(app, /function resolveActionConfirmation\(/);
  assert.match(app, /actionConfirmDialog.*addEventListener\("cancel"/s);

  for (const functionName of ["deleteTask", "deleteProject", "deletePerson"]) {
    const start = app.indexOf(`async function ${functionName}`);
    const end = app.indexOf("\n}\n", start) + 3;
    const implementation = app.slice(start, end);
    assert.match(implementation, /await requestActionConfirmation\(/, `${functionName} should use the internal confirmation`);
    assert.doesNotMatch(implementation, /\bconfirm\(/, `${functionName} should not use browser confirm`);
  }

  const saveReport = app.slice(app.indexOf("async function saveReportFile"), app.indexOf("function setExportBusy"));
  assert.match(saveReport, /await requestActionConfirmation\(/);
  assert.doesNotMatch(saveReport, /globalThis\.confirm\(/);
});

test("action confirmation Escape is handled by the modal before the drawer guard", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const keydown = app.slice(app.indexOf("function handleKeydown"), app.indexOf("document.addEventListener(\"click\""));

  assert.match(keydown, /\$\("unsavedTaskDialog"\)\?\.open\) return;/);
  assert.match(keydown, /\$\("actionConfirmDialog"\)\?\.open\) return;/);
});

test("saving from the unsaved-change dialog uses the WPF task validation path", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const resolveEditorClose = app.slice(app.indexOf("async function resolveEditorClose"), app.indexOf("function closeTaskDrawer"));

  assert.doesNotMatch(resolveEditorClose, /reportValidity/);
  assert.match(resolveEditorClose, /const saved = await saveTask\(\)/);
});

test("save forms route required fields through WPF validation copy", async () => {
  const html = await readFile(new URL("index.html", sourceDirectory), "utf8");

  for (const formId of ["taskForm", "projectForm", "personForm"]) {
    assert.match(html, new RegExp(`<form[^>]*id="${formId}"[^>]*novalidate`));
  }
});

test("task drawer exposes the WPF automation names", async () => {
  const html = await readFile(new URL("index.html", sourceDirectory), "utf8");

  assert.match(html, /id="taskTitle"[^>]*aria-label="Titolo attività, obbligatorio"/);
  assert.match(html, /id="taskProject"[^>]*aria-label="Progetto dell’attività"/);
  assert.match(html, /id="taskStatus"[^>]*aria-label="Stato attività"/);
  assert.match(html, /id="taskPriority"[^>]*aria-label="Priorità attività"/);
  assert.match(html, /id="taskDueDate"[^>]*aria-label="Scadenza, facoltativa"/);
  assert.match(html, /id="assigneePicker"[^>]*aria-label="Mostra o nascondi le persone assegnabili"/);
  assert.match(html, /id="taskNotes"[^>]*aria-label="Note attività"/);
  assert.match(html, /id="taskTags"[^>]*aria-label="Tag separati da virgole"/);
  assert.match(html, /id="taskConclusions"[^>]*aria-label="Conclusioni attività"/);
});

test("task navigation keeps the WPF unsaved-change confirmation", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /function openProject\(projectId\)/);
  const openTaskDrawer = app.slice(app.indexOf("function openTaskDrawer"), app.indexOf("function renderAssigneeOptions"));
  assert.match(openTaskDrawer, /confirmCloseEditor\(\(\) => openTaskDrawer\(task\)\)/);
  assert.match(app, /openProject\(id\)/);
});

test("search and task date editor keep WPF surfaces", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="searchTasksHeading"/);
  assert.match(html, /id="searchProjectsHeading"/);
  assert.match(html, /id="searchPeopleHeading"/);
  assert.match(html, /class="people-grid" id="searchPersonItems"/);
  assert.match(html, /id="taskDueDate"[^>]*type="text"[^>]*placeholder="gg\/mm\/aaaa"/);
  assert.match(app, /parseItalianDate/);
  assert.match(app, /formatItalianDate/);
  assert.match(app, /setVisible\("searchTasksHeading", result\.tasks\.length > 0\)/);
  assert.match(app, /setVisible\("searchProjectsHeading", result\.projects\.length > 0\)/);
  assert.match(app, /setVisible\("searchPeopleHeading", result\.people\.length > 0\)/);
  assert.match(app, /peopleSearchSnapshot\(result\.people, state\.tasks\)/);
  assert.match(app, /personDetails\(person\) \|\| \(fallbackDetails \? "Nessun ruolo specificato" : ""\)/);
  assert.match(app, /peopleRows\.map\(\(row, index\) => personCardMarkup\(row, index, false\)\)/);
  assert.match(app, /function personAssignmentLabel\(person\)/);
  assert.match(app, /function sortPeopleByName\(people\)/);
  const assigneeRenderer = app.slice(app.indexOf("function renderAssigneeOptions"), app.indexOf("function refreshAssigneeSummary"));
  assert.match(assigneeRenderer, /personAssignmentLabel\(person\)/);
  assert.match(app, /completedSummaryLabel\(task\.completedAt\)/);
  assert.match(app, /relativeTime\(task\.updatedAt \|\| task\.createdAt\)/);
  assert.match(app, /new Date\(task\.completedAt\) < addDays\(weekEnd, 1\)/);
  assert.match(app, /statusLabels\[task\.status\]\)\}\$\{taskProject\(task\) \? ` · \$\{escapeHtml\(taskProject\(task\)\.name\)\}` : ""\}<\/strong><span>\$\{escapeHtml\(relativeTime/);
  assert.match(app, /class="summary-task-item"/);
  const weeklySummary = app.slice(app.indexOf('$("weeklySummaryList")'), app.indexOf('setVisible("weeklyEmpty"'));
  assert.doesNotMatch(weeklySummary, /data-action="open-task"/);
});

test("task save date validation keeps the exact WPF error copy", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const saveTask = app.slice(app.indexOf("async function saveTask"), app.indexOf("async function moveTask"));

  assert.match(saveTask, /La scadenza non è valida\. Usa gg\/mm\/aaaa oppure lascia il campo vuoto\./);
});

test("task date blur keeps the WPF DateValidationError copy", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /\$\("taskDueDate"\)\.addEventListener\("blur"/);
  assert.match(app, /La scadenza ‘\$\{dueDateText\}’ non è valida\. Usa gg\/mm\/aaaa oppure cancella il campo\./);
});

test("dialogs, help and reports keep WPF copy and affordances", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  const projectDialog = html.slice(html.indexOf('<dialog class="modal" id="projectDialog"'), html.indexOf('<dialog class="modal" id="personDialog"'));
  assert.match(projectDialog, /Definisci il nome e aggiungi una descrizione facoltativa\./);
  assert.match(projectDialog, /Nome progetto \(obbligatorio\)/);
  assert.match(projectDialog, /id="projectName"[^>]*aria-label="Nome progetto"/);
  assert.match(projectDialog, /Descrizione \(facoltativa\)/);
  assert.match(projectDialog, /id="projectDescriptionInput"[^>]*aria-label="Descrizione facoltativa"/);
  assert.doesNotMatch(projectDialog, /deleteProjectButton/);
  assert.match(html, /Ruolo e azienda aiutano a leggere assegnazioni e report\./);
  assert.match(html, /Sintesi, decisioni e prossimi passi/);
  assert.match(html, /id="reportNotes"[^>]*aria-label="Note finali del report, facoltative"/);
  assert.match(html, /Continua con l’export/);
  assert.match(html, /Le modifiche confermate sono salvate sul dispositivo\./);
  assert.match(html, /Crea un progetto dalla barra laterale/);
  assert.match(html, /Tutto in un workbook Excel professionale\./);
  assert.match(html, /Gli export \.xlsx si aprono in Excel e LibreOffice e non richiedono componenti cloud\./);
  assert.match(app, /person \? "Modifica persona" : "Nuova persona"/);
  assert.match(app, /savePersonButton.*Aggiungi persona/s);
  assert.match(app, /Crea un progetto per esportarne il report\./);
  assert.match(app, /function reportFileDate\(/);
});

test("WPF dialog widths are preserved while content heights stay proportional", async () => {
  const styles = await readFile(new URL("styles.css", sourceDirectory), "utf8");

  assert.match(styles, /#projectDialog\s*\{[^}]*width:\s*min\(540px/);
  assert.match(styles, /#personDialog\s*\{[^}]*width:\s*min\(580px/);
  assert.match(styles, /#reportNotesDialog\s*\{[^}]*width:\s*min\(620px/);
  assert.doesNotMatch(styles, /#projectDialog\s*\{[^}]*min-height:/);
  assert.doesNotMatch(styles, /#personDialog\s*\{[^}]*min-height:/);
  assert.doesNotMatch(styles, /#reportNotesDialog\s*\{[^}]*min-height:/);
});

test("project views keep compact task stacks and a non-clipped responsive week grid", async () => {
  const styles = await readFile(new URL("styles.css", sourceDirectory), "utf8");

  assert.match(styles, /\.task-stack\s*\{[^}]*align-content:\s*start/);
  assert.match(styles, /\.task-stack\s*\{[^}]*grid-auto-rows:\s*max-content/);
  assert.match(styles, /\.calendar-grid\s*\{[^}]*minmax\(150px/);
});

test("calendar scroll guidance stays visible above the horizontal grid", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);
  const calendarFrame = html.slice(html.indexOf('class="calendar-scroll-frame"'), html.indexOf('id="myWorkView"'));

  assert.match(calendarFrame, /calendarScrollHint[\s\S]*calendarGrid/);
  assert.match(app, /function updateCalendarScrollAffordance\(/);
  assert.match(styles, /\.calendar-scroll-hint\s*\{[^}]*min-height:\s*13px;[^}]*margin:\s*0 2px 7px/);
  assert.match(styles, /\.calendar-scroll-frame\.has-more-right::after\s*\{[^}]*top:\s*26px/);
});

test("help dialog exposes the complete usage guide and shortcut reference", async () => {
  const [wpf, html] = await Promise.all([
    readFile(new URL("../../src/Broject.App/MainWindow.xaml.cs", import.meta.url), "utf8"),
    readFile(new URL("index.html", sourceDirectory), "utf8")
  ]);
  const helpHandler = wpf.slice(wpf.indexOf("private void ShowHelp_Click"), wpf.indexOf("private bool EditorIsOpen"));
  const helpDialog = html.slice(html.indexOf('<dialog class="modal help-modal"'), html.indexOf('<dialog class="modal" id="unsavedTaskDialog"'));

  assert.match(helpHandler, /Le modifiche confermate sono salvate sul dispositivo/);
  assert.match(helpDialog, /Guida all’utilizzo/);
  assert.match(helpDialog, /Navigazione/);
  assert.match(helpDialog, /Attività/);
  assert.match(helpDialog, /Report Excel/);
  assert.match(helpDialog, /Scorciatoie/);
  assert.match(helpDialog, /class="help-list"/);
  assert.match(helpDialog, /Ctrl\+K/);
  assert.match(helpDialog, /aria-label="Chiudi guida"/);
});

test("global shortcuts cover navigation, project views and help without hijacking text entry", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const keydown = app.slice(app.indexOf("function handleKeydown"), app.indexOf('document.addEventListener("click"'));

  assert.match(app, /function isTextEntryTarget\(/);
  assert.match(keydown, /event\.key === "\?"/);
  assert.match(keydown, /event\.key\.toLowerCase\(\) === "b"/);
  assert.match(keydown, /event\.key\.toLowerCase\(\) === "l"/);
  assert.match(keydown, /event\.key\.toLowerCase\(\) === "w"/);
  assert.match(keydown, /event\.key === "1"/);
  assert.match(keydown, /event\.key === "2"/);
  assert.match(keydown, /event\.key === "3"/);
  assert.match(keydown, /event\.key === "4"/);
  assert.match(keydown, /isTextEntryTarget\(target\)/);
  assert.match(keydown, /event\.shiftKey/);
});

test("person and undo feedback keep the exact WPF copy", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /showToast\(editingPersonId \? "Persona aggiornata" : "Persona aggiunta", "Il team è stato aggiornato\."\)/);
  assert.match(app, /showToast\("Eliminazione annullata", "Gli elementi e le assegnazioni disponibili sono stati ripristinati\."\)/);
});

test("report failure and open-error feedback keep the exact WPF copy", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /showToast\("Report non esportato", `Esportazione non riuscita\. Controlla che il file non sia aperto e che la cartella sia scrivibile, poi riprova\.\\n\\n\$\{error\.message\}`\)/);
  assert.match(app, /showToast\("Report salvato", `Il report è stato salvato in:\\n\$\{result\.path\}\\n\\nNon è stato possibile aprirlo automaticamente\. \$\{error\.message\}`\)/);
});

test("report file names preserve the WPF SafeFileName rules", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const safeFileName = app.slice(app.indexOf("function safeFileName"), app.indexOf("function reportFileDate"));

  assert.match(safeFileName, /replace\(\/\[<>:"\/\\\\\|\?\*\\u0000-\\u001F\]\/g, "-"\)/);
  assert.match(safeFileName, /\|\| "Progetto"/);
  assert.doesNotMatch(safeFileName, /\\p\{L\}/);
});

test("person cards keep the WPF readable dimensions", async () => {
  const styles = await readFile(new URL("styles.css", sourceDirectory), "utf8");
  assert.match(styles, /\.person-card \.avatar \{[^}]*width: 42px; height: 42px;[^}]*font-size: 13px/);
  assert.match(styles, /\.person-copy p \{[^}]*font-size: 12px/);
  assert.match(styles, /\.person-edit \{[^}]*min-height: 38px/);
});

test("task assignees keep the WPF collapsed picker and Escape behavior", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /<details class="field assignee-field" id="assigneePicker" aria-label="Mostra o nascondi le persone assegnabili">/);
  assert.match(html, /class="assignee-label">Persone assegnate<\/span><details class="field assignee-field" id="assigneePicker" aria-label="Mostra o nascondi le persone assegnabili">/);
  assert.match(html, /class="assignee-select-label">Seleziona<\/span>/);
  assert.match(html, /id="taskAssigneesSummary"/);
  assert.match(app, /function renderAssigneeOptions\(/);
  assert.match(app, /function refreshAssigneeSummary\(/);
  assert.match(app, /taskAssigneesSummary/);
  assert.match(app, /taskAssignees.*addEventListener\("change"/s);
  assert.match(app, /assigneePicker.*open = false/s);
  assert.match(app, /assigneePicker.*querySelector\("summary"\).*focus/s);
});

test("task due date keeps the WPF DatePicker calendar affordance", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  assert.match(html, /class="date-picker-control"/);
  assert.match(html, /id="taskDueDateCalendarButton"[^>]*aria-label="Apri calendario scadenza"/);
  assert.match(html, /id="taskDueDateCalendar"[^>]*role="dialog"/);
  assert.match(app, /function renderDueDateCalendar\(/);
  assert.match(app, /function closeDueDateCalendar\(/);
  assert.match(app, /taskDueDateCalendarButton.*addEventListener\("click"/s);
  assert.match(app, /taskDueDateCalendar.*addEventListener\("click"/s);
  assert.match(styles, /\.date-picker-control\s*\{/);
  assert.match(styles, /\.date-picker-calendar\s*\{/);
});

test("project and person save failures keep the WPF recovery copy and live error semantics", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);
  const saveProject = app.slice(app.indexOf("async function saveProject"), app.indexOf("async function deleteProject"));
  const savePerson = app.slice(app.indexOf("async function savePerson"), app.indexOf("async function deletePerson"));

  assert.match(saveProject, /Salvataggio non riuscito\. I dati restano qui: \$\{error\.message\}/);
  assert.match(savePerson, /Salvataggio non riuscito\. I dati restano qui: \$\{error\.message\}/);
  assert.match(html, /id="projectError"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /id="personError"[^>]*role="alert"[^>]*aria-live="assertive"/);
});

test("KPI cards keep the WPF text-only template", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  assert.doesNotMatch(app, /class="kpi-icon"/);
  assert.doesNotMatch(html, /class="kpi-icon"/);
  assert.match(styles, /\.kpi-card\s*\{[^}]*min-height:\s*96px/);
  assert.doesNotMatch(styles, /\.kpi-card\s*\{[^}]*grid-template-columns:\s*40px/);
});

test("project progress exposes an accessible WPF progress value", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="projectProgressBar"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"[^>]*aria-valuenow="0"/);
  assert.match(app, /\$\("projectProgressBar"\)\.setAttribute\("aria-valuenow", String\(percentage\)\)/);
});

test("dirty project and person dialogs use an accessible internal confirmation", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="unsavedDialog"/);
  assert.match(html, /data-dialog-choice="discard"/);
  assert.match(html, /data-dialog-choice="cancel"/);
  assert.match(app, /requestDialogCloseConfirmation/);
  assert.doesNotMatch(app, /globalThis\.confirm\("Ci sono modifiche non salvate/);
});

test("report export falls back to a browser download when an OS dialog is unavailable", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /function nativeDialogUnavailable\(/);
  assert.match(app, /catch \(error\).*nativeDialogUnavailable\(error\).*downloadXlsx\(bytes, fileName\)/s);
});

test("window closing is guarded while an export is running", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /beforeunload/);
  assert.match(app, /Attendi la fine dell’esportazione prima di chiudere\./);
});

test("window closing is guarded with unsaved task editor changes", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /taskDrawer.*editorSnapshot\(\) !== editorBaseline/s);
  assert.match(app, /Vuoi salvare le modifiche prima di chiudere\?/);
});

test("window closing is guarded with unsaved project or person dialog changes", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /projectDialog\?\.open.*projectDialogSnapshot\(\) !== projectDialogBaseline/s);
  assert.match(app, /personDialog\?\.open.*personDialogSnapshot\(\) !== personDialogBaseline/s);
  assert.match(app, /Ci sono modifiche non salvate\. Vuoi uscire senza salvarle\?/);
});

test("Project and person dialog Escape closes keep the WPF dirty-close guard", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /\$\("projectDialog"\)\.addEventListener\("cancel", \(event\) => \{\s*event\.preventDefault\(\);\s*void requestDialogCloseConfirmation\("projectDialog"\)/s);
  assert.match(app, /\$\("personDialog"\)\.addEventListener\("cancel", \(event\) => \{\s*event\.preventDefault\(\);\s*void requestDialogCloseConfirmation\("personDialog"\)/s);
});

test("project list rows open only through WPF double-click or keyboard/action paths", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  assert.match(app, /function handleDoubleClick\(/);
  assert.match(app, /document\.addEventListener\("dblclick", handleDoubleClick\)/);
  assert.match(app, /taskRow.*event\.key === "Enter"/s);
});

test("export busy state blocks concurrent work and Ctrl+N", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="busyOverlay"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(app, /let exportInProgress = false;/);
  assert.match(app, /function setExportBusy\(busy\)/);
  assert.match(app, /\$\("appShell"\)\.inert = Boolean\(startupFailure\) \|\| busy/);
  assert.match(app, /\$\("appShell"\)\.setAttribute\("aria-busy", busy \? "true" : "false"\)/);
  assert.match(app, /if \(exportInProgress\) return false/);
  assert.match(app, /event\.key\.toLowerCase\(\) === "n".*!exportInProgress.*!hasOpenModal/s);
  assert.match(app, /event\.key === "F1".*!exportInProgress.*!hasOpenModal/s);
  assert.match(app, /function updateMutationControls\(/);
  assert.match(app, /exportReturnFocus/);
  assert.match(app, /previousWeekButton.*sortProjectTasks/s);
  assert.match(app, /deleteProjectHeaderButton/);
  const shellEnd = html.indexOf("\n    </div>\n\n    <div class=\"busy-overlay");
  const busyOverlay = html.indexOf("id=\"busyOverlay\"");
  assert.ok(shellEnd >= 0 && busyOverlay > shellEnd, "busy overlay must remain outside the inert app shell");
});

test("startup storage failure blocks the workspace and offers a safe retry", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="startupFailure"[^>]*role="alert"/);
  assert.match(html, /Avvio non riuscito/);
  assert.match(html, /I dati locali non sono stati modificati\./);
  assert.match(html, /id="retryStartupButton"/);
  assert.match(app, /const startupFailure = storageFailure;/);
  assert.match(app, /function setStartupFailure\(message\)/);
  assert.match(app, /\$\("appShell"\)\.inert = Boolean\(message\) \|\| exportInProgress/);
  assert.match(app, /\$\("retryStartupButton"\)\.focus\(\)/);
  assert.match(app, /retryStartupButton.*location\.reload/s);
});

test("moving a task restores WPF board focus after rerender", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const taskCard = app.slice(app.indexOf("function projectTaskCard"), app.indexOf("function personCardMarkup"));
  const moveTask = app.slice(app.indexOf("async function moveTask"), app.indexOf("async function deleteTask"));

  assert.match(taskCard, /tabindex="-1"/);
  assert.match(taskCard, /data-task-id/);
  assert.match(app, /function restoreTaskFocus\(task\)/);
  assert.match(app, /card\.scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(moveTask, /refreshAll\(\);\s*restoreTaskFocus\(task\);/);
});

test("task move toast keeps the exact WPF word order", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const moveTask = app.slice(app.indexOf("async function moveTask"), app.indexOf("async function deleteTask"));

  assert.match(moveTask, /showToast\("Stato aggiornato", `“\$\{task\.title\}” ora è \$\{statusLabels\[status\]\.toLowerCase\(\)\}\.`\)/);
});

test("task cards keep disabled edge arrows visible like WPF", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const taskCard = app.slice(app.indexOf("function projectTaskCard"), app.indexOf("function personCardMarkup"));

  assert.match(taskCard, /const previousStatus = previous \?\? current/);
  assert.match(taskCard, /const nextStatus = next \?\? current/);
  assert.match(taskCard, /previous \? "" : " disabled"/);
  assert.match(taskCard, /next \? "" : " disabled"/);
});

test("disabled task arrows keep a disabled visual affordance", async () => {
  const styles = await readFile(new URL("styles.css", sourceDirectory), "utf8");

  assert.match(styles, /\.micro-button:disabled\s*\{[^}]*opacity:\s*\.42/);
});

test("dropping a task in its current WPF column is a no-op", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const dropHandlers = app.slice(app.indexOf('for (const list of $$(".task-stack"))'), app.indexOf('document.addEventListener("dragstart"'));

  assert.match(dropHandlers, /const task = taskById\(id\);/);
  assert.match(dropHandlers, /if \(!task \|\| task\.status === status\) return;/);
  assert.match(dropHandlers, /void moveTask\(task, status\);/);
});

test("project navigation supports WPF arrow-key selection", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");

  assert.match(app, /function moveProjectNavFocus\(key\)/);
  assert.match(app, /ArrowDown/);
  assert.match(app, /ArrowUp/);
  assert.match(app, /target(?:\?\.|\.)classList\.contains\("project-nav-item"\)/);
  assert.match(app, /moveProjectNavFocus\(event\.key\)/);
});

test("project navigation clears selection outside the WPF project section", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const showSection = app.slice(app.indexOf("function showSection"), app.indexOf("function refreshAll"));

  assert.match(app, /function updateProjectNavSelection\(\)/);
  assert.match(showSection, /updateProjectNavSelection\(\)/);
});

test("project navigation keeps WPF edge arrows as no-ops", async () => {
  const app = await readFile(new URL("app.mjs", sourceDirectory), "utf8");
  const moveProjectNavFocus = app.slice(app.indexOf("function moveProjectNavFocus"), app.indexOf("function openQuickCreateTask"));

  assert.match(moveProjectNavFocus, /if \(!next \|\| next === document\.activeElement\) return;/);
});

test("storage settings expose an accessible native data-directory flow", async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL("index.html", sourceDirectory), "utf8"),
    readFile(new URL("app.mjs", sourceDirectory), "utf8"),
    readFile(new URL("styles.css", sourceDirectory), "utf8")
  ]);

  assert.match(html, /id="storageLocationButton"[^>]*aria-label="Configura la cartella dati"/);
  assert.match(html, /id="storageDialog"[^>]*aria-labelledby="storageDialogTitle"/);
  assert.match(html, /id="storageCurrentPath"/);
  assert.match(html, /id="storageSelectionPath"/);
  assert.match(html, /id="storageChooseButton"/);
  assert.match(html, /id="storageCopyButton"/);
  assert.match(html, /id="storageUseButton"/);
  assert.match(html, /id="storageCancelButton"/);
  assert.match(html, /id="storageError"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /id="storageBrowserNote"/);
  assert.match(app, /function openStorageDialog\(/);
  assert.match(app, /getStorageLocation\(\)/);
  assert.match(app, /chooseStorageLocation\(\)/);
  assert.match(app, /inspectStorageLocation\(/);
  assert.match(app, /setStorageLocation\(/);
  assert.match(app, /let pendingSaveCount = 0/);
  assert.match(app, /storageOperationInProgress \|\| exportInProgress \|\| pendingSaveCount > 0/);
  assert.match(app, /renderStorageLocation\(\{ directory: "localStorage", isDefault: true, containsWorkspace: true \}\)/);
  assert.match(app, /\$\("storageCurrentStatus"\)\.textContent = "Browser"/);
  assert.match(html, /Copia i dati e cambia posizione/);
  assert.match(app, /localStorage/);
  assert.match(styles, /\.storage-location-button\s*\{[^}]*min-width:\s*0/);
  assert.match(styles, /\.storage-location-copy\s*\{[^}]*min-width:\s*0/);
  assert.match(styles, /\.storage-path\s*\{[^}]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(styles, /\.storage-path\s*\{[^}]*overflow-x:\s*auto/);
});
