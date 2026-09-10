const playwrightModule = process.env.BROJECT_PLAYWRIGHT_MODULE ?? "playwright";
const { chromium } = await import(playwrightModule);

const baseUrl = process.env.BROJECT_BASE_URL ?? "http://127.0.0.1:4173";
const executablePath = process.env.BROJECT_CHROMIUM;
const screenshotPath = process.env.BROJECT_UI_SCREENSHOT ?? "artifacts/ui-smoke-1080.png";
const overviewScreenshotPath = process.env.BROJECT_OVERVIEW_SCREENSHOT ?? "artifacts/ui-smoke-overview-1080.png";
const dirtyDialogScreenshotPath = process.env.BROJECT_DIRTY_DIALOG_SCREENSHOT ?? "artifacts/ui-smoke-unsaved-dialog-1080.png";
const actionConfirmScreenshotPath = process.env.BROJECT_ACTION_CONFIRM_SCREENSHOT ?? "artifacts/ui-smoke-action-confirm-1080.png";
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"]
});
const page = await browser.newPage({ viewport: { width: 1080, height: 720 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(120);
  const initial = await page.evaluate(() => ({
    title: document.title,
    overview: document.querySelector("#overviewView")?.classList.contains("is-hidden") === false,
    emptyWelcome: document.querySelector("#welcomePanel")?.classList.contains("is-hidden") === false
  }));
  if (initial.title !== "Broject — il lavoro, finalmente chiaro" || !initial.overview || !initial.emptyWelcome) throw new Error("stato iniziale overview non valido");
  await page.screenshot({ path: overviewScreenshotPath, fullPage: true });

  await page.locator("#storageLocationButton").click();
  await page.waitForFunction(() => document.querySelector("#storageDialog")?.open === true);
  const storageFallback = await page.evaluate(() => ({
    path: document.querySelector("#storageCurrentPath")?.textContent?.trim(),
    status: document.querySelector("#storageCurrentStatus")?.textContent?.trim(),
    browserNoteVisible: document.querySelector("#storageBrowserNote")?.classList.contains("is-hidden") === false,
    chooseVisible: document.querySelector("#storageChooseButton")?.offsetParent !== null,
    active: document.activeElement?.id,
    pageHasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  if (storageFallback.path !== "localStorage" || storageFallback.status !== "Browser"
    || !storageFallback.browserNoteVisible || storageFallback.chooseVisible
    || storageFallback.active !== "storageCancelButton" || storageFallback.pageHasHorizontalOverflow) {
    throw new Error("fallback browser della cartella dati non valido");
  }
  await page.locator("#storageCancelButton").click();
  await page.waitForFunction(() => document.querySelector("#storageDialog")?.open === false
    && document.activeElement?.id === "storageLocationButton");

  await page.locator("#quickCreateButton").click();
  if (!(await page.locator("#projectDialog").isVisible().catch(() => false))) throw new Error("quick create vuoto non ha aperto il dialogo progetto WPF");
  await page.locator("#projectName").fill("UI smoke project");
  await page.locator("#projectForm button[value=default]").click();
  await page.waitForFunction(() => !document.querySelector("#projectDialog")?.open && document.querySelector("#projectTitle")?.textContent === "UI smoke project");
  await page.waitForFunction(() => document.activeElement?.id === "quickCreateButton");
  const projectSurface = await page.evaluate(() => ({
    actions: ["exportProjectHeaderButton", "editProjectButton", "deleteProjectHeaderButton"].every((id) => document.getElementById(id)?.offsetParent !== null),
    statusRows: document.querySelectorAll("#statusSummaryList .status-summary-row").length,
    projectSearchLabel: document.querySelector("#projectSearch")?.getAttribute("aria-label"),
    previousWeekLabel: document.querySelector("#previousWeekButton")?.getAttribute("aria-label"),
    nextWeekLabel: document.querySelector("#nextWeekButton")?.getAttribute("aria-label")
  }));
  if (!projectSurface.actions || projectSurface.statusRows !== 3
    || projectSurface.projectSearchLabel !== "Cerca attività nel progetto"
    || projectSurface.previousWeekLabel !== "Vai alla settimana precedente"
    || projectSurface.nextWeekLabel !== "Vai alla settimana successiva") throw new Error("azioni progetto o nomi accessibili non validi");

  await page.locator("#editProjectButton").click();
  await page.waitForFunction(() => document.activeElement?.id === "projectName");
  const projectNameSelected = await page.locator("#projectName").evaluate((input) => input.selectionStart === 0 && input.selectionEnd === input.value.length);
  if (!projectNameSelected) throw new Error("il nome progetto non viene selezionato all’apertura");
  await page.locator("#projectName").fill("Unsaved project name");
  const projectCloseGuard = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  if (!projectCloseGuard) throw new Error("chiusura con modifiche progetto non protetta");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#unsavedDialog")?.open === true);
  const confirmSeen = await page.evaluate(() => document.querySelector("#unsavedDialogMessage")?.textContent?.includes("modifiche non salvate")
    && document.activeElement?.matches('[data-dialog-choice="cancel"]'));
  if (!confirmSeen) throw new Error("la chiusura con modifiche non ha chiesto conferma");
  await page.screenshot({ path: dirtyDialogScreenshotPath, fullPage: true });
  await page.locator('[data-dialog-choice="cancel"]').click();
  await page.waitForFunction(() => document.querySelector("#unsavedDialog")?.open === false
    && document.querySelector("#projectDialog")?.open === true);
  await page.locator("#projectName").fill("UI smoke project");
  await page.locator("#projectForm .modal-actions button[value=cancel]").click();
  await page.waitForFunction(() => !document.querySelector("#projectDialog")?.open);

  await page.locator("#newProjectButton").click();
  await page.locator("#projectName").fill("Other smoke project");
  await page.locator("#projectForm button[value=default]").click();
  await page.waitForFunction(() => document.querySelector("#projectTitle")?.textContent === "Other smoke project");

  const firstProjectNav = page.locator("#projectNavList .project-nav-item").filter({ hasText: "Other smoke project" });
  await firstProjectNav.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector("#projectTitle")?.textContent === "UI smoke project");
  const navArrowDown = await page.evaluate(() => ({
    title: document.querySelector("#projectTitle")?.textContent,
    active: document.activeElement?.querySelector(".project-nav-name")?.textContent?.trim()
  }));
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector("#projectTitle")?.textContent === "Other smoke project");
  const navArrowUp = await page.evaluate(() => ({
    title: document.querySelector("#projectTitle")?.textContent,
    active: document.activeElement?.querySelector(".project-nav-name")?.textContent?.trim()
  }));
  await page.locator("#projectSearch").fill("edge-check");
  await page.locator("#projectNavList .project-nav-item").filter({ hasText: "Other smoke project" }).focus();
  await page.keyboard.press("ArrowUp");
  const edgeArrowSearch = await page.locator("#projectSearch").inputValue();
  if (edgeArrowSearch !== "edge-check") throw new Error("la freccia al bordo ha riaperto il progetto e azzerato i filtri");
  await page.locator("#resetFiltersButton").click();
  await page.locator('[data-section="overview"]').click();
  await page.waitForFunction(() => !document.querySelector("#overviewView")?.classList.contains("is-hidden"));
  const overviewSelection = await page.locator("#projectNavList .project-nav-item.is-selected").count();
  if (overviewSelection !== 0) throw new Error("la selezione progetto non viene azzerata in Overview");
  await page.locator("#projectNavList .project-nav-item").filter({ hasText: "Other smoke project" }).click();
  await page.waitForFunction(() => document.querySelector("#projectTitle")?.textContent === "Other smoke project");
  const projectNavKeyboard = { navArrowDown, navArrowUp, edgeArrowSearch, overviewSelection };

  await page.locator('[data-project-view="list"]').click();
  await page.waitForFunction(() => document.querySelector("#listProjectView")?.classList.contains("is-hidden") === false);
  const emptyListState = await page.evaluate(() => ({
    tableHidden: document.querySelector("#tasksTable")?.classList.contains("is-hidden"),
    emptyVisible: !document.querySelector("#listEmpty")?.classList.contains("is-hidden"),
    resetDisabled: document.querySelector("#resetFiltersButton")?.disabled,
    tableLabel: document.querySelector("#tasksTable")?.getAttribute("aria-label")
  }));
  if (!emptyListState.tableHidden || !emptyListState.emptyVisible || !emptyListState.resetDisabled || emptyListState.tableLabel !== "Attività del progetto") throw new Error("stato vuoto Elenco non allineato al WPF");
  await page.locator('[data-project-view="board"]').click();

  await page.locator("#addTaskButton").click();
  await page.waitForFunction(() => document.activeElement?.id === "taskTitle");
  const drawerState = await page.evaluate(() => ({
    visible: !document.querySelector("#taskDrawer")?.classList.contains("is-hidden"),
    active: document.activeElement?.id,
    inert: document.querySelector("#appShell")?.inert === true,
    ariaHidden: document.querySelector("#appShell")?.getAttribute("aria-hidden"),
    editorStateLive: document.querySelector("#editorState")?.getAttribute("aria-live"),
    labels: Object.fromEntries(["taskTitle", "taskProject", "taskStatus", "taskPriority", "taskDueDate", "assigneePicker", "taskNotes", "taskTags", "taskConclusions"]
      .map((id) => [id, document.querySelector(`#${id}`)?.getAttribute("aria-label")]) )
  }));
  const expectedDrawerLabels = {
    taskTitle: "Titolo attività, obbligatorio",
    taskProject: "Progetto dell’attività",
    taskStatus: "Stato attività",
    taskPriority: "Priorità attività",
    taskDueDate: "Scadenza, facoltativa",
    assigneePicker: "Mostra o nascondi le persone assegnabili",
    taskNotes: "Note attività",
    taskTags: "Tag separati da virgole",
    taskConclusions: "Conclusioni attività"
  };
  if (!drawerState.visible || drawerState.active !== "taskTitle" || !drawerState.inert || drawerState.ariaHidden !== "true"
    || drawerState.editorStateLive !== "polite"
    || JSON.stringify(drawerState.labels) !== JSON.stringify(expectedDrawerLabels)) throw new Error("stato accessibilità drawer non valido");

  await page.locator("#taskDueDate").fill("08/09/2026");
  await page.locator("#taskDueDateCalendarButton").click();
  await page.waitForFunction(() => !document.querySelector("#taskDueDateCalendar")?.classList.contains("is-hidden"));
  const calendarMonth = await page.locator("#taskDueDateCalendarTitle").textContent();
  if (!(await page.locator("#taskDueDateCalendarDays [data-date]").count())) throw new Error("calendario scadenza senza giorni");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#taskDueDateCalendar")?.classList.contains("is-hidden"));
  await page.locator("#taskDueDateCalendarButton").click();
  await page.locator("#taskDueDateNextMonth").click();
  await page.waitForFunction((previous) => document.querySelector("#taskDueDateCalendarTitle")?.textContent !== previous, calendarMonth);
  await page.locator("#taskDueDatePreviousMonth").click();
  await page.waitForFunction((previous) => document.querySelector("#taskDueDateCalendarTitle")?.textContent === previous, calendarMonth);
  await page.locator('#taskDueDateCalendarDays [data-date="2026-09-08"]').click();
  await page.waitForFunction(() => document.querySelector("#taskDueDateCalendar")?.classList.contains("is-hidden"));
  const calendarDate = await page.locator("#taskDueDate").inputValue();
  if (calendarDate !== "08/09/2026") throw new Error("selezione calendario non ha conservato la data italiana");

  await page.locator("#taskTitle").fill("UI smoke task");
  await page.locator("#saveTaskButton").click();
  await page.waitForFunction(() => document.querySelector("#taskDrawer")?.classList.contains("is-hidden") && document.body.innerText.includes("UI smoke task"));
  const edgeMoveButtons = await page.locator("article.task-card").filter({ hasText: "UI smoke task" }).locator('[data-action="move-task"]').evaluateAll((buttons) => buttons.map((button) => button.disabled));
  if (edgeMoveButtons.length !== 2 || !edgeMoveButtons[0] || edgeMoveButtons[1]) throw new Error("frecce TaskCard ai bordi non allineate al WPF");
  await page.locator("article.task-card").filter({ hasText: "UI smoke task" }).locator('[data-action="move-task"]:not([disabled])').first().click();
  await page.waitForFunction(() => document.activeElement?.matches("article.task-card")
    && document.activeElement?.textContent?.includes("UI smoke task")
    && document.activeElement?.querySelector(".task-status-label")?.textContent === "In corso");
  const movedTaskFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    status: document.activeElement?.querySelector(".task-status-label")?.textContent
  }));

  await page.evaluate(() => {
    const card = [...document.querySelectorAll('#doingList [data-task-id]')]
      .find((item) => item.textContent?.includes("UI smoke task"));
    const list = document.querySelector("#doingList");
    if (!card || !list) throw new Error("task moved non presente nella colonna In corso");
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", card.dataset.taskId);
    document.querySelector("#toast")?.classList.add("is-hidden");
    list.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  });
  await page.waitForTimeout(120);
  const sameColumnDrop = await page.evaluate(() => ({
    toastVisible: !document.querySelector("#toast")?.classList.contains("is-hidden"),
    status: [...document.querySelectorAll('#doingList [data-task-id]')]
      .find((item) => item.textContent?.includes("UI smoke task"))
      ?.querySelector(".task-status-label")?.textContent
  }));
  if (sameColumnDrop.toastVisible || sameColumnDrop.status !== "In corso") throw new Error("drop nella stessa colonna non è un no-op");

  await page.locator("#addTaskButton").click();
  await page.locator("#taskTitle").fill("UI smoke dated task");
  await page.locator("#taskDueDate").fill("31/02/2026");
  await page.locator("#taskDueDate").press("Tab");
  await page.waitForFunction(() => document.querySelector("#taskError")?.textContent.includes("La scadenza ‘31/02/2026’ non è valida. Usa gg/mm/aaaa oppure cancella il campo."));
  await page.locator("#saveTaskButton").click();
  await page.waitForFunction(() => !document.querySelector("#taskError")?.classList.contains("is-hidden"));
  if (!(await page.locator("#taskError").textContent()).includes("gg/mm/aaaa")) throw new Error("validazione data italiana non visibile");
  await page.locator("#taskDueDate").fill("08/09/2026");
  await page.locator("#saveTaskButton").click();
  await page.waitForFunction(() => document.querySelector("#taskDrawer")?.classList.contains("is-hidden") && document.body.innerText.includes("UI smoke dated task"));
  const dateEditor = await page.evaluate(() => ({
    type: document.querySelector("#taskDueDate")?.getAttribute("type"),
    placeholder: document.querySelector("#taskDueDate")?.getAttribute("placeholder")
  }));
  if (dateEditor.type !== "text" || dateEditor.placeholder !== "gg/mm/aaaa") throw new Error("editor data non localizzato");

  await page.locator("#globalSearch").fill("UI smoke dated task");
  await page.waitForFunction(() => !document.querySelector("#searchSurface")?.classList.contains("is-hidden"));
  const searchSurface = await page.evaluate(() => ({
    taskHeading: !document.querySelector("#searchTasksHeading")?.classList.contains("is-hidden"),
    projectHeading: !document.querySelector("#searchProjectsHeading")?.classList.contains("is-hidden"),
    peopleHeading: !document.querySelector("#searchPeopleHeading")?.classList.contains("is-hidden"),
    taskCount: document.querySelectorAll('#searchTaskItems [data-action="open-task"]').length
  }));
  if (!searchSurface.taskHeading || searchSurface.projectHeading || searchSurface.peopleHeading || searchSurface.taskCount !== 1) throw new Error("gruppi ricerca non filtrati correttamente");
  await page.locator("#closeSearchButton").click();
  await page.waitForFunction(() => document.querySelector("#searchSurface")?.classList.contains("is-hidden"));
  const searchFocus = await page.evaluate(() => document.activeElement?.id);
  if (searchFocus !== "globalSearch") throw new Error("chiusura ricerca non ha ripristinato il focus");
  await page.locator("#globalSearch").fill("UI smoke dated task");
  await page.waitForFunction(() => !document.querySelector("#searchSurface")?.classList.contains("is-hidden"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#searchSurface")?.classList.contains("is-hidden"));
  const escapeSearchFocus = await page.evaluate(() => document.activeElement?.id);
  if (escapeSearchFocus !== "globalSearch") throw new Error("Escape non ha ripristinato il focus della ricerca");

  await page.locator("article.task-card").filter({ hasText: "UI smoke dated task" }).locator('[data-action="open-task"]').first().click();
  await page.waitForFunction(() => document.querySelector("#taskTitle")?.value === "UI smoke dated task");
  await page.locator("#deleteTaskButton").click();
  await page.waitForFunction(() => document.querySelector("#actionConfirmDialog")?.open === true);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#actionConfirmDialog")?.open === false);
  const actionConfirmEscapeFocus = await page.evaluate(() => document.activeElement?.id);
  if (actionConfirmEscapeFocus !== "deleteTaskButton") throw new Error(`Escape non ha ripristinato il focus del dialogo di conferma: ${actionConfirmEscapeFocus}`);
  await page.locator("#deleteTaskButton").click();
  await page.waitForFunction(() => document.querySelector("#actionConfirmDialog")?.open === true);
  const deleteConfirm = await page.evaluate(() => ({
    title: document.querySelector("#actionConfirmDialogTitle")?.textContent,
    message: document.querySelector("#actionConfirmDialogMessage")?.textContent,
    active: document.activeElement?.getAttribute("data-confirm-choice")
  }));
  if (deleteConfirm.title !== "Elimina attività"
    || !deleteConfirm.message?.includes("UI smoke dated task")
    || deleteConfirm.active !== "cancel") throw new Error("conferma eliminazione interna non conforme al WPF");
  await page.screenshot({ path: actionConfirmScreenshotPath, fullPage: true });
  await page.locator('[data-confirm-choice="confirm"]').click();
  await page.waitForFunction(() => document.querySelector("#taskDrawer")?.classList.contains("is-hidden") && !document.querySelector("#undoBar")?.classList.contains("is-hidden"));
  const deleteFocus = await page.evaluate(() => document.activeElement?.id);
  if (deleteFocus !== "addTaskButton") throw new Error(`eliminazione non ha ripristinato il focus su Aggiungi attività: ${deleteFocus}`);
  await page.locator("#globalSearch").fill("UI smoke dated task");
  await page.waitForFunction(() => !document.querySelector("#searchSurface")?.classList.contains("is-hidden"));
  if (await page.locator('#searchTaskItems [data-action="open-task"]').count() !== 0) throw new Error("task eliminato ancora presente nella ricerca prima del recupero");
  await page.locator("#undoButton").click();
  await page.waitForFunction(() => document.querySelectorAll('#searchTaskItems [data-action="open-task"]').length === 1);
  const undoSearch = await page.evaluate(() => ({
    query: document.querySelector("#globalSearch")?.value,
    resultCount: document.querySelectorAll('#searchTaskItems [data-action="open-task"]').length,
    searchVisible: !document.querySelector("#searchSurface")?.classList.contains("is-hidden"),
    tooltip: document.querySelector("#undoButton")?.getAttribute("title"),
    undoHidden: document.querySelector("#undoBar")?.classList.contains("is-hidden")
  }));
  if (undoSearch.query !== "UI smoke dated task" || undoSearch.resultCount !== 1 || !undoSearch.searchVisible || undoSearch.tooltip !== "Ripristina l’ultima eliminazione di questa sessione" || !undoSearch.undoHidden) throw new Error("Undo non ha preservato la ricerca WPF");
  await page.locator("#closeSearchButton").click();

  await page.locator("#addTaskButton").click();
  await page.waitForFunction(() => document.activeElement?.id === "taskTitle");
  await page.locator("#taskTitle").fill("Unsaved browser close");
  const unsavedClose = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  if (!unsavedClose) throw new Error("chiusura con modifiche task non protetta");
  await page.locator("#taskTitle").fill("");
  await page.locator("#taskTitle").fill("Unsaved navigation");
  await page.evaluate(() => {
    const projectButton = [...document.querySelectorAll("#projectNavList .project-nav-item")]
      .find((button) => button.textContent.includes("UI smoke project"));
    projectButton?.click();
  });
  await page.waitForFunction(() => document.querySelector("#unsavedTaskDialog")?.open === true);
  await page.locator('[data-unsaved-choice="cancel"]').click();
  await page.waitForFunction(() => !document.querySelector("#taskDrawer")?.classList.contains("is-hidden"));
  await page.locator("#taskTitle").fill("");
  await page.locator("#assigneePicker summary").click();
  if (!(await page.locator("#assigneePicker").evaluate((element) => element.open))) throw new Error("selettore assegnatari non si apre");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("#assigneePicker")?.open && document.activeElement?.closest("#assigneePicker"));
  await page.locator("#saveTaskButton").focus();
  await page.keyboard.press("Tab");
  const trapActive = await page.evaluate(() => document.activeElement?.id);
  if (trapActive !== "closeDrawerButton") throw new Error(`focus trap non attivo: ${trapActive}`);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#taskDrawer")?.classList.contains("is-hidden"));

  await page.locator('[data-section="people"]').click();
  await page.waitForFunction(() => !document.querySelector("#peopleView")?.classList.contains("is-hidden"));
  await page.locator("#addPersonButton").click();
  await page.waitForFunction(() => document.querySelector("#personDialog")?.open && document.activeElement?.id === "personFirstName");
  const personDialog = await page.evaluate(() => ({
    title: document.querySelector("#personDialogTitle")?.textContent,
    avatar: document.querySelector("#personDialogAvatar")?.textContent,
    save: document.querySelector("#savePersonButton")?.textContent,
    labels: [...document.querySelectorAll("#personForm label span")].map((element) => element.textContent)
  }));
  if (personDialog.title !== "Nuova persona" || personDialog.avatar !== "+" || personDialog.save !== "Aggiungi persona" || !personDialog.labels.includes("Nome (obbligatorio)")) throw new Error("dialog persona non allineato");
  await page.locator("#personFirstName").fill("Unsaved person");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#unsavedDialog")?.open === true);
  const personDirtyGuard = await page.evaluate(() => document.querySelector("#unsavedDialogMessage")?.textContent?.includes("modifiche non salvate")
    && document.activeElement?.matches('[data-dialog-choice="cancel"]'));
  if (!personDirtyGuard) throw new Error("guard modifiche persona non allineato");
  await page.locator('[data-dialog-choice="cancel"]').click();
  await page.waitForFunction(() => document.querySelector("#unsavedDialog")?.open === false
    && document.querySelector("#personDialog")?.open === true);
  await page.locator("#personFirstName").fill("");
  await page.locator("#personForm .modal-actions button[value=cancel]").click();
  await page.waitForFunction(() => !document.querySelector("#personDialog")?.open);

  await page.locator('[data-section="reports"]').click();
  await page.waitForFunction(() => !document.querySelector("#reportsView")?.classList.contains("is-hidden"));
  const busyDownload = page.waitForEvent("download").catch(() => null);
  await page.locator("#exportPortfolioButton").click();
  await page.waitForFunction(() => !document.querySelector("#busyOverlay")?.classList.contains("is-hidden"));
  const busyState = await page.evaluate(() => ({
    visible: !document.querySelector("#busyOverlay")?.classList.contains("is-hidden"),
    appInert: document.querySelector("#appShell")?.inert === true,
    ariaBusy: document.querySelector("#appShell")?.getAttribute("aria-busy"),
    progressLabel: document.querySelector("#busyOverlay .spinner")?.getAttribute("aria-label"),
    outsideShell: !document.querySelector("#appShell")?.contains(document.querySelector("#busyOverlay"))
  }));
  if (!busyState.visible || !busyState.appInert || busyState.ariaBusy !== "true" || busyState.progressLabel !== "Esportazione in corso" || !busyState.outsideShell) throw new Error("stato busy export non valido");
  await page.keyboard.press("Control+N");
  await page.keyboard.press("F1");
  if (await page.locator("#taskDrawer").evaluate((element) => !element.classList.contains("is-hidden")) || await page.locator("#helpDialog").evaluate((element) => element.open)) {
    throw new Error("shortcut ha aperto una superficie durante l’export");
  }
  if (!(await busyDownload)) throw new Error("export busy non ha prodotto un download");
  await page.waitForFunction(() => document.querySelector("#busyOverlay")?.classList.contains("is-hidden"));
  await page.locator("#reportProjectSelect").selectOption({ label: "UI smoke project" });
  await page.locator("#projectNavList .project-nav-item").filter({ hasText: "Other smoke project" }).click();
  await page.waitForFunction(() => document.querySelector("#projectTitle")?.textContent === "Other smoke project");
  await page.locator("#exportProjectHeaderButton").click();
  const reportNotesDialog = await page.evaluate(() => ({
    title: document.querySelector("#reportNotesDialog h2")?.textContent,
    section: document.querySelector("#reportNotesForm label span")?.textContent,
    accessibleName: document.querySelector("#reportNotes")?.getAttribute("aria-label"),
    submit: document.querySelector("#reportNotesForm button[value=default]")?.textContent
  }));
  if (reportNotesDialog.title !== "Note del report" || reportNotesDialog.section !== "Sintesi, decisioni e prossimi passi" || reportNotesDialog.accessibleName !== "Note finali del report, facoltative" || reportNotesDialog.submit !== "Continua con l’export") throw new Error("dialog note report non allineato");
  await page.locator("#reportNotes").fill("Header export smoke");
  const [headerDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#reportNotesForm button[value=default]").click()
  ]);
  if (!headerDownload.suggestedFilename().includes("Other smoke project")) throw new Error("export header ha usato il progetto report invece di quello attivo");
  await page.waitForFunction(() => document.activeElement?.id === "exportProjectHeaderButton");

  await page.locator("#helpButton").click();
  const helpCopy = await page.locator("#helpDialog").textContent();
  if (!helpCopy.includes("Guida all’utilizzo")
    || !helpCopy.includes("Crea un progetto dalla barra laterale")
    || !helpCopy.includes("Report Excel")
    || !helpCopy.includes("Ctrl+K / Cmd+K")) throw new Error("guida all’utilizzo incompleta");
  await page.locator("#helpDialog .modal-actions button[value=cancel]").click();
  await page.waitForFunction(() => document.activeElement?.id === "helpButton");

  await page.keyboard.press("Control+Shift+L");
  await page.waitForFunction(() => document.querySelector("#listProjectView")?.classList.contains("is-hidden") === false);
  await page.keyboard.press("Control+Shift+W");
  await page.waitForFunction(() => document.querySelector("#calendarProjectView")?.classList.contains("is-hidden") === false);
  await page.keyboard.press("Control+Shift+B");
  await page.waitForFunction(() => document.querySelector("#boardProjectView")?.classList.contains("is-hidden") === false);
  await page.keyboard.press("Control+1");
  await page.waitForFunction(() => !document.querySelector("#overviewView")?.classList.contains("is-hidden"));
  await page.keyboard.press("Control+2");
  await page.waitForFunction(() => !document.querySelector("#myWorkView")?.classList.contains("is-hidden"));
  await page.keyboard.press("Control+3");
  await page.waitForFunction(() => !document.querySelector("#peopleView")?.classList.contains("is-hidden"));
  await page.keyboard.press("Control+4");
  await page.waitForFunction(() => !document.querySelector("#reportsView")?.classList.contains("is-hidden"));
  await page.keyboard.press("Control+1");
  await page.waitForFunction(() => !document.querySelector("#overviewView")?.classList.contains("is-hidden"));
  await page.locator("#globalSearch").focus();
  await page.keyboard.press("Control+3");
  if (!await page.locator("#peopleView").evaluate((element) => element.classList.contains("is-hidden"))) throw new Error("shortcut sezione ha interrotto l’inserimento nel campo testo");
  await page.locator("#helpButton").focus();
  await page.keyboard.press("?");
  await page.waitForFunction(() => document.querySelector("#helpDialog")?.open === true);
  await page.locator("#helpDialog .modal-actions button[value=cancel]").click();
  await page.waitForFunction(() => document.activeElement?.id === "helpButton");
  await page.keyboard.press("F1");
  await page.waitForFunction(() => document.querySelector("#helpDialog")?.open === true);
  await page.locator("#helpDialog .modal-actions button[value=cancel]").click();
  await page.waitForFunction(() => document.activeElement?.id === "helpButton");

  await page.locator('[data-section="reports"]').click();
  await page.waitForFunction(() => !document.querySelector("#reportsView")?.classList.contains("is-hidden"));
  const [portfolioDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportPortfolioButton").click()
  ]);
  if (!portfolioDownload.suggestedFilename().endsWith(".xlsx")) throw new Error("export portfolio non è XLSX");
  await page.locator("#reportProjectSelect").selectOption({ label: "UI smoke project" });
  await page.locator("#exportProjectButton").click();
  await page.locator("#reportNotes").fill("Smoke report");
  const [projectDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#reportNotesForm button[value=default]").click()
  ]);
  if (!projectDownload.suggestedFilename().endsWith(".xlsx")) throw new Error("export progetto non è XLSX");
  await page.screenshot({ path: screenshotPath });

  const tauriPage = await browser.newPage({ viewport: { width: 1080, height: 720 } });
  await tauriPage.addInitScript(() => {
    const state = { handler: null, destroyed: 0 };
    const currentWindow = {
      onCloseRequested(handler) {
        state.handler = handler;
        return Promise.resolve(() => {});
      },
      destroy() {
        state.destroyed += 1;
        return Promise.resolve();
      }
    };
    globalThis.__tauriCloseState = state;
    globalThis.__TAURI__ = { window: { getCurrentWindow: () => currentWindow } };
  });
  await tauriPage.goto(baseUrl, { waitUntil: "networkidle" });
  await tauriPage.waitForFunction(() => typeof globalThis.__tauriCloseState?.handler === "function");
  if (await tauriPage.locator("#projectNavList .project-nav-item").count() === 0) {
    await tauriPage.locator("#firstProjectButton").click();
    await tauriPage.locator("#projectName").fill("Tauri smoke project");
    await tauriPage.locator("#projectForm button[value=default]").click();
    await tauriPage.waitForFunction(() => document.querySelectorAll("#projectNavList .project-nav-item").length > 0);
  }
  await tauriPage.locator("#projectNavList .project-nav-item").first().click();
  await tauriPage.waitForFunction(() => !document.querySelector("#projectView")?.classList.contains("is-hidden"));
  await tauriPage.locator("#addTaskButton").click();
  await tauriPage.locator("#taskTitle").fill("Tauri close guard");
  const nativeClosePromise = tauriPage.evaluate(async () => {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    await globalThis.__tauriCloseState.handler(event);
    return {
      prevented: event.prevented,
      destroyed: globalThis.__tauriCloseState.destroyed,
      drawerOpen: !document.querySelector("#taskDrawer")?.classList.contains("is-hidden")
    };
  });
  await tauriPage.waitForFunction(() => document.querySelector("#unsavedTaskDialog")?.open === true);
  await tauriPage.locator('[data-unsaved-choice="discard"]').click();
  const tauriCloseGuard = await nativeClosePromise;
  if (!tauriCloseGuard.prevented || tauriCloseGuard.destroyed !== 1 || tauriCloseGuard.drawerOpen) throw new Error("guard chiusura Tauri non ha protetto o completato il percorso WPF");

  if (pageErrors.length) throw new Error(`errori pagina: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ initial, quickCreateEmpty: "Nuovo progetto", projectSurface, projectNameSelected, projectCloseGuard, confirmSeen, drawerState, projectNavKeyboard, emptyListState, movedTaskFocus, sameColumnDrop, dateEditor, searchSurface, searchFocus, escapeSearchFocus, actionConfirmEscapeFocus, deleteFocus, undoSearch, unsavedClose, navigationGuard: true, trapActive, personDialog, reportNotesDialog, busyState, tauriCloseGuard, headerFile: headerDownload.suggestedFilename(), portfolioFile: portfolioDownload.suggestedFilename(), projectFile: projectDownload.suggestedFilename(), finalDrawerHidden: true, dirtyDialogScreenshotPath, actionConfirmScreenshotPath, screenshotPath }));
} finally {
  await browser.close();
}
