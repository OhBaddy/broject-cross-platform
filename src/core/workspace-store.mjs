const PROJECT_ACCENTS = ["#6C5CE7", "#00A8A8", "#E14D72", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981", "#EC4899"];
const TASK_STATUSES = ["Todo", "Doing", "Done"];
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

function valueOf(source, camelName, pascalName, fallback = undefined) {
  return source?.[camelName] ?? source?.[pascalName] ?? fallback;
}

function enumName(value, names, fallback) {
  if (typeof value === "number" && Number.isInteger(value) && names[value]) return names[value];
  if (typeof value === "string" && names.includes(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value) && names[Number(value)]) return names[Number(value)];
  return fallback;
}

function isValidEnumValue(value, names) {
  return (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < names.length)
    || (typeof value === "string" && (names.includes(value) || (/^\d+$/.test(value) && names[Number(value)])));
}

function repairId(value, seen, repairs) {
  const original = typeof value === "string" ? value : "";
  let id = original;
  if (!id || seen.has(id)) {
    do id = crypto.randomUUID(); while (seen.has(id));
    if (!repairs.has(original)) repairs.set(original, id);
  }
  seen.add(id);
  return id;
}

function repairReference(value, seen, repairs) {
  const id = typeof value === "string" ? value : "";
  return seen.has(id) ? id : (repairs.get(id) ?? id);
}

function normalizeState(raw = {}) {
  const rawProjects = valueOf(raw, "projects", "Projects", []);
  const rawPeople = valueOf(raw, "people", "People", []);
  const rawTasks = valueOf(raw, "tasks", "Tasks", []);
  const projectRepairs = new Map();
  const projectIdsSeen = new Set();
  const projects = Array.isArray(rawProjects) ? rawProjects.map((project, index) => {
    const rawAccent = valueOf(project, "accentColor", "AccentColor", "");
    return {
      id: repairId(valueOf(project, "id", "Id"), projectIdsSeen, projectRepairs),
      name: String(valueOf(project, "name", "Name", "")),
      description: valueOf(project, "description", "Description", null),
      accentColor: String(rawAccent ?? "").trim() || PROJECT_ACCENTS[index % PROJECT_ACCENTS.length],
      createdAt: valueOf(project, "createdAt", "CreatedAt", new Date().toISOString()),
      updatedAt: valueOf(project, "updatedAt", "UpdatedAt", new Date().toISOString())
    };
  }) : [];
  const personRepairs = new Map();
  const personIdsSeen = new Set();
  const people = Array.isArray(rawPeople) ? rawPeople.map((person) => ({
    id: repairId(valueOf(person, "id", "Id"), personIdsSeen, personRepairs),
    firstName: String(valueOf(person, "firstName", "FirstName", "")),
    lastName: String(valueOf(person, "lastName", "LastName", "")),
    role: String(valueOf(person, "role", "Role", "")),
    company: String(valueOf(person, "company", "Company", ""))
  })) : [];
  const peopleIds = new Set(people.map((person) => person.id));
  const projectIds = new Set(projects.map((project) => project.id));
  const taskIdsSeen = new Set();
  const taskRepairs = new Map();
  const tasks = Array.isArray(rawTasks) ? rawTasks.map((task) => {
    const ids = valueOf(task, "assigneePersonIds", "AssigneePersonIds", []);
    const legacyId = valueOf(task, "assigneePersonId", "AssigneePersonId");
    const assigneePersonIds = [...new Set([
      ...(Array.isArray(ids) ? ids : []),
      ...(legacyId ? [legacyId] : [])
    ].map((id) => repairReference(id, peopleIds, personRepairs)).filter((id) => peopleIds.has(id)))];
    const rawStatus = valueOf(task, "status", "Status", "Todo");
    const status = enumName(rawStatus, TASK_STATUSES, "Todo");
    const priority = enumName(valueOf(task, "priority", "Priority", "Medium"), TASK_PRIORITIES, "Medium");
    return {
      id: repairId(valueOf(task, "id", "Id"), taskIdsSeen, taskRepairs),
      projectId: repairReference(valueOf(task, "projectId", "ProjectId", ""), projectIds, projectRepairs),
      title: String(valueOf(task, "title", "Title", "")),
      notes: valueOf(task, "notes", "Notes", null),
      conclusions: valueOf(task, "conclusions", "Conclusions", null),
      status,
      priority,
      tags: valueOf(task, "tags", "Tags", null),
      assigneePersonIds,
      dueDate: valueOf(task, "dueDate", "DueDate", null),
      completedAt: isValidEnumValue(rawStatus, TASK_STATUSES)
        ? valueOf(task, "completedAt", "CompletedAt", null)
        : null,
      createdAt: valueOf(task, "createdAt", "CreatedAt", new Date().toISOString()),
      updatedAt: valueOf(task, "updatedAt", "UpdatedAt", new Date().toISOString())
    };
  }).filter((task) => projectIds.has(task.projectId)) : [];

  return {
    schemaVersion: Math.max(Number(valueOf(raw, "schemaVersion", "SchemaVersion", 3)) || 3, 3),
    projects,
    people,
    tasks
  };
}

function parseState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Il file dati deve contenere un oggetto JSON.");
  }
  return normalizeState(raw);
}

function toPersistedState(state) {
  const normalized = normalizeState(state);
  return {
    SchemaVersion: normalized.schemaVersion,
    Projects: normalized.projects.map((project) => ({
      Id: project.id,
      Name: project.name,
      Description: project.description,
      AccentColor: project.accentColor,
      CreatedAt: project.createdAt,
      UpdatedAt: project.updatedAt
    })),
    People: normalized.people.map((person) => ({
      Id: person.id,
      FirstName: person.firstName,
      LastName: person.lastName,
      Role: person.role,
      Company: person.company
    })),
    Tasks: normalized.tasks.map((task) => ({
      Id: task.id,
      ProjectId: task.projectId,
      Title: task.title,
      Notes: task.notes,
      Conclusions: task.conclusions,
      Status: TASK_STATUSES.indexOf(task.status),
      Priority: TASK_PRIORITIES.indexOf(task.priority),
      Tags: task.tags,
      AssigneePersonIds: task.assigneePersonIds,
      DueDate: task.dueDate,
      CompletedAt: task.completedAt,
      CreatedAt: task.createdAt,
      UpdatedAt: task.updatedAt
    }))
  };
}

export class WorkspaceStore {
  constructor(storage = globalThis.localStorage, namespace = "broject") {
    if (!storage) throw new Error("Local storage non disponibile.");
    this.storage = storage;
    this.keys = {
      primary: `${namespace}:primary`,
      backup: `${namespace}:backup`,
      corrupt: `${namespace}:corrupt`
    };
    this.recoveryMessage = null;
  }

  load() {
    this.recoveryMessage = null;
    const primary = this.storage.getItem(this.keys.primary);
    if (primary !== null) {
      try {
        return { state: parseState(JSON.parse(primary)), recoveryMessage: null };
      } catch {
        this.storage.setItem(this.keys.corrupt, primary);
      }
    }

    const backup = this.storage.getItem(this.keys.backup);
    if (backup !== null) {
      try {
        const state = parseState(JSON.parse(backup));
        this.storage.setItem(this.keys.primary, JSON.stringify(toPersistedState(state)));
        this.recoveryMessage = "Dati recuperati dalla copia di sicurezza. Le ultime modifiche potrebbero non essere presenti.";
        return { state, recoveryMessage: this.recoveryMessage };
      } catch {
        // Fall through to the explicit unrecoverable-data error below.
      }
    }

    if (primary === null && backup === null && this.storage.getItem(this.keys.corrupt) === null) {
      return { state: normalizeState(), recoveryMessage: null };
    }

    throw new Error("Impossibile leggere i dati di Broject o la copia di sicurezza.");
  }

  save(state) {
    const current = this.storage.getItem(this.keys.primary);
    if (current !== null) this.storage.setItem(this.keys.backup, current);
    this.storage.setItem(this.keys.primary, JSON.stringify(toPersistedState(state)));
  }
}

export { normalizeState, toPersistedState, PROJECT_ACCENTS };
