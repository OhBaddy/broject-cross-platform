import { PROJECT_ACCENTS } from "./workspace-store.mjs";

const clone = (value) => structuredClone(value);

function required(value, field) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) throw new Error(`${field} obbligatorio.`);
  return cleaned;
}

function clean(value) {
  const cleaned = value == null ? "" : String(value).trim();
  return cleaned || null;
}

export class WorkspaceService {
  constructor(store) {
    this.store = store;
    const loaded = store.load();
    this.state = loaded.state;
    this.recoveryMessage = loaded.recoveryMessage;
    this._restoreSavedState = this._captureState();
    this._undoDelete = null;
  }

  get canUndoDelete() {
    return this._undoDelete !== null;
  }

  async addProject(name, description) {
    const project = {
      id: crypto.randomUUID(),
      name: required(name, "Nome progetto"),
      description: clean(description),
      accentColor: PROJECT_ACCENTS[this.state.projects.length % PROJECT_ACCENTS.length],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.state.projects.push(project);
    await this.save();
    return project;
  }

  async updateProject(project, name, description) {
    const stored = this._project(project);
    stored.name = required(name, "Nome progetto");
    stored.description = clean(description);
    stored.updatedAt = new Date().toISOString();
    await this.save();
  }

  async deleteProject(project) {
    const stored = this._project(project);
    const projectIndex = this.state.projects.indexOf(stored);
    const deletedTasks = this.state.tasks.filter((task) => task.projectId === stored.id);
    this.state.projects.splice(projectIndex, 1);
    this.state.tasks = this.state.tasks.filter((task) => task.projectId !== stored.id);
    await this.save();
    this._undoDelete = () => {
      if (this.state.projects.some((item) => item.id === stored.id)
        || deletedTasks.some((task) => this.state.tasks.some((item) => item.id === task.id))) {
        throw new Error("Il progetto o le attività sono già presenti.");
      }
      this.state.projects.splice(Math.min(projectIndex, this.state.projects.length), 0, stored);
      for (const task of deletedTasks) {
        task.assigneePersonIds = this._validAssignees(task.assigneePersonIds);
        this.state.tasks.push(task);
      }
    };
  }

  async addPerson(firstName, lastName, role, company) {
    const person = { id: crypto.randomUUID(), firstName: required(firstName, "Nome"), lastName: clean(lastName) ?? "", role: clean(role) ?? "", company: clean(company) ?? "" };
    this.state.people.push(person);
    await this.save();
    return person;
  }

  async updatePerson(person, firstName, lastName, role, company) {
    const stored = this._person(person);
    Object.assign(stored, { firstName: required(firstName, "Nome"), lastName: clean(lastName) ?? "", role: clean(role) ?? "", company: clean(company) ?? "" });
    await this.save();
  }

  async deletePerson(person) {
    const stored = this._person(person);
    const index = this.state.people.indexOf(stored);
    const affected = this.state.tasks
      .filter((task) => task.assigneePersonIds.includes(stored.id))
      .map((task) => ({ taskId: task.id }));
    this.state.people.splice(index, 1);
    for (const entry of affected) {
      const task = this.state.tasks.find((item) => item.id === entry.taskId);
      if (!task) continue;
      task.assigneePersonIds = task.assigneePersonIds.filter((id) => id !== stored.id);
      task.updatedAt = new Date().toISOString();
    }
    await this.save();
    this._undoDelete = () => {
      if (this.state.people.some((item) => item.id === stored.id)) throw new Error("La persona è già presente.");
      this.state.people.splice(Math.min(index, this.state.people.length), 0, stored);
      for (const entry of affected) {
        const task = this.state.tasks.find((item) => item.id === entry.taskId);
        if (!task || task.assigneePersonIds.includes(stored.id)) continue;
        task.assigneePersonIds = [...task.assigneePersonIds, stored.id];
        task.updatedAt = new Date().toISOString();
      }
    };
  }

  async addTask(project, title, notes, assigneePersonIds, dueDate, conclusions = null, priority = "Medium", tags = null, status = "Todo") {
    const storedProject = this._project(project);
    const task = {
      id: crypto.randomUUID(),
      projectId: storedProject.id,
      title: required(title, "Titolo task"),
      notes: clean(notes),
      conclusions: clean(conclusions),
      status: this._status(status),
      priority: this._priority(priority),
      tags: clean(tags),
      assigneePersonIds: this._validAssignees(assigneePersonIds),
      dueDate: dueDate ? String(dueDate).slice(0, 10) : null,
      completedAt: status === "Done" ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.state.tasks.push(task);
    await this.save();
    return task;
  }

  async updateTask(task, values) {
    const stored = this._task(task);
    const next = { ...values };
    if (next.projectId && !this.state.projects.some((project) => project.id === next.projectId)) throw new Error("Il progetto selezionato non esiste più.");
    if (next.title !== undefined) stored.title = required(next.title, "Titolo task");
    if (next.notes !== undefined) stored.notes = clean(next.notes);
    if (next.conclusions !== undefined) stored.conclusions = clean(next.conclusions);
    if (next.tags !== undefined) stored.tags = clean(next.tags);
    if (next.projectId !== undefined) stored.projectId = next.projectId;
    if (next.assigneePersonIds !== undefined) stored.assigneePersonIds = this._validAssignees(next.assigneePersonIds);
    if (next.dueDate !== undefined) stored.dueDate = next.dueDate ? String(next.dueDate).slice(0, 10) : null;
    if (next.priority !== undefined) stored.priority = this._priority(next.priority);
    if (next.status !== undefined) this._applyStatus(stored, this._status(next.status));
    stored.updatedAt = new Date().toISOString();
    await this.save();
  }

  async setTaskStatus(task, status) {
    const stored = this._task(task);
    this._applyStatus(stored, this._status(status));
    stored.updatedAt = new Date().toISOString();
    await this.save();
  }

  async deleteTask(task) {
    const stored = this._task(task);
    const index = this.state.tasks.indexOf(stored);
    this.state.tasks.splice(index, 1);
    await this.save();
    this._undoDelete = () => {
      if (this.state.tasks.some((item) => item.id === stored.id)) throw new Error("L’attività è già presente.");
      if (!this.state.projects.some((project) => project.id === stored.projectId)) throw new Error("Il progetto dell’attività non esiste più.");
      stored.assigneePersonIds = this._validAssignees(stored.assigneePersonIds);
      this.state.tasks.splice(Math.min(index, this.state.tasks.length), 0, stored);
    };
  }

  async undoDelete() {
    if (!this._undoDelete) throw new Error("Nessuna eliminazione da annullare.");
    const restore = this._undoDelete;
    restore();
    try {
      await this.save();
    } catch (error) {
      this._undoDelete = restore;
      throw error;
    }
    this._undoDelete = null;
  }

  async save() {
    try {
      await this.store.save(this.state);
    } catch (error) {
      this._restoreSavedState();
      throw error;
    }
    this._restoreSavedState = this._captureState();
  }

  _captureState() {
    const state = this.state;
    const projects = state.projects;
    const people = state.people;
    const tasks = state.tasks;
    const restoreProjects = this._captureCollection(projects);
    const restorePeople = this._captureCollection(people);
    const restoreTasks = this._captureCollection(tasks);
    const schemaVersion = state.schemaVersion;
    return () => {
      state.schemaVersion = schemaVersion;
      state.projects = projects;
      state.people = people;
      state.tasks = tasks;
      restoreProjects();
      restorePeople();
      restoreTasks();
    };
  }

  _captureCollection(collection) {
    const references = [...collection];
    const snapshots = references.map((item) => clone(item));
    return () => {
      collection.splice(0, collection.length, ...references);
      references.forEach((item, index) => {
        for (const key of Object.keys(item)) delete item[key];
        Object.assign(item, clone(snapshots[index]));
      });
    };
  }

  _project(project) {
    const stored = this.state.projects.find((item) => item.id === project?.id);
    if (!stored) throw new Error("Il progetto selezionato non esiste più.");
    return stored;
  }

  _person(person) {
    const stored = this.state.people.find((item) => item.id === person?.id);
    if (!stored) throw new Error("La persona selezionata non esiste più.");
    return stored;
  }

  _task(task) {
    const stored = this.state.tasks.find((item) => item.id === task?.id);
    if (!stored) throw new Error("L’attività selezionata non esiste più.");
    return stored;
  }

  _validAssignees(ids = []) {
    const valid = new Set(this.state.people.map((person) => person.id));
    return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => valid.has(id)))];
  }

  _status(status) {
    if (!["Todo", "Doing", "Done"].includes(status)) throw new Error("Stato attività non valido.");
    return status;
  }

  _priority(priority) {
    if (!["Low", "Medium", "High", "Urgent"].includes(priority)) throw new Error("Priorità attività non valida.");
    return priority;
  }

  _applyStatus(task, status) {
    if (task.status !== "Done" && status === "Done") task.completedAt = new Date().toISOString();
    if (task.status === "Done" && status !== "Done") task.completedAt = null;
    task.status = status;
  }
}
