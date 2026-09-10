const priorityWeights = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

function asDate(value) {
  if (!value) return null;
  const source = value instanceof Date
    ? value
    : new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
  return Number.isFinite(source.getTime()) ? new Date(source) : null;
}

export function localDate(value) {
  return asDate(value);
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

/**
 * Parse the same short Italian date shape exposed by the WPF DatePicker.
 * Return the persisted date-only form so the UI never passes a UTC timestamp
 * through the task service.
 */
export function parseItalianDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function formatItalianDate(value) {
  const date = asDate(value);
  if (!date) return "";
  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function completedSummaryLabel(value) {
  const date = asDate(value);
  return date
    ? new Intl.DateTimeFormat("it-IT", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    : "Completata";
}

export function relativeTime(value, now = new Date()) {
  const local = asDate(value);
  if (!local) return "Adesso";
  const elapsed = new Date(now).getTime() - local.getTime();
  if (elapsed < 60_000) return "Adesso";
  if (elapsed < 3_600_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} min fa`;
  if (elapsed < 86_400_000) return `${Math.max(1, Math.floor(elapsed / 3_600_000))} h fa`;
  if (elapsed < 604_800_000) return `${Math.max(1, Math.floor(elapsed / 86_400_000))} g fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(local);
}

function startOfDay(value) {
  const result = asDate(value) ?? new Date();
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value, amount) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function dueTime(value) {
  return asDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
}

function completedTime(value) {
  return asDate(value)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "it");
}

function personDisplayName(person) {
  const name = `${String(person?.firstName ?? "")} ${String(person?.lastName ?? "")}`.trim();
  return name || "Senza nome";
}

function comparePriority(left, right) {
  return (priorityWeights[right.priority] ?? 0) - (priorityWeights[left.priority] ?? 0);
}

function compareDue(left, right) {
  return dueTime(left.dueDate) - dueTime(right.dueDate);
}

export function formatTaskTags(value) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 4)
    .map((tag) => "#" + tag)
    .join("  ");
}

export function taskDueLabel(task, today = new Date()) {
  const due = asDate(task.dueDate);
  if (due === null) return task.status === "Done" ? "Completata" : "Senza scadenza";
  const day = startOfDay(today);
  const dueDay = startOfDay(due);
  if (task.status !== "Done" && dueDay < day) {
    return "Scaduta da " + Math.round((day - dueDay) / 86400000) + "g";
  }
  if (dueDay.getTime() === day.getTime()) return "Oggi";
  if (dueDay.getTime() === addDays(day, 1).getTime()) return "Domani";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(dueDay);
}

export function taskDueTone(task, today = new Date()) {
  if (task.status === "Done") return "done";
  const due = asDate(task.dueDate);
  if (due === null) return "secondary";
  const day = startOfDay(today);
  if (startOfDay(due) < day) return "danger";
  if (startOfDay(due) <= addDays(day, 2)) return "warning";
  return "secondary";
}

export function overviewFocusTasks(tasks, today = new Date()) {
  const day = startOfDay(today);
  const limit = addDays(day, 7);
  return [...(tasks ?? [])]
    .filter((task) => {
      if (task.status === "Done") return false;
      const due = asDate(task.dueDate);
      return task.priority === "High"
        || task.priority === "Urgent"
        || (due !== null && due <= limit);
    })
    .sort((left, right) => {
      const leftDue = asDate(left.dueDate);
      const rightDue = asDate(right.dueDate);
      return (leftDue !== null && leftDue < day ? 0 : 1)
        - (rightDue !== null && rightDue < day ? 0 : 1)
        || comparePriority(left, right)
        || compareDue(left, right);
    })
    .slice(0, 6);
}

export function overviewHint(tasks, today = new Date()) {
  const day = startOfDay(today);
  const open = (tasks ?? []).filter((task) => task.status !== "Done");
  const overdue = open.filter((task) => {
    const due = asDate(task.dueDate);
    return due !== null && due < day;
  }).length;
  if (overdue > 0) return String(overdue) + " attività scadute: decidi da quale ripartire.";
  if (open.length > 0) return String(open.length) + " attività aperte. Scegli il prossimo passo.";
  return "Tutto pronto per il prossimo progetto.";
}

export function sortOverviewProjects(projects, tasks) {
  const rows = (projects ?? []).map((project, index) => {
    const projectTasks = (tasks ?? []).filter((task) => task.projectId === project.id);
    const done = projectTasks.filter((task) => task.status === "Done").length;
    return {
      project,
      index,
      completion: projectTasks.length ? done / projectTasks.length : 0
    };
  });
  return rows
    .sort((left, right) => right.completion - left.completion
      || compareText(left.project.name, right.project.name)
      || left.index - right.index)
    .slice(0, 6)
    .map((row) => row.project);
}

export function projectStatus(tasks, today = new Date()) {
  const items = [...(tasks ?? [])];
  if (items.length === 0) return { label: "Da pianificare", danger: false };
  const day = startOfDay(today);
  const overdue = items.filter((task) => {
    const due = asDate(task.dueDate);
    return task.status !== "Done" && due !== null && due < day;
  }).length;
  if (overdue > 0) {
    return { label: String(overdue) + " " + (overdue === 1 ? "rischio" : "rischi"), danger: true };
  }
  if (items.every((task) => task.status === "Done")) return { label: "Completato", danger: false };
  return { label: "In linea", danger: false };
}

function scopedTasks(tasks, personId) {
  if (!personId) return [...(tasks ?? [])];
  if (personId === "unassigned") return (tasks ?? []).filter((task) => (task.assigneePersonIds ?? []).length === 0);
  return (tasks ?? []).filter((task) => (task.assigneePersonIds ?? []).includes(personId));
}

export function myWorkSnapshot(tasks, personId = "", today = new Date()) {
  const day = startOfDay(today);
  const limit = addDays(day, 7);
  const weekStart = new Date(day);
  const weekDay = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekDay);
  const weekEnd = addDays(weekStart, 7);
  const scoped = scopedTasks(tasks, personId);
  const ordered = [...scoped].sort((left, right) => comparePriority(left, right) || compareDue(left, right));
  const todo = ordered.filter((task) => task.status === "Todo");
  const doing = ordered.filter((task) => task.status === "Doing");
  const due = scoped
    .filter((task) => task.status !== "Done" && asDate(task.dueDate) !== null && asDate(task.dueDate) <= limit)
    .sort((left, right) => compareDue(left, right) || comparePriority(left, right));
  const completed = [...scoped]
    .filter((task) => task.status === "Done")
    .sort((left, right) => completedTime(right.completedAt) - completedTime(left.completedAt));
  const completedThisWeek = scoped.filter((task) => {
    const completedAt = asDate(task.completedAt);
    return task.status === "Done" && completedAt !== null && completedAt >= weekStart && completedAt < weekEnd;
  }).length;
  const overdue = scoped.filter((task) => {
    const due = asDate(task.dueDate);
    return task.status !== "Done" && due !== null && due < day;
  }).length;

  return {
    scoped,
    todo,
    doing,
    due,
    completed,
    metrics: {
      todo: todo.length,
      doing: doing.length,
      overdue,
      completedThisWeek
    }
  };
}

export function peopleSnapshot(people, tasks) {
  const orderedPeople = [...(people ?? [])].sort((left, right) => (
    String(left.lastName ?? "").localeCompare(String(right.lastName ?? ""), "it")
      || String(left.firstName ?? "").localeCompare(String(right.firstName ?? ""), "it")
  ));
  const openCounts = new Map(orderedPeople.map((person) => [
    person.id,
    (tasks ?? []).filter((task) => (task.assigneePersonIds ?? []).includes(person.id) && task.status !== "Done").length
  ]));
  const maxWorkload = Math.max(1, ...openCounts.values());
  const cards = orderedPeople.map((person) => ({
    person,
    open: openCounts.get(person.id) ?? 0,
    workloadPercent: (openCounts.get(person.id) ?? 0) / maxWorkload * 100
  }));
  const busiest = cards[0] ? cards.slice().sort((left, right) => right.open - left.open)[0] : null;
  return {
    people: cards,
    assignedTaskCount: (tasks ?? []).filter((task) => (task.assigneePersonIds ?? []).length > 0).length,
    workloadText: !busiest
      ? "Aggiungi persone e assegna attività per vedere il carico."
      : busiest.open === 0
        ? "Il team non ha attività aperte assegnate."
        : personDisplayName(busiest.person)
          + " ha il carico più alto: " + busiest.open + " attività aperte."
  };
}

export function peopleSearchSnapshot(people, tasks) {
  return (people ?? []).map((person) => ({
    person,
    open: (tasks ?? []).filter((task) => (task.assigneePersonIds ?? []).includes(person.id) && task.status !== "Done").length,
    workloadPercent: 0
  }));
}
