import { searchWorkspace, sortProjectTasks, displayName, personDetails } from "./core/workspace-query.mjs";
import { completedSummaryLabel, formatItalianDate, formatTaskTags, localDate, myWorkSnapshot, overviewFocusTasks, overviewHint, parseItalianDate, peopleSearchSnapshot, peopleSnapshot, projectStatus, relativeTime, sortOverviewProjects, taskDueLabel, taskDueTone } from "./core/dashboard-query.mjs";
import { WorkspaceStore, normalizeState } from "./core/workspace-store.mjs";
import { WorkspaceService } from "./core/workspace-service.mjs";
import { createNativeBridge, getGlobalNativeInvoke } from "./core/native-bridge.mjs";
import { buildPortfolioReport, buildProjectReport } from "./core/reporting.mjs";
import { createXlsxWorkbook, downloadXlsx, portfolioWorkbookSheets, projectWorkbookSheets } from "./core/xlsx.mjs";

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const now = () => new Date().toISOString();
const colors = ["#6C5CE7", "#08785F", "#2465BF", "#E14D72", "#93600E", "#8B5CF6", "#126A96", "#A124AF"];

const statusLabels = { Todo: "Da fare", Doing: "In corso", Done: "Completata" };
const priorityLabels = { Low: "Bassa", Medium: "Media", High: "Alta", Urgent: "Urgente" };

const nativeInvoke = getGlobalNativeInvoke(globalThis);
const fallbackStore = nativeInvoke ? null : new WorkspaceStore(globalThis.localStorage, "broject");
const nativeBridge = createNativeBridge(nativeInvoke, fallbackStore);
let loaded;
let storageFailure = null;
let nativeSaveQueue = Promise.resolve();
let pendingSaveCount = 0;
let storageLocation = null;
let selectedStorageLocation = null;
let storageOperationInProgress = false;
try {
  loaded = await nativeBridge.load();
} catch (error) {
  storageFailure = `Impossibile caricare i dati locali: ${error.message}`;
  loaded = { state: normalizeState(), recoveryMessage: storageFailure };
}
const startupFailure = storageFailure;

const runtimeStore = {
  load: () => loaded,
  save: async (nextState) => {
    if (storageFailure) throw new Error(`${storageFailure} Nessuna modifica è stata salvata.`);
    pendingSaveCount += 1;
    try {
      if (!nativeInvoke) {
        fallbackStore.save(nextState);
        return;
      }

      const snapshot = structuredClone(nextState);
      const saveOperation = nativeSaveQueue.catch(() => {}).then(async () => {
        if (storageFailure) throw new Error(`${storageFailure} Nessuna modifica è stata salvata.`);
        try {
          await nativeBridge.save(snapshot);
        } catch (error) {
          storageFailure = `Impossibile salvare i dati locali: ${error.message}`;
          loaded.recoveryMessage = storageFailure;
          if (document.body) {
            showToast("Salvataggio non riuscito", "I dati restano in sola lettura finché lo storage locale non è disponibile.");
          }
          throw error;
        }
      });
      nativeSaveQueue = saveOperation;
      await saveOperation;
    } finally {
      pendingSaveCount -= 1;
    }
  }
};
const service = new WorkspaceService(runtimeStore);

let state = loaded.state;
let activeSection = "overview";
function firstProjectByName(projects) {
  return [...(projects ?? [])].sort((left, right) => String(left.name ?? "").localeCompare(String(right.name ?? ""), "it"))[0] ?? null;
}
let selectedProjectId = firstProjectByName(state.projects)?.id ?? null;
let projectView = "board";
let calendarWeekStart = startOfWeek(new Date());
let editingTaskId = null;
let editingProjectId = null;
let editingPersonId = null;
let editorBaseline = "";
let undoAction = null;
let toastTimer;
let searchQuery = "";
let projectSearch = "";
let statusFilter = "";
let personFilter = "";
let myWorkPersonId = "";
let pendingProjectExportId = null;
let editorReturnFocus = null;
let editorReturnTaskId = null;
const dialogReturnFocus = new Map();
let projectDialogBaseline = "";
let personDialogBaseline = "";
let exportInProgress = false;
let exportReturnFocus = null;
let pendingEditorClose = null;
let pendingDialogClose = null;
let pendingActionConfirmation = null;
let pendingTauriClose = null;
let tauriCloseWindow = null;
let tauriClosing = false;
let dueDateCalendarMonth = startOfWeek(new Date());

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfMonth(date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateOnlyKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromOnlyKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? date
    : null;
}

function renderDueDateCalendar() {
  const month = startOfMonth(dueDateCalendarMonth);
  dueDateCalendarMonth = month;
  $("taskDueDateCalendarTitle").textContent = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(month);
  const selected = parseItalianDate($("taskDueDate").value);
  const today = dateOnlyKey(new Date());
  const firstDayOffset = (month.getDay() + 6) % 7;
  const firstCell = addDays(month, -firstDayOffset);
  $("taskDueDateCalendarDays").innerHTML = Array.from({ length: 42 }, (_, index) => {
    const day = addDays(firstCell, index);
    const key = dateOnlyKey(day);
    const outside = day.getMonth() !== month.getMonth();
    const label = new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(day);
    return `<button class="date-picker-day${outside ? " is-outside" : ""}${key === today ? " is-today" : ""}${key === selected ? " is-selected" : ""}" type="button" role="gridcell" data-date="${key}" aria-label="${escapeHtml(label)}" aria-pressed="${key === selected ? "true" : "false"}"${key === today ? ' aria-current="date"' : ""}>${day.getDate()}</button>`;
  }).join("");
}

function openDueDateCalendar() {
  const selected = dateFromOnlyKey(parseItalianDate($("taskDueDate").value));
  dueDateCalendarMonth = startOfMonth(selected ?? new Date());
  renderDueDateCalendar();
  setVisible("taskDueDateCalendar", true);
  $("taskDueDateCalendarButton").setAttribute("aria-expanded", "true");
}

function closeDueDateCalendar(returnFocus = false) {
  setVisible("taskDueDateCalendar", false);
  $("taskDueDateCalendarButton").setAttribute("aria-expanded", "false");
  if (returnFocus) $("taskDueDateCalendarButton").focus();
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function projectById(id) {
  return state.projects.find((project) => project.id === id) ?? null;
}

function personById(id) {
  return state.people.find((person) => person.id === id) ?? null;
}

function taskById(id) {
  return state.tasks.find((task) => task.id === id) ?? null;
}

function taskProject(task) {
  return projectById(task.projectId);
}

function personLabel(person) {
  return displayName(person);
}

function personAssignmentLabel(person) {
  const details = personDetails(person);
  return details ? `${personLabel(person)} - ${details}` : personLabel(person);
}

function sortPeopleByName(people) {
  return [...(people ?? [])].sort((left, right) => (
    String(left.lastName ?? "").localeCompare(String(right.lastName ?? ""), "it")
      || String(left.firstName ?? "").localeCompare(String(right.firstName ?? ""), "it")
  ));
}

function initials(value) {
  const parts = String(value || "Senza nome").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "??").toUpperCase();
}

function avatarColor(index) {
  return colors[index % colors.length];
}

function formatDate(value, options = {}) {
  if (!value) return "Senza scadenza";
  const date = localDate(value);
  if (!date || Number.isNaN(date.getTime())) return "Data non valida";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", ...options }).format(date);
}

function formatDateRange(start, end) {
  return `${formatDate(start)} — ${formatDate(end, { year: "numeric" })}`;
}

function calendarDayLabel(value) {
  const label = new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(value);
  return label ? label.charAt(0).toLocaleUpperCase("it-IT") + label.slice(1) : label;
}

function dueClass(task) {
  const tone = taskDueTone(task);
  return tone === "danger" ? "is-overdue" : tone === "warning" ? "is-due-soon" : tone === "done" ? "is-completed" : "";
}

function dueLabel(task) {
  return taskDueLabel(task);
}
function assigneeLabel(task) {
  const names = (task.assigneePersonIds ?? []).map((id) => personById(id)).filter(Boolean).map(personLabel);
  return names.length ? names.join(", ") : "Non assegnata";
}

function assigneeCompactLabel(task) {
  const people = sortPeopleByName((task.assigneePersonIds ?? []).map((id) => personById(id)).filter(Boolean));
  if (people.length === 0) return "Non assegnata";
  const first = personLabel(people[0]);
  return people.length === 1 ? first : `${first} +${people.length - 1}`;
}

function taskMatchesFilters(task) {
  const project = taskProject(task);
  if (!project || project.id !== selectedProjectId) return false;
  if (statusFilter && task.status !== statusFilter) return false;
  if (personFilter === "unassigned" && (task.assigneePersonIds ?? []).length > 0) return false;
  if (personFilter && personFilter !== "unassigned" && !(task.assigneePersonIds ?? []).includes(personFilter)) return false;
  if (projectSearch.trim() && !searchWorkspace(state, projectSearch).tasks.some((item) => item.id === task.id)) return false;
  return true;
}

function setVisible(id, visible) {
  $(id).classList.toggle("is-hidden", !visible);
}

function setStartupFailure(message) {
  const failed = Boolean(message);
  setVisible("startupFailure", failed);
  $("appShell").inert = Boolean(message) || exportInProgress;
  if (failed) {
    $("appShell").setAttribute("aria-hidden", "true");
    $("startupFailureDetail").textContent = message;
    $("retryStartupButton").focus();
  } else {
    $("appShell").removeAttribute("aria-hidden");
    $("startupFailureDetail").textContent = "";
  }
}

const mutationControlIds = [
  "quickCreateButton", "overviewCreateButton", "firstProjectButton", "newProjectButton", "addTaskButton",
  "myWorkCreateButton", "addPersonButton", "editProjectButton", "saveTaskButton", "deleteTaskButton",
  "saveProjectButton", "deleteProjectHeaderButton", "savePersonButton", "deletePersonButton", "undoButton"
];

function updateMutationControls() {
  const disabled = Boolean(storageFailure) || exportInProgress;
  for (const id of mutationControlIds) {
    const control = $(id);
    if (control) control.disabled = disabled;
  }
}

function updateExportControls() {
  const selectedReportProject = $("reportProjectSelect") ? projectById($("reportProjectSelect").value) : null;
  if ($("exportProjectHeaderButton")) $("exportProjectHeaderButton").disabled = !projectById(selectedProjectId) || exportInProgress;
  if ($("exportPortfolioButton")) $("exportPortfolioButton").disabled = exportInProgress;
  if ($("exportProjectButton")) $("exportProjectButton").disabled = !selectedReportProject || exportInProgress;
}

function showToast(title, message) {
  $("toastTitle").textContent = title;
  $("toastMessage").textContent = message;
  setVisible("toast", true);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setVisible("toast", false), 3200);
}

const storageDefaultHelper = "I file di Broject restano sul dispositivo e includono dati, backup e log di recupero.";

function storageDirectoryName(directory) {
  const value = String(directory ?? "").replace(/[\\/]+$/, "");
  return value.split(/[\\/]/).pop() || value;
}

function updateStorageLocationSummary(location = storageLocation) {
  const button = $("storageLocationButton");
  const summary = $("storageLocationSummary");
  if (!button || !summary) return;
  if (!nativeInvoke) {
    summary.textContent = "Browser · localStorage";
    button.title = "Cartella dati · gestita dal browser";
    return;
  }
  const directory = String(location?.directory ?? "");
  summary.textContent = directory
    ? `${location?.isDefault ? "Predefinita" : "Personalizzata"} · ${storageDirectoryName(directory)}`
    : "Percorso non disponibile";
  button.title = directory ? `Configura la cartella dati · ${directory}` : "Configura la cartella dati";
}

function setStorageError(message = "") {
  const error = $("storageError");
  if (!error) return;
  error.textContent = message;
  setVisible("storageError", Boolean(message));
}

function setStorageDialogBusy(busy) {
  storageOperationInProgress = busy;
  const dialog = $("storageDialog");
  if (dialog) dialog.setAttribute("aria-busy", busy ? "true" : "false");
  ["storageCancelButton", "storageChooseButton", "storageUseButton", "storageCopyButton"].forEach((id) => {
    const control = $(id);
    if (control) control.disabled = busy;
  });
  if (busy && $("storageHelper")) $("storageHelper").textContent = "Controllo della cartella in corso…";
  if (!busy && $("storageHelper")) $("storageHelper").textContent = storageDefaultHelper;
}

function renderStorageLocation(location) {
  storageLocation = location;
  updateStorageLocationSummary(location);
  const currentPath = $("storageCurrentPath");
  const currentStatus = $("storageCurrentStatus");
  if (!currentPath || !currentStatus) return;
  const directory = String(location?.directory ?? "Percorso non disponibile");
  currentPath.textContent = directory;
  currentPath.title = directory;
  currentStatus.textContent = location?.isDefault ? "Predefinita" : "Personalizzata";
}

function clearStorageSelection() {
  selectedStorageLocation = null;
  setVisible("storageSelection", false);
  setVisible("storageUseButton", false);
  setVisible("storageCopyButton", false);
  $("storageSelectionPath").textContent = "";
  $("storageSelectionPath").removeAttribute("title");
  $("storageSelectionHint").textContent = "";
  setStorageError();
}

function renderStorageSelection(location) {
  selectedStorageLocation = location;
  const path = String(location?.directory ?? "");
  const hasWorkspace = Boolean(location?.containsWorkspace);
  $("storageSelectionPath").textContent = path;
  $("storageSelectionPath").title = path;
  $("storageSelectionStatus").textContent = hasWorkspace ? "Contiene dati" : "Disponibile";
  setVisible("storageSelectionStatus", true);
  $("storageSelectionHint").textContent = hasWorkspace
    ? "Questa cartella contiene già file di Broject. Puoi usarli, senza sovrascrivere il workspace attuale."
    : storageLocation?.containsWorkspace
      ? "La cartella è vuota. Puoi copiare qui il workspace attuale oppure iniziare da una cartella vuota."
      : "La cartella è pronta per il workspace locale.";
  setVisible("storageSelection", true);
  setVisible("storageUseButton", true);
  $("storageUseButton").textContent = hasWorkspace ? "Usa i dati esistenti" : "Usa cartella vuota";
  setVisible("storageCopyButton", Boolean(storageLocation?.containsWorkspace) && !hasWorkspace);
}

async function loadStorageLocation() {
  if (!nativeInvoke) {
    updateStorageLocationSummary();
    return;
  }
  try {
    renderStorageLocation(await nativeBridge.getStorageLocation());
  } catch (error) {
    storageLocation = null;
    updateStorageLocationSummary();
    void nativeBridge.logError(`[Cartella dati] ${runtimeErrorDetails(error)}`).catch(() => {});
  }
}

async function openStorageDialog() {
  if (storageOperationInProgress || exportInProgress || pendingSaveCount > 0) {
    if (pendingSaveCount > 0) showToast("Salvataggio in corso", "Attendi la fine del salvataggio prima di cambiare cartella.");
    return;
  }
  if (!$('taskDrawer').classList.contains("is-hidden")) {
    confirmCloseEditor(() => { void openStorageDialog(); });
    return;
  }
  rememberDialogFocus("storageDialog");
  clearStorageSelection();
  $("storageBrowserNote").classList.toggle("is-hidden", Boolean(nativeInvoke));
  $("storageChooseButton").classList.toggle("is-hidden", !nativeInvoke);
  $("storageDialog").showModal();
  if (!nativeInvoke) {
    renderStorageLocation({ directory: "localStorage", isDefault: true, containsWorkspace: true });
    $("storageCurrentStatus").textContent = "Browser";
    setTimeout(() => $("storageCancelButton")?.focus(), 0);
    return;
  }
  setStorageDialogBusy(true);
  try {
    renderStorageLocation(await nativeBridge.getStorageLocation());
    setTimeout(() => $("storageChooseButton")?.focus(), 0);
  } catch (error) {
    renderStorageLocation(null);
    $("storageCurrentStatus").textContent = "Non disponibile";
    setStorageError(`Impossibile leggere la cartella dati: ${error.message}`);
    setTimeout(() => $("storageCancelButton")?.focus(), 0);
  } finally {
    setStorageDialogBusy(false);
  }
}

async function chooseStorageLocation() {
  if (!nativeInvoke || storageOperationInProgress) return;
  setStorageError();
  setStorageDialogBusy(true);
  try {
    const selected = await nativeBridge.chooseStorageLocation();
    if (!selected?.directory) return;
    const inspection = await nativeBridge.inspectStorageLocation(selected.directory);
    renderStorageSelection({ ...selected, ...inspection });
    $("storageUseButton")?.focus();
  } catch (error) {
    setStorageError(`Cartella non selezionata: ${error.message}`);
  } finally {
    setStorageDialogBusy(false);
  }
}

async function applyStorageLocation(mode) {
  if (!nativeInvoke || !selectedStorageLocation?.directory || storageOperationInProgress) return;
  setStorageError();
  setStorageDialogBusy(true);
  try {
    const result = await nativeBridge.setStorageLocation(selectedStorageLocation.directory, mode);
    renderStorageLocation(result);
    $("storageDialog").close();
    showToast("Cartella dati aggiornata", "Broject riaprirà il workspace dalla nuova posizione.");
    setTimeout(() => globalThis.location.reload(), 350);
  } catch (error) {
    setStorageError(`Cambio cartella non riuscito: ${error.message}`);
    setStorageDialogBusy(false);
  }
}

function runtimeErrorDetails(error) {
  if (error instanceof Error) return error.stack || `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  if (error && typeof error.message === "string") return error.message;
  try {
    return JSON.stringify(error) || "Errore inatteso senza dettagli.";
  } catch {
    return "Errore inatteso senza dettagli.";
  }
}

function reportUnexpectedError(error, source) {
  const details = runtimeErrorDetails(error);
  void nativeBridge.logError(`[${source}] ${details}`).catch(() => {});
  if (!startupFailure && document.body) {
    showToast("Broject", "Si è verificato un errore inatteso. Le modifiche già confermate restano salvate. Puoi continuare a lavorare; se il problema si ripete, consulta broject-error.log.");
  }
}

globalThis.addEventListener("error", (event) => {
  event.preventDefault();
  reportUnexpectedError(event.error ?? event.message, "Errore frontend");
});

globalThis.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  reportUnexpectedError(event.reason, "Promise non gestita");
});

function setUndo(action) {
  undoAction = action;
  setVisible("undoBar", true);
}

function clearUndo() {
  undoAction = null;
  setVisible("undoBar", false);
}

function showSection(section) {
  if (!$("taskDrawer").classList.contains("is-hidden") && section !== activeSection) {
    confirmCloseEditor(() => showSection(section));
    return;
  }
  activeSection = section;
  searchQuery = "";
  $("globalSearch").value = "";
  setVisible("searchSurface", false);
  $$(".view-panel").forEach((panel) => setVisible(panel.id, panel.dataset.view === section));
  $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.section === section));
  updateProjectNavSelection();
  const headings = {
    overview: ["Panoramica", "Priorità e avanzamento"],
    project: [projectById(selectedProjectId)?.name ?? "Progetto", "Attività del progetto"],
    "my-work": ["Il mio lavoro", "Priorità trasversali"],
    people: ["Persone", "Team e carico operativo"],
    reports: ["Report", "Report Excel"]
  };
  $("pageTitle").textContent = headings[section][0];
  $("pageTitle").title = headings[section][0];
  $("pageSubtitle").textContent = headings[section][1];
  $("contentScroller").scrollTop = 0;
}

function setProjectView(view) {
  if (!Object.hasOwn({ board: true, list: true, calendar: true }, view)) return false;
  projectView = view;
  $$(".toggle-button").forEach((button) => button.classList.toggle("is-active", button.dataset.projectView === projectView));
  setVisible("boardProjectView", projectView === "board");
  setVisible("listProjectView", projectView === "list");
  setVisible("calendarProjectView", projectView === "calendar");
  updateCalendarScrollAffordance();
  return true;
}

function openProjectViewShortcut(view) {
  if (activeSection !== "project") {
    const project = projectById(selectedProjectId) ?? firstProjectByName(state.projects);
    if (!project) {
      openProjectDialog();
      return false;
    }
    selectedProjectId = project.id;
    activeSection = "project";
    refreshAll();
  }
  return setProjectView(view);
}

function refreshAll({ preserveSearch = false } = {}) {
  const searchBeforeRefresh = searchQuery;
  const searchWasVisible = preserveSearch
    && Boolean(searchBeforeRefresh.trim())
    && !$('searchSurface').classList.contains("is-hidden");
  renderProjectNav();
  renderOverview();
  renderProject();
  renderMyWork();
  renderPeople();
  renderReports();
  if (searchWasVisible) {
    $("globalSearch").value = searchBeforeRefresh;
    refreshSearch();
  } else {
    showSection(activeSection);
  }
  setStartupFailure(startupFailure);
  setVisible("recoveryBanner", Boolean(loaded.recoveryMessage) && !startupFailure);
  $("recoveryBanner").classList.toggle("is-error", Boolean(storageFailure));
  if (loaded.recoveryMessage) $("recoveryBanner").textContent = loaded.recoveryMessage;
  updateMutationControls();
  updateExportControls();
}

function renderProjectNav() {
  const target = $("projectNavList");
  if (!state.projects.length) {
    target.innerHTML = `<div class="empty-state" style="padding:14px 5px;color:#8F94A9;text-align:left">Nessun progetto ancora.</div>`;
    return;
  }
  target.innerHTML = [...state.projects].sort((a, b) => a.name.localeCompare(b.name, "it")).map((project) => {
    const openCount = state.tasks.filter((task) => task.projectId === project.id && task.status !== "Done").length;
    return `<button class="project-nav-item ${project.id === selectedProjectId && activeSection === "project" ? "is-selected" : ""}" data-action="open-project" data-id="${project.id}" title="${escapeHtml(project.name)}" type="button">
      <span class="project-nav-dot" style="background:${escapeHtml(project.accentColor)}"></span><span class="project-nav-copy"><span class="project-nav-name">${escapeHtml(project.name)}</span></span><span class="project-nav-count" aria-label="${openCount} attività aperte">${openCount}</span><svg class="icon" aria-hidden="true"><use href="#icon-chevron" /></svg>
    </button>`;
  }).join("");
}

function updateProjectNavSelection() {
  $$(".project-nav-item").forEach((button) => {
    button.classList.toggle("is-selected", activeSection === "project" && button.dataset.id === selectedProjectId);
  });
}

function renderOverview() {
  const today = new Date();
  $("overviewGreetingText").textContent = today.getHours() < 12 ? "Buongiorno" : today.getHours() < 18 ? "Buon pomeriggio" : "Buonasera";
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  $("overviewHintText").textContent = overviewHint(state.tasks, today);
  $("weekRangeText").textContent = formatDateRange(weekStart, weekEnd);
  setVisible("welcomePanel", state.projects.length === 0);
  setVisible("overviewProjectsEmpty", state.projects.length === 0);

  const openTasks = state.tasks.filter((task) => task.status !== "Done");
  const done = state.tasks.filter((task) => task.status === "Done");
  const risks = openTasks.filter((task) => task.dueDate && localDate(task.dueDate) <= addDays(today, 7));
  const thisWeek = done.filter((task) => task.completedAt && new Date(task.completedAt) >= weekStart && new Date(task.completedAt) < addDays(weekEnd, 1));
  thisWeek.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt) || a.title.localeCompare(b.title, "it"));
  thisWeek.splice(5);
  const activeProjects = state.projects.filter((project) => state.tasks.some((task) => task.projectId === project.id && task.status !== "Done"));
  renderKpiCards("summaryKpis", [
    ["Progetti attivi", activeProjects.length, "Con attività ancora aperte"],
    ["Attività aperte", openTasks.length, "Da fare e in corso"],
    ["Completate", thisWeek.length, "Durante questa settimana"],
    ["Rischi", risks.length, "Scadute o entro 7 giorni"]
  ]);

  const statusSummary = [
    ["Da fare", "Todo", "var(--text-secondary)"],
    ["In corso", "Doing", "var(--warning)"],
    ["Completate", "Done", "var(--success)"]
  ];
  $("statusSummaryList").innerHTML = statusSummary.map(([label, status, color]) => {
    const count = state.tasks.filter((task) => task.status === status).length;
    const percentage = state.tasks.length ? Math.round(count / state.tasks.length * 100) : 0;
    return `<div class="status-summary-row"><div class="status-summary-label"><span><i style="background:${color}"></i>${label}</span><strong>${count}</strong></div><div class="status-summary-track"><div style="width:${percentage}%;background:${color}"></div></div></div>`;
  }).join("");

  const focus = overviewFocusTasks(state.tasks, today);
  $("focusList").innerHTML = focus.map((task) => focusTaskCard(task)).join("");
  setVisible("focusEmpty", focus.length === 0);

  const projects = sortOverviewProjects(state.projects, state.tasks);
  $("overviewProjectList").innerHTML = projects.map((project) => projectSnapshot(project)).join("");
  $("weeklySummaryList").innerHTML = thisWeek.map((task) => `<div class="summary-task-item"><div class="summary-task-copy"><strong class="summary-task-title">${escapeHtml(task.title)}</strong><span class="summary-task-project">${escapeHtml(taskProject(task)?.name ?? "Progetto")}</span></div><span class="summary-task-completed">${escapeHtml(completedSummaryLabel(task.completedAt))}</span></div>`).join("");
  setVisible("weeklyEmpty", thisWeek.length === 0);

  const recent = [...state.tasks].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6);
  $("activityList").innerHTML = recent.map((task) => `<div class="activity-item"><span class="activity-dot" style="background:${escapeHtml(taskProject(task)?.accentColor ?? "#6C5CE7")}"></span><div class="activity-copy"><strong>“${escapeHtml(task.title)}” · ${escapeHtml(statusLabels[task.status])}${taskProject(task) ? ` · ${escapeHtml(taskProject(task).name)}` : ""}</strong><span>${escapeHtml(relativeTime(task.updatedAt || task.createdAt))}</span></div></div>`).join("");
  if (recent.length === 0) {
    const fallback = document.createElement("div");
    fallback.className = "activity-item";
    fallback.innerHTML = '<span class="activity-dot" style="background:#6C5CE7"></span><div class="activity-copy"><strong>Crea il primo progetto per iniziare.</strong><span>Adesso</span></div>';
    $("activityList").append(fallback);
  }
  setVisible("activityEmpty", false);
}

function projectSnapshot(project) {
  const tasks = state.tasks.filter((task) => task.projectId === project.id);
  const done = tasks.filter((task) => task.status === "Done").length;
  const percentage = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  return `<button class="mini-project" data-action="open-project" data-id="${project.id}" type="button"><div class="mini-project-meta"><span class="mini-project-name"><span class="project-nav-dot" style="display:inline-block;background:${escapeHtml(project.accentColor)}"></span> ${escapeHtml(project.name)}</span><span>${percentage}%</span></div><div class="progress-track"><div class="progress-bar" style="width:${percentage}%;background:${escapeHtml(project.accentColor)}"></div></div><div class="mini-project-meta"><span>${tasks.length - done} aperte</span><span>${tasks.length} attività</span></div></button>`;
}

function focusTaskCard(task) {
  const project = taskProject(task);
  return '<button class="focus-task-card" data-action="open-task" data-id="' + escapeHtml(task.id) + '" type="button">'
    + '<span class="focus-status-bar ' + task.status.toLowerCase() + '" aria-hidden="true"></span>'
    + '<span class="focus-task-copy"><strong>' + escapeHtml(task.title) + '</strong><span>' + escapeHtml(project?.name ?? "Progetto") + '</span></span>'
    + '<span class="focus-task-meta"><span class="' + dueClass(task) + '">' + escapeHtml(dueLabel(task)) + '</span><span>' + escapeHtml(priorityLabels[task.priority]) + '</span></span>'
    + '</button>';
}

function projectTaskCard(task) {
  const current = task.status;
  const previous = current === "Done" ? "Doing" : current === "Doing" ? "Todo" : null;
  const next = current === "Todo" ? "Doing" : current === "Doing" ? "Done" : null;
  const previousStatus = previous ?? current;
  const nextStatus = next ?? current;
  const tags = formatTaskTags(task.tags);
  const actions = '<button class="micro-button" data-action="move-task" data-id="' + escapeHtml(task.id) + '" data-status="' + escapeHtml(previousStatus) + '" type="button" title="Sposta allo stato precedente" aria-label="Sposta allo stato precedente"' + (previous ? "" : " disabled") + '><span class="wpf-chevron" aria-hidden="true">‹</span></button>'
    + '<button class="micro-button" data-action="move-task" data-id="' + escapeHtml(task.id) + '" data-status="' + escapeHtml(nextStatus) + '" type="button" title="Sposta allo stato successivo" aria-label="Sposta allo stato successivo"' + (next ? "" : " disabled") + '><span class="wpf-chevron" aria-hidden="true">›</span></button>'
    + '<button class="micro-button task-open-button" data-action="open-task" data-id="' + escapeHtml(task.id) + '" type="button" title="Apri dettagli" aria-label="Apri dettagli">Apri</button>';
  return '<article class="task-card ' + dueClass(task) + '" draggable="true" tabindex="-1" data-task-id="' + escapeHtml(task.id) + '">'
    + '<span class="task-status-bar ' + current.toLowerCase() + '" aria-hidden="true"></span>'
    + '<button class="task-card-title" data-action="open-task" data-id="' + escapeHtml(task.id) + '" type="button">' + escapeHtml(task.title) + '</button>'
    + '<div class="task-card-meta"><span class="task-status-label ' + current.toLowerCase() + '">' + escapeHtml(statusLabels[current]) + '</span><span class="priority-badge priority-' + task.priority.toLowerCase() + '">' + escapeHtml(priorityLabels[task.priority]) + '</span></div>'
    + '<div class="task-card-meta"><span>' + escapeHtml(assigneeLabel(task)) + '</span><span class="' + dueClass(task) + '">' + escapeHtml(dueLabel(task)) + '</span></div>'
    + (tags ? '<div class="task-card-tags">' + escapeHtml(tags) + '</div>' : "")
    + '<div class="task-card-footer"><span class="task-card-notes">' + escapeHtml(task.notes?.trim() || "Nessuna nota") + '</span><span class="task-card-actions">' + actions + '</span></div>'
    + '</article>';
}

function personCardMarkup({ person, open, workloadPercent }, index, fallbackDetails = true) {
  return '<article class="person-card"><div class="person-card-header"><div class="avatar" style="background:' + avatarColor(index) + '">' + escapeHtml(initials(personLabel(person))) + '</div><div class="person-copy"><h3>' + escapeHtml(personLabel(person)) + '</h3><p>' + escapeHtml(personDetails(person) || (fallbackDetails ? "Nessun ruolo specificato" : "")) + '</p></div><button class="person-edit" data-action="edit-person" data-id="' + escapeHtml(person.id) + '" type="button" title="Modifica persona">Modifica</button></div><div class="person-workload-row"><div class="person-workload-track"><div style="width:' + workloadPercent + '%;background:' + avatarColor(index) + '"></div></div><span>' + open + ' aperte</span></div></article>';
}

function renderProject() {
  const project = projectById(selectedProjectId);
  if (!project) {
    $("projectTitle").textContent = "Nessun progetto";
    $("projectTitle").title = "";
    $("projectDescription").textContent = "Crea un progetto per iniziare a organizzare il lavoro.";
    $("projectAccent").style.background = "var(--primary)";
    $("projectProgressBar").style.width = "0%";
    $("projectProgressBar").style.background = "var(--primary)";
    $("projectProgressBar").setAttribute("aria-valuenow", "0");
    $("projectProgressText").textContent = "0%";
    $("projectStatusText").textContent = "Da configurare";
    $("projectStatusText").classList.remove("is-danger");
    $("todoList").innerHTML = $("doingList").innerHTML = $("doneList").innerHTML = "";
    $("exportProjectHeaderButton").disabled = true;
    $("editProjectButton").disabled = true;
    $("deleteProjectHeaderButton").disabled = true;
    updateMutationControls();
    updateExportControls();
    return;
  }
  const allTasks = state.tasks.filter((task) => task.projectId === project.id);
  const visible = sortProjectTasks(allTasks.filter(taskMatchesFilters));
  const done = allTasks.filter((task) => task.status === "Done").length;
  const percentage = allTasks.length ? Math.round(done / allTasks.length * 100) : 0;
  const status = projectStatus(allTasks);
  $("projectTitle").textContent = project.name;
  $("projectTitle").title = project.name;
  $("projectDescription").textContent = project.description || "Aggiungi una descrizione per dare contesto al team.";
  $("projectStatusText").textContent = status.label;
  $("projectStatusText").classList.toggle("is-danger", status.danger);
  $("projectAccent").style.background = project.accentColor || "var(--primary)";
  $("projectProgressBar").style.width = `${percentage}%`;
  $("projectProgressBar").style.background = project.accentColor || "var(--primary)";
  $("projectProgressBar").setAttribute("aria-valuenow", String(percentage));
  $("projectProgressText").textContent = `${percentage}% completato`;
  $("exportProjectHeaderButton").disabled = false;
  $("editProjectButton").disabled = false;
  $("deleteProjectHeaderButton").disabled = false;
  $("todoCount").textContent = visible.filter((task) => task.status === "Todo").length;
  $("doingCount").textContent = visible.filter((task) => task.status === "Doing").length;
  $("doneCount").textContent = visible.filter((task) => task.status === "Done").length;
  for (const [status, listId, emptyId] of [["Todo", "todoList", "todoEmpty"], ["Doing", "doingList", "doingEmpty"], ["Done", "doneList", "doneEmpty"]]) {
    const tasks = visible.filter((task) => task.status === status);
    $(listId).innerHTML = tasks.map((task) => projectTaskCard(task)).join("");
    setVisible(emptyId, tasks.length === 0);
  }
  $("tasksTableBody").innerHTML = visible.map((task) => `<tr tabindex="0" data-action="open-task" data-id="${task.id}"><td><strong>${escapeHtml(task.title)}</strong><div class="table-subtext">${escapeHtml(task.tags || "")}</div></td><td><span class="status-pill ${task.status.toLowerCase()}">${statusLabels[task.status]}</span></td><td>${escapeHtml(assigneeCompactLabel(task))}</td><td><span class="priority-label priority-${task.priority.toLowerCase()}">${priorityLabels[task.priority]}</span></td><td class="${dueClass(task)}">${escapeHtml(dueLabel(task))}</td><td><button class="text-button" data-action="open-task" data-id="${task.id}" type="button">Apri</button></td></tr>`).join("");
  setVisible("listEmpty", visible.length === 0);
  $("tasksTable").classList.toggle("is-hidden", visible.length === 0);
  $("listEmpty").textContent = allTasks.length === 0
    ? "Questo progetto non ha ancora attività. Usa Aggiungi attività per iniziare."
    : "Nessuna attività corrisponde ai filtri. Usa Azzera filtri per rivederle.";
  $("filterCountText").textContent = visible.length === allTasks.length ? `${allTasks.length} attività` : `${visible.length} di ${allTasks.length} attività`;
  $("resetFiltersButton").disabled = !Boolean(projectSearch || statusFilter || personFilter);
  renderCalendar(visible);
  updateProjectSelectors();
  updateMutationControls();
  updateExportControls();
}

function renderCalendar(tasks) {
  const end = addDays(calendarWeekStart, 6);
  $("calendarRangeText").textContent = formatDateRange(calendarWeekStart, end);
  $("calendarGrid").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(calendarWeekStart, index);
    const dayTasks = tasks.filter((task) => task.dueDate && sameDay(localDate(task.dueDate), day));
    return `<article class="calendar-day ${sameDay(day, new Date()) ? "is-today" : ""}"><div class="calendar-day-header"><span>${escapeHtml(calendarDayLabel(day))}</span><strong>${day.getDate()}</strong></div>${dayTasks.map((task) => `<button class="calendar-task ${task.status.toLowerCase()}" data-action="open-task" data-id="${task.id}" type="button"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(assigneeCompactLabel(task))}</span></button>`).join("")}</article>`;
  }).join("");
  updateCalendarScrollAffordance();
}

function updateCalendarScrollAffordance() {
  const grid = $("calendarGrid");
  const frame = $("calendarScrollFrame");
  const hint = $("calendarScrollHint");
  const hintText = $("calendarScrollHintText");
  if (!grid || !frame || !hint) return;
  const canScroll = grid.scrollWidth > grid.clientWidth + 1;
  const hasMoreLeft = grid.scrollLeft > 1;
  const hasMoreRight = grid.scrollLeft < grid.scrollWidth - grid.clientWidth - 1;
  frame.classList.toggle("is-scrollable", canScroll);
  frame.classList.toggle("has-more-left", canScroll && hasMoreLeft);
  frame.classList.toggle("has-more-right", canScroll && hasMoreRight);
  setVisible("calendarScrollHint", canScroll);
  if (hintText) {
    hintText.textContent = hasMoreRight
      ? (hasMoreLeft ? "Scorri per vedere gli altri giorni" : "Scorri per vedere gli altri giorni a destra")
      : "Scorri verso sinistra per tornare indietro";
  }
}

function renderKpiCards(targetId, kpis) {
  $(targetId).innerHTML = kpis.map(([label, value, hint]) => (
    '<article class="kpi-card"><div class="kpi-label">'
    + escapeHtml(label)
    + '</div><div class="kpi-value">'
    + escapeHtml(value)
    + '</div><div class="kpi-hint">'
    + escapeHtml(hint)
    + "</div></div></article>"
  )).join("");
}

function renderMyWork() {
  const people = sortPeopleByName(state.people);
  const snapshot = myWorkSnapshot(state.tasks, myWorkPersonId, new Date());
  const todo = snapshot.todo;
  const doing = snapshot.doing;
  const due = snapshot.due;
  const completed = snapshot.completed;
  const selector = $("myWorkPerson");
  selector.innerHTML = `<option value="">Tutte le persone</option>${people.map((person) => `<option value="${person.id}">${escapeHtml(personLabel(person))}</option>`).join("")}`;
  selector.value = myWorkPersonId;
  const unassignedOption = document.createElement("option");
  unassignedOption.value = "unassigned";
  unassignedOption.textContent = "Non assegnate";
  selector.insertBefore(unassignedOption, selector.options[1] ?? null);
  renderKpiCards("myWorkKpis", [
    ["Da fare", snapshot.metrics.todo, "Nel perimetro selezionato"],
    ["In corso", snapshot.metrics.doing, "Lavoro attivo"],
    ["Scadute", snapshot.metrics.overdue, "Richiedono attenzione"],
    ["Fatte questa settimana", snapshot.metrics.completedThisWeek, "Nella settimana corrente"]
  ]);
  fillTaskList("myTodoList", "myTodoEmpty", todo);
  fillTaskList("myDoingList", "myDoingEmpty", doing);
  fillTaskList("myDueList", "myDueEmpty", due);
  $("myCompletedList").innerHTML = completed.map((task) => focusTaskCard(task)).join("");
  $("completedSummary").textContent = `Completate (${completed.length})`;
}

function fillTaskList(listId, emptyId, tasks) {
  $(listId).innerHTML = tasks.map((task) => focusTaskCard(task)).join("");
  setVisible(emptyId, tasks.length > 0 ? false : true);
}

function renderPeople() {
  $("peopleCount").textContent = state.people.length;
  const peopleView = peopleSnapshot(state.people, state.tasks);
  $("peopleAssignedCount").textContent = peopleView.assignedTaskCount;
  $("peopleWorkload").textContent = peopleView.workloadText;
  $("peopleList").innerHTML = peopleView.people.map(personCardMarkup).join("");
  setVisible("peopleEmpty", state.people.length === 0);
}

function renderReports() {
  const selector = $("reportProjectSelect");
  const current = selector.value;
  selector.innerHTML = `<option value="">Seleziona un progetto</option>${[...state.projects].sort((a, b) => a.name.localeCompare(b.name, "it")).map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("")}`;
  selector.value = state.projects.some((project) => project.id === current) ? current : (selectedProjectId ?? "");
  updateReportSelection();
}

function updateReportSelection() {
  const project = projectById($("reportProjectSelect").value);
  $("reportProjectName").textContent = project?.name ?? "Crea un progetto per esportarne il report.";
  $("exportProjectButton").disabled = !project || exportInProgress;
}

function updateProjectSelectors() {
  const projectSelect = $("taskProject");
  const previous = projectSelect.value || selectedProjectId || "";
  projectSelect.innerHTML = [...state.projects].sort((a, b) => a.name.localeCompare(b.name, "it")).map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
  if (state.projects.some((project) => project.id === previous)) projectSelect.value = previous;
  projectSelect.disabled = state.projects.length <= 1;
  const personSelect = $("personFilter");
  const selected = personSelect.value || personFilter;
  personSelect.innerHTML = `<option value="">Tutte le persone</option><option value="unassigned">Non assegnate</option>${sortPeopleByName(state.people).map((person) => `<option value="${person.id}">${escapeHtml(personLabel(person))}</option>`).join("")}`;
  personSelect.value = selected;
}

function openProject(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  const open = () => {
    selectedProjectId = project.id;
    activeSection = "project";
    projectSearch = "";
    statusFilter = "";
    personFilter = "";
    $("projectSearch").value = "";
    $("statusFilter").value = "";
    $("personFilter").value = "";
    refreshAll();
  };
  if (!$('taskDrawer').classList.contains("is-hidden") && selectedProjectId !== project.id) {
    confirmCloseEditor(open);
    return;
  }
  open();
}

function moveProjectNavFocus(key) {
  const items = $$(".project-nav-item");
  const currentIndex = items.indexOf(document.activeElement);
  if (currentIndex < 0 || items.length === 0) return;
  const nextIndex = key === "Home"
    ? 0
    : key === "End"
      ? items.length - 1
      : Math.max(0, Math.min(items.length - 1, currentIndex + (key === "ArrowUp" ? -1 : 1)));
  const next = items[nextIndex];
  if (!next || next === document.activeElement) return;
  const projectId = next.dataset.id;
  openProject(projectId);
  const focused = $$(".project-nav-item").find((item) => item.dataset.id === selectedProjectId)
    ?? $$(".project-nav-item").find((item) => item.dataset.id === projectId);
  focused?.focus();
}

function showNoProjectNotice() {
  globalThis.alert?.("Crea o seleziona un progetto prima di aggiungere un’attività.");
}

function openQuickCreateTask() {
  if (!state.projects.length) {
    openProjectDialog();
    return;
  }
  selectedProjectId = projectById(selectedProjectId)?.id
    ?? firstProjectByName(state.projects)?.id;
  activeSection = "project";
  refreshAll();
  openTaskDrawer();
}

function openTaskDrawer(task = null) {
  if (!state.projects.length) {
    showNoProjectNotice();
    return;
  }
  if (!$('taskDrawer').classList.contains("is-hidden") && editingTaskId !== (task?.id ?? null)) {
    confirmCloseEditor(() => openTaskDrawer(task));
    return;
  }
  if (task) {
    const project = projectById(task.projectId);
    if (project) {
      selectedProjectId = project.id;
      activeSection = "project";
      projectSearch = "";
      statusFilter = "";
      personFilter = "";
      refreshAll();
    }
  }
  editorReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  editorReturnTaskId = task?.id ?? null;
  editingTaskId = task?.id ?? null;
  updateProjectSelectors();
  const project = task ? taskProject(task) : projectById(selectedProjectId) ?? firstProjectByName(state.projects);
  $("taskProject").value = project?.id ?? "";
  $("taskTitle").value = task?.title ?? "";
  $("taskStatus").value = task?.status ?? "Todo";
  $("taskPriority").value = task?.priority ?? "Medium";
  $("taskDueDate").value = formatItalianDate(task?.dueDate);
  closeDueDateCalendar();
  $("taskNotes").value = task?.notes ?? "";
  $("taskTags").value = task?.tags ?? "";
  $("taskConclusions").value = task?.conclusions ?? "";
  renderAssigneeOptions(task?.assigneePersonIds ?? []);
  $("editorTitle").textContent = task ? "Dettagli attività" : "Nuova attività";
  $("saveTaskButton").textContent = task ? "Salva modifiche" : "Aggiungi attività";
  setVisible("deleteTaskButton", Boolean(task));
  setVisible("taskError", false);
  editorBaseline = editorSnapshot();
  refreshEditorState();
  setVisible("drawerBackdrop", true);
  setVisible("taskDrawer", true);
  $("appShell").inert = true;
  $("appShell").setAttribute("aria-hidden", "true");
  document.body.classList.add("drawer-open");
  setTimeout(() => $("taskTitle").focus(), 0);
}

function renderAssigneeOptions(selectedIds) {
  setVisible("assigneesEmpty", state.people.length === 0);
  const people = sortPeopleByName(state.people);
  $("taskAssignees").innerHTML = people.map((person, index) => `<label class="assignee-option"><input type="checkbox" value="${person.id}" ${selectedIds.includes(person.id) ? "checked" : ""} /><span class="avatar" style="width:26px;height:26px;background:${avatarColor(index)}">${escapeHtml(initials(personLabel(person)))}</span><span>${escapeHtml(personAssignmentLabel(person))}</span></label>`).join("");
  refreshAssigneeSummary();
  $("assigneePicker").open = false;
}

function refreshAssigneeSummary() {
  const selected = $$('input[type="checkbox"]:checked', $("taskAssignees"))
    .map((input) => personById(input.value))
    .filter(Boolean)
    .map(personLabel);
  $("taskAssigneesSummary").textContent = selected.length === 0 ? "Nessuna persona" : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`;
}

function editorSnapshot() {
  return JSON.stringify({
    title: $("taskTitle").value,
    project: $("taskProject").value,
    status: $("taskStatus").value,
    priority: $("taskPriority").value,
    dueDate: $("taskDueDate").value,
    notes: $("taskNotes").value,
    tags: $("taskTags").value,
    conclusions: $("taskConclusions").value,
    assignees: $$('input[type="checkbox"]:checked', $("taskAssignees")).map((input) => input.value).sort()
  });
}

function refreshEditorState() {
  if ($("taskDrawer").classList.contains("is-hidden")) return;
  const dirty = editorSnapshot() !== editorBaseline;
  $("editorState").textContent = dirty
    ? "Modifiche non salvate · Ctrl+S per salvare"
    : editingTaskId ? "Nessuna modifica da salvare." : "Solo il titolo è obbligatorio.";
}

function confirmCloseEditor(continuation = null) {
  if ($("taskDrawer").classList.contains("is-hidden")) return true;
  if (editorSnapshot() === editorBaseline) {
    closeTaskDrawer();
    continuation?.();
    return true;
  }
  pendingEditorClose = continuation;
  const dialog = $("unsavedTaskDialog");
  if (!dialog.open) dialog.showModal();
  return false;
}

async function resolveEditorClose(choice) {
  const continuation = pendingEditorClose;
  pendingEditorClose = null;
  $("unsavedTaskDialog").close();
  if (choice === "cancel") {
    settleTauriClose(false);
    return;
  }
  if (choice === "discard") {
    closeTaskDrawer();
    continuation?.();
    return;
  }
  const saved = await saveTask();
  if (saved) continuation?.();
  else settleTauriClose(false);
}

function closeTaskDrawer() {
  const previousFocus = editorReturnFocus;
  const previousTaskId = editorReturnTaskId;
  editorReturnFocus = null;
  editorReturnTaskId = null;
  editingTaskId = null;
  editorBaseline = "";
  closeDueDateCalendar();
  setVisible("drawerBackdrop", false);
  setVisible("taskDrawer", false);
  $("appShell").inert = false;
  $("appShell").removeAttribute("aria-hidden");
  document.body.classList.remove("drawer-open");
  if (previousFocus?.isConnected && !previousFocus.disabled && previousFocus.offsetParent !== null) {
    previousFocus.focus();
    return;
  }
  if (previousTaskId) {
    const taskButton = $$('[data-action="open-task"]').find((button) => button.dataset.id === previousTaskId);
    if (taskButton) {
      taskButton.focus();
      return;
    }
  }
  $("addTaskButton")?.focus();
}

function rememberDialogFocus(dialogId) {
  const active = document.activeElement;
  dialogReturnFocus.set(dialogId, active instanceof HTMLElement ? active : null);
}

function restoreDialogFocus(dialogId, fallbackId) {
  const previous = dialogReturnFocus.get(dialogId);
  dialogReturnFocus.delete(dialogId);
  if (previous?.isConnected && !previous.disabled && previous.offsetParent !== null) {
    previous.focus();
    return;
  }
  const fallback = $(fallbackId);
  if (fallback?.isConnected && !fallback.disabled && fallback.offsetParent !== null) fallback.focus();
}

function projectDialogSnapshot() {
  return JSON.stringify({
    name: $("projectName").value,
    description: $("projectDescriptionInput").value
  });
}

function personDialogSnapshot() {
  return JSON.stringify({
    firstName: $("personFirstName").value,
    lastName: $("personLastName").value,
    role: $("personRole").value,
    company: $("personCompany").value
  });
}

function dialogSnapshot(dialogId) {
  return dialogId === "projectDialog" ? projectDialogSnapshot() : personDialogSnapshot();
}

function dialogBaseline(dialogId) {
  return dialogId === "projectDialog" ? projectDialogBaseline : personDialogBaseline;
}

function requestDialogCloseConfirmation(dialogId) {
  const baseline = dialogBaseline(dialogId);
  if (!baseline || baseline === dialogSnapshot(dialogId)) return Promise.resolve(true);
  if (pendingDialogClose) return pendingDialogClose.promise;

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const promise = new Promise((resolve) => {
    pendingDialogClose = { dialogId, previousFocus, promise: null, resolve };
  });
  pendingDialogClose.promise = promise;
  const dialog = $("unsavedDialog");
  if (!dialog.open) dialog.showModal();
  setTimeout(() => $("unsavedDialog").querySelector('[data-dialog-choice="cancel"]')?.focus(), 0);
  return promise;
}

function resolveDialogClose(choice) {
  const pending = pendingDialogClose;
  if (!pending) return;
  pendingDialogClose = null;
  if ($("unsavedDialog").open) $("unsavedDialog").close();
  pending.resolve(choice === "discard");
  if (choice !== "discard" && pending.previousFocus?.isConnected) {
    setTimeout(() => pending.previousFocus.focus(), 0);
  }
}

function requestActionConfirmation({ title, message, confirmLabel = "Sì", cancelLabel = "No", danger = true }) {
  if (pendingActionConfirmation) return pendingActionConfirmation.promise;
  const dialog = $("actionConfirmDialog");
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const promise = new Promise((resolve) => {
    pendingActionConfirmation = { promise: null, previousFocus, resolve };
  });
  pendingActionConfirmation.promise = promise;
  $("actionConfirmDialogTitle").textContent = title;
  $("actionConfirmDialogMessage").textContent = message;
  const cancelButton = dialog.querySelector('[data-confirm-choice="cancel"]');
  const confirmButton = dialog.querySelector('[data-confirm-choice="confirm"]');
  cancelButton.textContent = cancelLabel;
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle("danger-button", danger);
  confirmButton.classList.toggle("primary-button", !danger);
  if (!dialog.open) dialog.showModal();
  setTimeout(() => cancelButton.focus(), 0);
  return promise;
}

function resolveActionConfirmation(choice) {
  const pending = pendingActionConfirmation;
  if (!pending) return;
  pendingActionConfirmation = null;
  const dialog = $("actionConfirmDialog");
  if (dialog.open) dialog.close();
  pending.resolve(choice === "confirm");
  if (choice !== "confirm" && pending.previousFocus?.isConnected) {
    setTimeout(() => pending.previousFocus.focus(), 0);
  }
}

function settleTauriClose(allowed) {
  const resolve = pendingTauriClose;
  pendingTauriClose = null;
  resolve?.(allowed);
}

function getTauriCloseBlocker() {
  if (exportInProgress) return "export";
  if (!$('taskDrawer').classList.contains("is-hidden") && editorSnapshot() !== editorBaseline) return "task";
  if ($("projectDialog")?.open && projectDialogSnapshot() !== projectDialogBaseline) return "project";
  if ($("personDialog")?.open && personDialogSnapshot() !== personDialogBaseline) return "person";
  return null;
}

function requestTauriCloseDecision() {
  return new Promise((resolve) => {
    pendingTauriClose = resolve;
    const closedImmediately = confirmCloseEditor(() => settleTauriClose(true));
    if (closedImmediately && pendingTauriClose) settleTauriClose(true);
  });
}

async function forceTauriClose() {
  if (!tauriCloseWindow) return;
  tauriClosing = true;
  try {
    if (typeof tauriCloseWindow.destroy === "function") {
      await tauriCloseWindow.destroy();
    } else if (typeof tauriCloseWindow.close === "function") {
      await tauriCloseWindow.close();
    }
  } catch (error) {
    tauriClosing = false;
    await nativeBridge.logError(`Errore chiusura finestra Tauri: ${error.message}`);
  }
}

async function installTauriCloseGuard() {
  const getCurrentWindow = globalThis.window?.__TAURI__?.window?.getCurrentWindow;
  if (typeof getCurrentWindow !== "function") return;

  try {
    const currentWindow = getCurrentWindow();
    if (!currentWindow || typeof currentWindow.onCloseRequested !== "function") return;
    tauriCloseWindow = currentWindow;
    await currentWindow.onCloseRequested(async (event) => {
      if (tauriClosing) return;
      const blocker = getTauriCloseBlocker();
      if (!blocker) return;

      event.preventDefault();
      if (blocker === "export") {
        globalThis.alert?.("Attendi la fine dell’esportazione prima di chiudere.");
        return;
      }
      if (blocker === "task") {
        if (pendingTauriClose) return;
        const allowed = await requestTauriCloseDecision();
        if (allowed) await forceTauriClose();
        return;
      }

      const allowed = await requestDialogCloseConfirmation(blocker === "project" ? "projectDialog" : "personDialog");
      if (allowed) await forceTauriClose();
    });
  } catch (error) {
    tauriCloseWindow = null;
    await nativeBridge.logError(`Errore installazione guard chiusura Tauri: ${error.message}`);
  }
}

function trapTaskDrawerFocus(event) {
  if (event.key !== "Tab" || $("taskDrawer").classList.contains("is-hidden")) return false;
  if ($("unsavedTaskDialog")?.open) return false;
  const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])', $("taskDrawer"))
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) {
    event.preventDefault();
    return true;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

async function saveTask() {
  const title = $("taskTitle").value.trim();
  if (!title) {
    $("taskError").textContent = "Inserisci un titolo per salvare l’attività.";
    setVisible("taskError", true);
    $("taskTitle").focus();
    return false;
  }
  const project = projectById($("taskProject").value);
  if (!project) {
    $("taskError").textContent = "Seleziona un progetto valido.";
    setVisible("taskError", true);
    return false;
  }
  const selectedAssignees = $$('input[type="checkbox"]:checked', $("taskAssignees")).map((input) => input.value);
  const dueDateText = $("taskDueDate").value.trim();
  const dueDate = parseItalianDate(dueDateText);
  if (dueDateText && !dueDate) {
    $("taskError").textContent = "La scadenza non è valida. Usa gg/mm/aaaa oppure lascia il campo vuoto.";
    setVisible("taskError", true);
    $("taskDueDate").focus();
    return false;
  }
  const form = {
    projectId: project.id,
    title,
    notes: $("taskNotes").value.trim() || null,
    conclusions: $("taskConclusions").value.trim() || null,
    tags: $("taskTags").value.trim() || null,
    status: $("taskStatus").value,
    priority: $("taskPriority").value,
    assigneePersonIds: selectedAssignees,
    dueDate
  };
  let target = editingTaskId ? taskById(editingTaskId) : null;
  const isEditing = Boolean(editingTaskId);
  try {
    if (target) await service.updateTask(target, form);
    else target = await service.addTask(project, form.title, form.notes, form.assigneePersonIds, form.dueDate, form.conclusions, form.priority, form.tags, form.status);
    state = service.state;
  } catch (error) {
    refreshAll();
    $("taskError").textContent = `Salvataggio non riuscito. I campi restano qui: correggi il problema e riprova. ${error.message}`;
    setVisible("taskError", true);
    return false;
  }
  selectedProjectId = project.id;
  projectSearch = "";
  statusFilter = "";
  personFilter = "";
  refreshAll();
  editorReturnFocus = null;
  editorReturnTaskId = target.id;
  closeTaskDrawer();
  showToast(isEditing ? "Attività aggiornata" : "Attività aggiunta", "Il workspace è stato salvato automaticamente.");
  return true;
}

async function moveTask(task, status) {
  if (!task) return;
  try {
    await service.setTaskStatus(task, status);
    state = service.state;
    refreshAll();
    restoreTaskFocus(task);
  } catch (error) {
    refreshAll();
    showToast("Stato non aggiornato", error.message);
    return;
  }
  showToast("Stato aggiornato", `“${task.title}” ora è ${statusLabels[status].toLowerCase()}.`);
}

function restoreTaskFocus(task) {
  const card = $$(".task-card").find((item) => item.dataset.taskId === task?.id);
  if (card) {
    card.focus();
    card.scrollIntoView({ block: "nearest" });
    return;
  }
  $("addTaskButton")?.focus();
}

async function deleteTask(task) {
  if (!task || !await requestActionConfirmation({
    title: "Elimina attività",
    message: `Eliminare l’attività “${task.title}”?\nPuoi recuperare l’ultima eliminazione fino alla chiusura dell’app.`
  })) return;
  try {
    await service.deleteTask(task);
    state = service.state;
  } catch (error) {
    refreshAll();
    showToast("Attività non eliminata", error.message);
    return;
  }
  setUndo(() => service.undoDelete());
  closeTaskDrawer();
  refreshAll();
  $("addTaskButton")?.focus();
  showToast("Attività eliminata", `“${task.title}” è stata rimossa.`);
}

function openProjectDialog(project = null) {
  rememberDialogFocus("projectDialog");
  editingProjectId = project?.id ?? null;
  $("projectDialogTitle").textContent = project ? "Modifica progetto" : "Nuovo progetto";
  $("saveProjectButton").textContent = project ? "Salva modifiche" : "Crea progetto";
  $("projectName").value = project?.name ?? "";
  $("projectDescriptionInput").value = project?.description ?? "";
  projectDialogBaseline = projectDialogSnapshot();
  setVisible("projectError", false);
  $("projectDialog").showModal();
  setTimeout(() => { $("projectName").focus(); $("projectName").select(); }, 0);
}

async function saveProject() {
  const name = $("projectName").value.trim();
  if (!name) {
    $("projectError").textContent = "Inserisci un nome per il progetto.";
    setVisible("projectError", true);
    $("projectName").focus();
    return;
  }
  const description = $("projectDescriptionInput").value.trim() || null;
  let project = editingProjectId ? projectById(editingProjectId) : null;
  try {
    if (project) await service.updateProject(project, name, description);
    else project = await service.addProject(name, description);
    state = service.state;
  } catch (error) {
    refreshAll();
    $("projectError").textContent = `Salvataggio non riuscito. I dati restano qui: ${error.message}`;
    setVisible("projectError", true);
    return;
  }
  selectedProjectId = project.id;
  activeSection = "project";
  refreshAll();
  $("projectDialog").close();
  showToast(editingProjectId ? "Progetto aggiornato" : "Progetto creato", editingProjectId ? "Nome e descrizione sono stati salvati." : `“${project.name}” è pronto per essere pianificato.`);
}

async function deleteProject(project) {
  if (!project || !await requestActionConfirmation({
    title: "Elimina progetto",
    message: `Eliminare il progetto “${project.name}” e tutte le sue attività?\nPuoi recuperare l’ultima eliminazione fino alla chiusura dell’app.`
  })) return;
  try {
    await service.deleteProject(project);
    state = service.state;
  } catch (error) {
    refreshAll();
    showToast("Progetto non eliminato", error.message);
    return;
  }
  setUndo(() => service.undoDelete());
  selectedProjectId = firstProjectByName(state.projects)?.id ?? null;
  activeSection = "overview";
  refreshAll();
  $("projectDialog").close();
  showToast("Progetto eliminato", `“${project.name}” è stato rimosso dal workspace.`);
}

function openPersonDialog(person = null) {
  rememberDialogFocus("personDialog");
  editingPersonId = person?.id ?? null;
  $("personDialogTitle").textContent = person ? "Modifica persona" : "Nuova persona";
  $("savePersonButton").textContent = person ? "Salva modifiche" : "Aggiungi persona";
  $("personDialogAvatar").textContent = person ? initials(displayName(person)) : "+";
  $("personFirstName").value = person?.firstName ?? "";
  $("personLastName").value = person?.lastName ?? "";
  $("personRole").value = person?.role ?? "";
  $("personCompany").value = person?.company ?? "";
  personDialogBaseline = personDialogSnapshot();
  setVisible("deletePersonButton", Boolean(person));
  setVisible("personError", false);
  $("personDialog").showModal();
  setTimeout(() => { $("personFirstName").focus(); $("personFirstName").select(); }, 0);
}

async function savePerson() {
  const firstName = $("personFirstName").value.trim();
  if (!firstName) {
    $("personError").textContent = "Inserisci il nome della persona.";
    setVisible("personError", true);
    $("personFirstName").focus();
    return;
  }
  const values = { firstName, lastName: $("personLastName").value.trim(), role: $("personRole").value.trim(), company: $("personCompany").value.trim() };
  let person = editingPersonId ? personById(editingPersonId) : null;
  try {
    if (person) await service.updatePerson(person, values.firstName, values.lastName, values.role, values.company);
    else person = await service.addPerson(values.firstName, values.lastName, values.role, values.company);
    state = service.state;
  } catch (error) {
    refreshAll();
    $("personError").textContent = `Salvataggio non riuscito. I dati restano qui: ${error.message}`;
    setVisible("personError", true);
    return;
  }
  refreshAll();
  $("personDialog").close();
  showToast(editingPersonId ? "Persona aggiornata" : "Persona aggiunta", "Il team è stato aggiornato.");
}

async function deletePerson(person) {
  if (!person || !await requestActionConfirmation({
    title: "Elimina persona",
    message: `Eliminare “${displayName(person)}”? Verrà rimossa dalle attività assegnate. Puoi recuperare l’ultima eliminazione fino alla chiusura dell’app.`
  })) return;
  try {
    await service.deletePerson(person);
    state = service.state;
  } catch (error) {
    refreshAll();
    showToast("Persona non rimossa", error.message);
    return;
  }
  setUndo(() => service.undoDelete());
  refreshAll();
  $("personDialog").close();
  showToast("Persona eliminata", `${displayName(person)} è stata rimossa dal workspace.`);
}

function refreshSearch() {
  const query = searchQuery.trim();
  if (!query) {
    setVisible("searchSurface", false);
    showSection(activeSection);
    return;
  }
  const result = searchWorkspace(state, query);
  setVisible("searchSurface", true);
  $$(".view-panel").forEach((panel) => setVisible(panel.id, false));
  $("searchCountText").textContent = `${result.tasks.length} attività · ${result.projects.length} progetti · ${result.people.length} persone`;
  $("searchTaskItems").innerHTML = result.tasks.map((task) => focusTaskCard(task)).join("");
  $("searchProjectItems").innerHTML = result.projects.map(projectSnapshot).join("");
  const peopleRows = peopleSearchSnapshot(result.people, state.tasks);
  $("searchPersonItems").innerHTML = peopleRows.map((row, index) => personCardMarkup(row, index, false)).join("");
  setVisible("searchTasksSection", result.tasks.length > 0);
  setVisible("searchProjectsSection", result.projects.length > 0);
  setVisible("searchPeopleSection", result.people.length > 0);
  setVisible("searchTasksHeading", result.tasks.length > 0);
  setVisible("searchProjectsHeading", result.projects.length > 0);
  setVisible("searchPeopleHeading", result.people.length > 0);
  setVisible("searchEmpty", result.tasks.length + result.projects.length + result.people.length === 0);
}

function safeFileName(value) {
  return String(value ?? "").trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-") || "Progetto";
}

function reportFileDate(value = new Date()) {
  const pad = (part) => String(part).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}_${pad(value.getHours())}${pad(value.getMinutes())}`;
}

function nativeDialogUnavailable(error) {
  return /dialogo di salvataggio non è disponibile|nessun dialogo di salvataggio disponibile/i.test(String(error?.message ?? error));
}

async function saveReportFile(bytes, fileName, dialogTitle = "Esporta report") {
  if (!nativeInvoke) {
    downloadXlsx(bytes, fileName);
    return { saved: true, native: false };
  }

  let nativeResult;
  try {
    nativeResult = await nativeBridge.saveReport(bytes, fileName, dialogTitle);
  } catch (error) {
    if (!nativeDialogUnavailable(error)) throw error;
    downloadXlsx(bytes, fileName);
    return { saved: true, native: false, fallback: true };
  }
  const result = nativeResult ? { ...nativeResult, native: true } : { saved: false, native: true };
  if (!result?.saved) return result ?? { saved: false, native: true };

  if (result.path && await requestActionConfirmation({
    title: "Broject",
    message: "Report esportato correttamente. Vuoi aprirlo ora?",
    danger: false
  })) {
    try {
      const opened = await nativeBridge.openReport(result.path);
      if (opened?.opened === false) throw new Error("Il sistema non ha aperto il report.");
    } catch (error) {
      showToast("Report salvato", `Il report è stato salvato in:\n${result.path}\n\nNon è stato possibile aprirlo automaticamente. ${error.message}`);
    }
  }
  return result;
}

function setExportBusy(busy) {
  if (busy) {
    exportReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  exportInProgress = busy;
  setVisible("busyOverlay", busy);
  $("appShell").inert = Boolean(startupFailure) || busy;
  $("appShell").setAttribute("aria-busy", busy ? "true" : "false");
  updateMutationControls();
  updateExportControls();
  if (!busy) {
    const previousFocus = exportReturnFocus;
    exportReturnFocus = null;
    if (previousFocus?.isConnected && !previousFocus.disabled && previousFocus.offsetParent !== null) previousFocus.focus();
  }
}

function beginExport() {
  if (exportInProgress) return false;
  setExportBusy(true);
  return true;
}

function endExport() {
  setExportBusy(false);
}

globalThis.addEventListener("beforeunload", (event) => {
  if (exportInProgress) {
    event.preventDefault();
    event.returnValue = "Attendi la fine dell’esportazione prima di chiudere.";
    return;
  }
  if (!$('taskDrawer').classList.contains("is-hidden") && editorSnapshot() !== editorBaseline) {
    event.preventDefault();
    event.returnValue = "Vuoi salvare le modifiche prima di chiudere?";
    return;
  }
  const projectDialog = $("projectDialog");
  const personDialog = $("personDialog");
  if ((projectDialog?.open && projectDialogSnapshot() !== projectDialogBaseline)
    || (personDialog?.open && personDialogSnapshot() !== personDialogBaseline)) {
    event.preventDefault();
    event.returnValue = "Ci sono modifiche non salvate. Vuoi uscire senza salvarle?";
  }
});

function hasOpenModal() {
  return Boolean(document.querySelector("dialog[open]"));
}

async function runPortfolioExport() {
  if (!beginExport()) return;
  try {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const report = buildPortfolioReport(state);
    const fileName = `Broject_Resoconto_Generale_${reportFileDate()}.xlsx`;
    const result = await saveReportFile(createXlsxWorkbook(portfolioWorkbookSheets(report)), fileName, "Esporta report generale");
    if (result?.saved) {
      showToast(result.native ? "Report generale salvato" : "Report generale creato", result.native
        ? `Il workbook è stato salvato in ${result.path}.`
        : "Il workbook è stato scaricato ed è modificabile in Excel e LibreOffice.");
    }
  } catch (error) {
    showToast("Report non esportato", `Esportazione non riuscita. Controlla che il file non sia aperto e che la cartella sia scrivibile, poi riprova.\n\n${error.message}`);
  } finally {
    endExport();
  }
}

async function runProjectExport(project, finalNotes) {
  if (!beginExport()) return;
  try {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const report = buildProjectReport(state, project, finalNotes);
    const fileName = `Broject_${safeFileName(project.name)}_${reportFileDate()}.xlsx`;
    const result = await saveReportFile(createXlsxWorkbook(projectWorkbookSheets(report)), fileName, "Esporta report progetto");
    if (result?.saved) {
      showToast(result.native ? "Report progetto salvato" : "Report progetto creato", result.native
        ? `Il workbook è stato salvato in ${result.path}.`
        : "Il workbook è stato scaricato ed è modificabile in Excel e LibreOffice.");
    }
  } catch (error) {
    showToast("Report non esportato", `Esportazione non riuscita. Controlla che il file non sia aperto e che la cartella sia scrivibile, poi riprova.\n\n${error.message}`);
  } finally {
    endExport();
  }
}

function openProjectExportNotes(project = projectById($("reportProjectSelect").value)) {
  if (!project || exportInProgress) return;
  rememberDialogFocus("reportNotesDialog");
  pendingProjectExportId = project.id;
  $("reportNotes").value = "";
  $("reportNotesDialog").showModal();
  setTimeout(() => { $("reportNotes").focus(); $("reportNotes").select(); }, 0);
}

function openHelpDialog() {
  rememberDialogFocus("helpDialog");
  $("helpDialog").showModal();
  setTimeout(updateHelpScrollHint, 0);
}

function updateHelpScrollHint() {
  const copy = $("helpDialogIntro");
  const hint = $("helpScrollHint");
  if (!copy || !hint) return;
  setVisible("helpScrollHint", copy.scrollHeight > copy.clientHeight + 1);
}

function isTextEntryTarget(target) {
  return Boolean(target?.matches("input, textarea, select, summary, [contenteditable='true']")
    || target?.closest?.("[contenteditable='true']"));
}

function handleClick(event) {
  const target = event.target.closest("[data-action], [data-section], [data-project-view]");
  if (!target) return;
  if (target.dataset.section) {
    if (target.dataset.section === "project") return;
    showSection(target.dataset.section);
    return;
  }
  if (target.dataset.projectView) {
    setProjectView(target.dataset.projectView);
    return;
  }
  const { action, id, status } = target.dataset;
  if (action === "open-project") {
    openProject(id);
    return;
  }
  if (action === "open-task") {
    if (target.tagName === "TR") return;
    openTaskDrawer(taskById(id));
    return;
  }
  if (action === "move-task") { void moveTask(taskById(id), status); return; }
  if (action === "edit-person") { openPersonDialog(personById(id)); return; }
}

function handleDoubleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const taskRow = target?.closest('tr[data-action="open-task"]');
  const actionTarget = target?.closest("[data-action]");
  if (!taskRow || (actionTarget && actionTarget !== taskRow)) return;
  openTaskDrawer(taskById(taskRow.dataset.id));
}

function handleKeydown(event) {
  if (trapTaskDrawerFocus(event)) return;
  if ($("unsavedTaskDialog")?.open) return;
  if ($("actionConfirmDialog")?.open) return;
  const target = event.target instanceof Element ? event.target : null;
  const textEntryTarget = isTextEntryTarget(target);
  if (target?.classList.contains("project-nav-item")
    && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    moveProjectNavFocus(event.key);
    return;
  }
  const taskRow = target?.closest('tr[data-action="open-task"]');
  if (taskRow && event.key === "Enter") {
    event.preventDefault();
    openTaskDrawer(taskById(taskRow.dataset.id));
    return;
  }
  if (event.key === "Escape") {
    if (editingTaskId || !$("taskDrawer").classList.contains("is-hidden")) {
      event.preventDefault();
      if (!$('taskDueDateCalendar').classList.contains("is-hidden")) {
        closeDueDateCalendar(true);
        return;
      }
      const assigneePicker = $("assigneePicker");
      if (assigneePicker?.open) {
        assigneePicker.open = false;
        assigneePicker.querySelector("summary")?.focus();
        return;
      }
      confirmCloseEditor();
    } else if (!$("searchSurface").classList.contains("is-hidden")) {
      $("globalSearch").value = "";
      searchQuery = "";
      refreshSearch();
      $("globalSearch").focus();
    }
  }
  if ((event.key === "F1" || event.key === "?")
    && !textEntryTarget
    && !exportInProgress
    && $("taskDrawer").classList.contains("is-hidden")
    && !hasOpenModal()) {
    event.preventDefault();
    openHelpDialog();
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === "s" && !exportInProgress && !$("taskDrawer").classList.contains("is-hidden")) {
      event.preventDefault();
      void saveTask();
      return;
    }
    if (textEntryTarget || event.altKey) return;
    if (event.key.toLowerCase() === "k" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      $("globalSearch").focus();
      $("globalSearch").select();
      return;
    }
    if (event.key.toLowerCase() === "n" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      openQuickCreateTask();
      return;
    }
    if (!event.shiftKey && event.key === "1" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      showSection("overview");
      return;
    }
    if (!event.shiftKey && event.key === "2" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      showSection("my-work");
      return;
    }
    if (!event.shiftKey && event.key === "3" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      showSection("people");
      return;
    }
    if (!event.shiftKey && event.key === "4" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      showSection("reports");
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === "b" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      openProjectViewShortcut("board");
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === "l" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      openProjectViewShortcut("list");
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === "w" && !exportInProgress && $("taskDrawer").classList.contains("is-hidden") && !hasOpenModal()) {
      event.preventDefault();
      openProjectViewShortcut("calendar");
      return;
    }
  }
}

document.addEventListener("click", handleClick);
document.addEventListener("dblclick", handleDoubleClick);
document.addEventListener("keydown", handleKeydown);

$("globalSearch").addEventListener("input", (event) => { searchQuery = event.target.value; refreshSearch(); });
$("closeSearchButton").addEventListener("click", () => { $("globalSearch").value = ""; searchQuery = ""; refreshSearch(); $("globalSearch").focus(); });
$("quickCreateButton").addEventListener("click", openQuickCreateTask);
$("overviewCreateButton").addEventListener("click", openQuickCreateTask);
$("myWorkCreateButton").addEventListener("click", openQuickCreateTask);
$("addTaskButton").addEventListener("click", () => openTaskDrawer());
$("newProjectButton").addEventListener("click", () => openProjectDialog());
$("firstProjectButton").addEventListener("click", () => openProjectDialog());
$("overviewNewProjectButton").addEventListener("click", () => openProjectDialog());
$("exportProjectHeaderButton").addEventListener("click", () => openProjectExportNotes(projectById(selectedProjectId)));
$("editProjectButton").addEventListener("click", () => openProjectDialog(projectById(selectedProjectId)));
$("deleteProjectHeaderButton").addEventListener("click", () => { void deleteProject(projectById(selectedProjectId)); });
$("helpButton").addEventListener("click", openHelpDialog);
$("storageLocationButton").addEventListener("click", () => { void openStorageDialog(); });
$("storageChooseButton").addEventListener("click", () => { void chooseStorageLocation(); });
$("storageUseButton").addEventListener("click", () => { void applyStorageLocation("use-existing"); });
$("storageCopyButton").addEventListener("click", () => { void applyStorageLocation("copy"); });
$("addPersonButton").addEventListener("click", () => openPersonDialog());
$("closeDrawerButton").addEventListener("click", () => confirmCloseEditor());
$("drawerBackdrop").addEventListener("click", () => confirmCloseEditor());
$("cancelTaskButton").addEventListener("click", () => confirmCloseEditor());
$("taskDueDateCalendarButton").addEventListener("click", () => {
  if ($("taskDueDateCalendar").classList.contains("is-hidden")) openDueDateCalendar();
  else closeDueDateCalendar();
});
$("taskDueDateCalendar").addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!target) return;
  if (target.id === "taskDueDatePreviousMonth") {
    dueDateCalendarMonth = addDays(startOfMonth(dueDateCalendarMonth), -1);
    renderDueDateCalendar();
    return;
  }
  if (target.id === "taskDueDateNextMonth") {
    const nextMonth = startOfMonth(dueDateCalendarMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    dueDateCalendarMonth = nextMonth;
    renderDueDateCalendar();
    return;
  }
  const selectedDate = dateFromOnlyKey(target.dataset.date);
  if (!selectedDate) return;
  $("taskDueDate").value = formatItalianDate(selectedDate);
  $("taskDueDate").dispatchEvent(new Event("input", { bubbles: true }));
  $("taskDueDate").dispatchEvent(new Event("change", { bubbles: true }));
  closeDueDateCalendar(true);
});
$("taskDueDate").addEventListener("input", () => {
  if (!$('taskDueDateCalendar').classList.contains("is-hidden")) renderDueDateCalendar();
});
$("taskDueDate").addEventListener("blur", () => {
  const dueDateText = $("taskDueDate").value.trim();
  if (dueDateText && !parseItalianDate(dueDateText)) {
    $("taskError").textContent = `La scadenza ‘${dueDateText}’ non è valida. Usa gg/mm/aaaa oppure cancella il campo.`;
    setVisible("taskError", true);
  }
});
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest(".date-picker-shell") && !$('taskDueDateCalendar').classList.contains("is-hidden")) closeDueDateCalendar();
});
$$("[data-unsaved-choice]").forEach((button) => button.addEventListener("click", () => { void resolveEditorClose(button.dataset.unsavedChoice); }));
$("unsavedTaskDialog").addEventListener("cancel", (event) => { event.preventDefault(); void resolveEditorClose("cancel"); });
$("taskForm").addEventListener("submit", (event) => { event.preventDefault(); void saveTask(); });
$("taskForm").addEventListener("input", refreshEditorState);
$("taskForm").addEventListener("change", refreshEditorState);
$("taskAssignees").addEventListener("change", () => { refreshAssigneeSummary(); refreshEditorState(); });
$("deleteTaskButton").addEventListener("click", () => { void deleteTask(taskById(editingTaskId)); });
$("projectForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value !== "cancel") {
    void saveProject();
  } else {
    void requestDialogCloseConfirmation("projectDialog").then((allowed) => {
      if (allowed && $("projectDialog").open) $("projectDialog").close();
    });
  }
});
$("personForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value !== "cancel") {
    void savePerson();
  } else {
    void requestDialogCloseConfirmation("personDialog").then((allowed) => {
      if (allowed && $("personDialog").open) $("personDialog").close();
    });
  }
});
$("projectDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  void requestDialogCloseConfirmation("projectDialog").then((allowed) => {
    if (allowed && $("projectDialog").open) $("projectDialog").close();
  });
});
$("personDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  void requestDialogCloseConfirmation("personDialog").then((allowed) => {
    if (allowed && $("personDialog").open) $("personDialog").close();
  });
});
$("projectDialog").addEventListener("close", () => {
  projectDialogBaseline = "";
  restoreDialogFocus("projectDialog", "newProjectButton");
});
$("personDialog").addEventListener("close", () => {
  personDialogBaseline = "";
  restoreDialogFocus("personDialog", "addPersonButton");
});
$("unsavedDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  resolveDialogClose("cancel");
});
$$("[data-dialog-choice]").forEach((button) => button.addEventListener("click", () => resolveDialogClose(button.dataset.dialogChoice)));
$$('[data-confirm-choice]').forEach((button) => button.addEventListener("click", () => resolveActionConfirmation(button.dataset.confirmChoice)));
$('actionConfirmDialog').addEventListener("cancel", (event) => {
  event.preventDefault();
  resolveActionConfirmation("cancel");
});
$("reportNotesDialog").addEventListener("close", () => restoreDialogFocus("reportNotesDialog", "exportProjectButton"));
$("helpDialog").addEventListener("close", () => restoreDialogFocus("helpDialog", "helpButton"));
$("storageDialog").addEventListener("close", () => {
  if (!storageOperationInProgress) {
    clearStorageSelection();
    restoreDialogFocus("storageDialog", "storageLocationButton");
  }
});
$("deletePersonButton").addEventListener("click", () => { void deletePerson(personById(editingPersonId)); });
$("statusFilter").addEventListener("change", (event) => { statusFilter = event.target.value; renderProject(); });
$("personFilter").addEventListener("change", (event) => { personFilter = event.target.value; renderProject(); });
$("projectSearch").addEventListener("input", (event) => { projectSearch = event.target.value; renderProject(); });
$("resetFiltersButton").addEventListener("click", () => { projectSearch = ""; statusFilter = ""; personFilter = ""; $("projectSearch").value = ""; $("statusFilter").value = ""; $("personFilter").value = ""; renderProject(); $("projectSearch").focus(); });
$("myWorkPerson").addEventListener("change", (event) => { myWorkPersonId = event.target.value; renderMyWork(); });
$("reportProjectSelect").addEventListener("change", () => updateReportSelection());
$("exportPortfolioButton").addEventListener("click", runPortfolioExport);
$("exportProjectButton").addEventListener("click", () => openProjectExportNotes());
$("retryStartupButton").addEventListener("click", () => globalThis.location.reload());
$("reportNotesForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") { $("reportNotesDialog").close(); return; }
  const project = projectById(pendingProjectExportId);
  $("reportNotesDialog").close();
  if (project) runProjectExport(project, $("reportNotes").value);
});
$("previousWeekButton").addEventListener("click", () => { calendarWeekStart = addDays(calendarWeekStart, -7); renderCalendar(sortProjectTasks(state.tasks.filter(taskMatchesFilters))); });
$("nextWeekButton").addEventListener("click", () => { calendarWeekStart = addDays(calendarWeekStart, 7); renderCalendar(sortProjectTasks(state.tasks.filter(taskMatchesFilters))); });
$("currentWeekButton").addEventListener("click", () => { calendarWeekStart = startOfWeek(new Date()); renderCalendar(sortProjectTasks(state.tasks.filter(taskMatchesFilters))); });
$("calendarGrid").addEventListener("scroll", updateCalendarScrollAffordance);
window.addEventListener("resize", () => { updateCalendarScrollAffordance(); updateHelpScrollHint(); });
$("undoButton").addEventListener("click", async () => {
  if (!undoAction) return;
  try {
    await undoAction();
        state = service.state;
        clearUndo();
        refreshAll({ preserveSearch: true });
        showToast("Eliminazione annullata", "Gli elementi e le assegnazioni disponibili sono stati ripristinati.");
  } catch (error) {
    refreshAll();
    showToast("Ripristino non riuscito", error.message);
  }
});

for (const list of $$(".task-stack")) {
  list.addEventListener("dragover", (event) => { event.preventDefault(); list.closest(".board-column")?.classList.add("is-drag-over"); });
  list.addEventListener("dragleave", () => list.closest(".board-column")?.classList.remove("is-drag-over"));
  list.addEventListener("drop", (event) => {
    event.preventDefault();
    list.closest(".board-column")?.classList.remove("is-drag-over");
    const id = event.dataTransfer?.getData("text/plain");
    const status = list.dataset.status;
    if (!id || !status) return;
    const task = taskById(id);
    if (!task || task.status === status) return;
    void moveTask(task, status);
  });
}

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (!card || !event.dataTransfer) return;
  event.dataTransfer.setData("text/plain", card.dataset.taskId);
  card.classList.add("is-dragging");
});
document.addEventListener("dragend", (event) => event.target.closest("[data-task-id]")?.classList.remove("is-dragging"));

refreshAll();
void loadStorageLocation();
void installTauriCloseGuard();
