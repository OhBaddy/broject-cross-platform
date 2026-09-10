function text(value) {
  return typeof value === "string" ? value : "";
}

function foldOrdinal(value) {
  return text(value).toLowerCase();
}

function contains(value, query) {
  return foldOrdinal(value).includes(foldOrdinal(query));
}

function displayName(person) {
  const name = `${text(person.firstName)} ${text(person.lastName)}`.trim();
  return name || "Senza nome";
}

function personDetails(person) {
  return [person.role, person.company].filter((value) => text(value).trim()).join(" - ");
}

function matchesPerson(person, query) {
  return query.length === 0 || contains(displayName(person), query) || contains(personDetails(person), query);
}

function matchesProject(project, query) {
  return query.length === 0 || contains(project.name, query) || contains(project.description, query);
}

function matchesTask(state, task, query) {
  if (query.length === 0) return true;
  if (contains(task.title, query)
    || contains(task.notes, query)
    || contains(task.tags, query)
    || contains(task.conclusions, query)) {
    return true;
  }

  const project = state.projects.find((item) => item.id === task.projectId);
  if (project && contains(project.name, query)) return true;

  return (task.assigneePersonIds ?? []).some((personId) => {
    const person = state.people.find((item) => item.id === personId);
    return person && matchesPerson(person, query);
  });
}

function compareLocaleText(left, right) {
  return text(left).localeCompare(text(right), "it");
}

function compareOrdinalText(left, right) {
  const normalizedLeft = foldOrdinal(left);
  const normalizedRight = foldOrdinal(right);
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function compareWithId(left, right, getLabel) {
  return compareOrdinalText(getLabel(left), getLabel(right)) || compareOrdinalText(left.id, right.id);
}

const projectTaskStatusOrder = { Todo: 0, Doing: 1, Done: 2 };
const projectTaskPriorityOrder = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

function dueDateOrder(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(String(value).slice(0, 10) + "T00:00:00").getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function compareProjectTask(left, right) {
  return (projectTaskStatusOrder[left.status] ?? Number.MAX_SAFE_INTEGER)
    - (projectTaskStatusOrder[right.status] ?? Number.MAX_SAFE_INTEGER)
    || (projectTaskPriorityOrder[right.priority] ?? 0) - (projectTaskPriorityOrder[left.priority] ?? 0)
    || dueDateOrder(left.dueDate) - dueDateOrder(right.dueDate)
    || compareLocaleText(left.title, right.title);
}

/**
 * Sort the project board/list without changing the persisted task order.
 * The keys mirror MainWindow.RefreshTasks in the WPF app.
 */
export function sortProjectTasks(tasks) {
  return [...(tasks ?? [])].sort(compareProjectTask);
}

/**
 * Search all workspace entities without mutating storage order.
 * Matches C# WorkspaceQuery behavior used by the WPF app.
 */
export function searchWorkspace(state, rawQuery) {
  const query = text(rawQuery).trim();
  const tasks = (state.tasks ?? [])
    .filter((task) => matchesTask(state, task, query))
    .sort((left, right) => compareWithId(left, right, (task) => task.title));
  const projects = (state.projects ?? [])
    .filter((project) => matchesProject(project, query))
    .sort((left, right) => compareWithId(left, right, (project) => project.name));
  const people = (state.people ?? [])
    .filter((person) => matchesPerson(person, query))
    .sort((left, right) => compareOrdinalText(left.lastName, right.lastName)
      || compareOrdinalText(left.firstName, right.firstName)
      || compareOrdinalText(left.id, right.id));

  return { tasks, projects, people };
}

export { displayName, personDetails, matchesPerson, matchesProject, matchesTask };
