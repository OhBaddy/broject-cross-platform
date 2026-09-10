import { localDate } from "./dashboard-query.mjs";

const statusOrder = { Todo: 0, Doing: 1, Done: 2 };
const statusLabels = { Todo: "Da fare", Doing: "Presa in carico", Done: "Fatti" };
const priorityLabels = { Low: "Bassa", Medium: "Media", High: "Alta", Urgent: "Urgente" };

function displayName(person) {
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return name || "Senza nome";
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function endOfWeek(date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function dueTime(value) {
  return localDate(value)?.getTime() ?? Number.POSITIVE_INFINITY;
}

function isDone(task) {
  return task.status === "Done";
}

function isOverdue(task, today) {
  const due = localDate(task.dueDate);
  return !isDone(task) && due !== null && due < today;
}

function isDueSoon(task, today, limit) {
  if (isDone(task) || !task.dueDate) return false;
  const due = localDate(task.dueDate);
  return due !== null && due >= today && due <= limit;
}

function assigneePeople(task, peopleById) {
  return (task.assigneePersonIds ?? []).map((id) => peopleById.get(id)).filter(Boolean).sort((a, b) => (a.lastName ?? "").localeCompare(b.lastName ?? "", "it") || (a.firstName ?? "").localeCompare(b.firstName ?? "", "it"));
}

function portfolioAssigneePeople(task, peopleById) {
  return (task.assigneePersonIds ?? []).map((id) => peopleById.get(id)).filter(Boolean)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "it"));
}

function toProjectTask(task, peopleById, today, limit) {
  const assignees = assigneePeople(task, peopleById);
  return {
    title: task.title,
    notes: task.notes ?? "",
    conclusions: task.conclusions ?? "",
    status: task.status,
    statusLabel: statusLabels[task.status] ?? task.status,
    priorityLabel: priorityLabels[task.priority] ?? task.priority,
    tags: task.tags ?? "",
    assigneeName: assignees.length ? assignees.map(displayName).join(", ") : "Non assegnato",
    assigneeRole: [...new Set(assignees.map((person) => person.role).filter(Boolean))].join(", "),
    assigneeCompany: [...new Set(assignees.map((person) => person.company).filter(Boolean))].join(", "),
    dueDate: task.dueDate ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    isOverdue: Boolean(isOverdue(task, today)),
    isDueSoon: Boolean(isDueSoon(task, today, limit))
  };
}

export function buildProjectReport(state, project, finalNotes = null, at = new Date()) {
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const today = new Date(at);
  today.setHours(0, 0, 0, 0);
  const limit = addDays(today, 7);
  const tasks = state.tasks.filter((task) => task.projectId === project.id)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || dueTime(a.dueDate) - dueTime(b.dueDate) || a.title.localeCompare(b.title, "it"))
    .map((task) => toProjectTask(task, peopleById, today, limit));
  const sourceTasks = state.tasks.filter((task) => task.projectId === project.id);
  const involvedIds = new Set(sourceTasks.flatMap((task) => task.assigneePersonIds ?? []));
  const people = state.people.filter((person) => involvedIds.has(person.id))
    .sort((a, b) => (a.lastName ?? "").localeCompare(b.lastName ?? "", "it") || (a.firstName ?? "").localeCompare(b.firstName ?? "", "it"))
    .map((person) => ({
      firstName: person.firstName,
      lastName: person.lastName,
      role: person.role,
      company: person.company,
      displayName: displayName(person),
      todoCount: sourceTasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Todo").length,
      doingCount: sourceTasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Doing").length,
      doneCount: sourceTasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Done").length
    }));
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.status === "Done").length;
  return {
    project,
    tasks,
    people,
    metrics: {
      totalTasks,
      todoTasks: tasks.filter((task) => task.status === "Todo").length,
      doingTasks: tasks.filter((task) => task.status === "Doing").length,
      doneTasks,
      overdueTasks: tasks.filter((task) => task.isOverdue).length,
      dueSoonTasks: tasks.filter((task) => task.isDueSoon).length,
      completionRate: totalTasks ? doneTasks / totalTasks : 0
    },
    finalNotes: String(finalNotes ?? "").trim() || "Nessuna nota finale inserita.",
    exportedAt: new Date(at)
  };
}

function toPortfolioTask(task, projectById, peopleById, today, limit) {
  const assignees = portfolioAssigneePeople(task, peopleById);
  return {
    id: task.id,
    projectName: projectById.get(task.projectId)?.name ?? "Progetto sconosciuto",
    title: task.title,
    notes: task.notes ?? "",
    conclusions: task.conclusions ?? "",
    statusLabel: statusLabels[task.status] ?? task.status,
    priorityLabel: priorityLabels[task.priority] ?? task.priority,
    tags: task.tags ?? "",
    assignees: assignees.length ? assignees.map(displayName).join(", ") : "Non assegnato",
    dueDate: task.dueDate ?? null,
    completedAt: task.completedAt ?? null,
    isOverdue: Boolean(isOverdue(task, today)),
    isDueSoon: Boolean(isDueSoon(task, today, limit))
  };
}

export function buildPortfolioReport(state, at = new Date()) {
  const today = new Date(at);
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const limit = addDays(today, 7);
  const projectById = new Map(state.projects.map((project) => [project.id, project]));
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const completedThisWeekTasks = state.tasks.filter((task) => task.status === "Done" && task.completedAt)
    .filter((task) => { const date = new Date(task.completedAt); return date >= weekStart && date < addDays(weekEnd, 1); })
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt) || a.title.localeCompare(b.title, "it"));
  const completedThisWeek = completedThisWeekTasks.map((task) => toPortfolioTask(task, projectById, peopleById, today, limit));
  const projects = [...state.projects].sort((a, b) => a.name.localeCompare(b.name, "it")).map((project) => {
    const tasks = state.tasks.filter((task) => task.projectId === project.id);
    return {
      projectName: project.name,
      totalTasks: tasks.length,
      todoTasks: tasks.filter((task) => task.status === "Todo").length,
      doingTasks: tasks.filter((task) => task.status === "Doing").length,
      doneTasks: tasks.filter((task) => task.status === "Done").length,
      completedThisWeek: tasks.filter((task) => completedThisWeekTasks.includes(task)).length,
      overdueTasks: tasks.filter((task) => isOverdue(task, today)).length,
      dueSoonTasks: tasks.filter((task) => isDueSoon(task, today, limit)).length
    };
  });
  const people = [...state.people].sort((a, b) => (a.lastName ?? "").localeCompare(b.lastName ?? "", "it") || (a.firstName ?? "").localeCompare(b.firstName ?? "", "it")).map((person) => ({
    displayName: displayName(person),
    role: person.role,
    company: person.company,
    todoCount: state.tasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Todo").length,
    doingCount: state.tasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Doing").length,
    doneCount: state.tasks.filter((task) => task.assigneePersonIds?.includes(person.id) && task.status === "Done").length,
    completedThisWeek: state.tasks.filter((task) => task.assigneePersonIds?.includes(person.id) && completedThisWeekTasks.includes(task)).length
  })).filter((person) => person.todoCount + person.doingCount + person.doneCount > 0);
  const risks = state.tasks.filter((task) => task.status !== "Done" && task.dueDate && dueTime(task.dueDate) <= limit.getTime())
    .sort((a, b) => dueTime(a.dueDate) - dueTime(b.dueDate) || a.title.localeCompare(b.title, "it"))
    .map((task) => toPortfolioTask(task, projectById, peopleById, today, limit));
  return {
    projects,
    completedThisWeek,
    people,
    risks,
    metrics: {
      totalProjects: state.projects.length,
      activeProjects: projects.filter((project) => project.todoTasks + project.doingTasks > 0).length,
      totalTasks: state.tasks.length,
      todoTasks: state.tasks.filter((task) => task.status === "Todo").length,
      doingTasks: state.tasks.filter((task) => task.status === "Doing").length,
      doneTasks: state.tasks.filter((task) => task.status === "Done").length,
      completedThisWeek: completedThisWeek.length,
      overdueTasks: risks.filter((task) => task.isOverdue).length,
      dueSoonTasks: risks.filter((task) => task.isDueSoon).length
    },
    weekStart,
    weekEnd,
    exportedAt: new Date(at)
  };
}

export function reportSheetNames(scope) {
  return scope === "project"
    ? ["Dashboard", "Anagrafica", "Persone", "Kanban", "Task Da Fare", "Task Presa in carico", "Task Fatti", "Note Finali"]
    : ["Executive Dashboard", "Riepilogo Progetti", "Settimana Corrente", "Sforzo Progetti", "Persone", "Rischi"];
}

export { startOfWeek, statusLabels, priorityLabels };
