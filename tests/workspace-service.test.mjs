import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../src/core/workspace-store.mjs";
import { WorkspaceService } from "../src/core/workspace-service.mjs";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

class FailingStorage extends MemoryStorage {
  fail = false;

  setItem(key, value) {
    if (this.fail) throw new Error("write failed");
    super.setItem(key, value);
  }
}

test("service creates project, person and multi-assignee task with status timestamps", async () => {
  const service = new WorkspaceService(new WorkspaceStore(new MemoryStorage(), "service"));
  const project = await service.addProject("Alpha", "First project");
  const ada = await service.addPerson("Ada", "Lovelace", "PM", "Broject Labs");
  const grace = await service.addPerson("Grace", "Hopper", "Tech Lead", "Broject Labs");
  const task = await service.addTask(project, "Prepare kickoff", "Agenda", [ada.id, grace.id], "2026-05-01", "Aligned", "Urgent", "kickoff, client", "Todo");

  await service.setTaskStatus(task, "Done");

  assert.equal(service.state.projects[0].name, "Alpha");
  assert.deepEqual(task.assigneePersonIds, [ada.id, grace.id]);
  assert.equal(task.priority, "Urgent");
  assert.equal(task.status, "Done");
  assert.ok(task.completedAt);
});

test("service deletes person assignments and restores the latest deletion", async () => {
  const service = new WorkspaceService(new WorkspaceStore(new MemoryStorage(), "service"));
  const project = await service.addProject("Alpha", null);
  const person = await service.addPerson("Ada", "Lovelace", "PM", "");
  const task = await service.addTask(project, "Prepare kickoff", null, [person.id], null);

  await service.deletePerson(person);
  assert.deepEqual(task.assigneePersonIds, []);
  assert.equal(service.canUndoDelete, true);
  await service.undoDelete();

  assert.equal(service.state.people.some((item) => item.id === person.id), true);
  assert.deepEqual(task.assigneePersonIds, [person.id]);
});

test("service deletes project with its tasks and rejects blank required names", async () => {
  const service = new WorkspaceService(new WorkspaceStore(new MemoryStorage(), "service"));
  await assert.rejects(() => service.addProject("  ", null), /Nome progetto obbligatorio/);
  const project = await service.addProject("Alpha", null);
  await service.addTask(project, "Task", null, [], null);

  await service.deleteProject(project);
  assert.equal(service.state.projects.length, 0);
  assert.equal(service.state.tasks.length, 0);
  await service.undoDelete();
  assert.equal(service.state.projects.length, 1);
  assert.equal(service.state.tasks.length, 1);
});

test("project undo appends restored tasks in the same order as WPF", async () => {
  const service = new WorkspaceService(new WorkspaceStore(new MemoryStorage(), "service"));
  const deletedProject = await service.addProject("Deleted project", null);
  const remainingProject = await service.addProject("Remaining project", null);
  await service.addTask(deletedProject, "Deleted task", null, [], null);
  await service.addTask(remainingProject, "Existing task", null, [], null);

  await service.deleteProject(deletedProject);
  await service.addTask(remainingProject, "Task added after deletion", null, [], null);
  await service.undoDelete();

  assert.deepEqual(service.state.tasks.map((task) => task.title), [
    "Existing task",
    "Task added after deletion",
    "Deleted task"
  ]);
});

test("task undo keeps only assignees that still exist", async () => {
  const service = new WorkspaceService(new WorkspaceStore(new MemoryStorage(), "service"));
  const project = await service.addProject("Alpha", null);
  const person = await service.addPerson("Ada", "Lovelace", "PM", "");
  const task = await service.addTask(project, "Task", null, [person.id], null);

  await service.deleteTask(task);
  task.assigneePersonIds = [person.id, "missing-person"];
  await service.undoDelete();

  assert.deepEqual(service.state.tasks[0].assigneePersonIds, [person.id]);
});

test("failed writes roll back entity references and do not publish undo", async () => {
  const storage = new FailingStorage();
  const service = new WorkspaceService(new WorkspaceStore(storage, "service"));
  const project = await service.addProject("Alpha", "Original");
  const task = await service.addTask(project, "Task", null, [], null);

  storage.fail = true;
  await assert.rejects(() => service.updateProject(project, "Unsaved", "Changed"), /write failed/);
  assert.equal(project.name, "Alpha");
  assert.equal(service.state.projects[0], project);

  await assert.rejects(() => service.deleteTask(task), /write failed/);
  assert.equal(service.state.tasks[0], task);
  assert.equal(service.canUndoDelete, false);
});

test("failed undo keeps the recovery action available", async () => {
  const storage = new FailingStorage();
  const service = new WorkspaceService(new WorkspaceStore(storage, "service"));
  const project = await service.addProject("Alpha", null);
  const task = await service.addTask(project, "Task", null, [], null);
  await service.deleteTask(task);

  storage.fail = true;
  await assert.rejects(() => service.undoDelete(), /write failed/);
  assert.equal(service.state.tasks.length, 0);
  assert.equal(service.canUndoDelete, true);

  storage.fail = false;
  await service.undoDelete();
  assert.equal(service.state.tasks[0], task);
  assert.equal(service.canUndoDelete, false);
});

test("service waits for asynchronous persistence before confirming a mutation", async () => {
  const store = new WorkspaceStore(new MemoryStorage(), "service");
  let persisted = false;
  store.save = async () => {
    await Promise.resolve();
    persisted = true;
  };
  const service = new WorkspaceService(store);

  const operation = service.addProject("Async", null);
  assert.equal(typeof operation?.then, "function");
  assert.equal(persisted, false);
  await operation;
  assert.equal(persisted, true);
});

test("an asynchronous write failure restores the last saved state", async () => {
  const store = new WorkspaceStore(new MemoryStorage(), "service");
  store.save = async () => {
    await Promise.resolve();
    throw new Error("async write failed");
  };
  const service = new WorkspaceService(store);

  await assert.rejects(() => service.addProject("Unsaved", null), /async write failed/);
  assert.deepEqual(service.state.projects, []);
});
