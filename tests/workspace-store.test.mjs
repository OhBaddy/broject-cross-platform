import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceStore } from "../src/core/workspace-store.mjs";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

test("save keeps previous primary as backup before replacing it", () => {
  const storage = new MemoryStorage();
  const store = new WorkspaceStore(storage, "test");

  store.save({ schemaVersion: 3, projects: [{ id: "one" }], people: [], tasks: [] });
  store.save({ schemaVersion: 3, projects: [{ id: "two" }], people: [], tasks: [] });

  assert.equal(store.load().state.projects[0].id, "two");
  assert.equal(JSON.parse(storage.getItem("test:backup")).Projects[0].Id, "one");
});

test("load recovers corrupt primary from backup and preserves corrupt payload", () => {
  const storage = new MemoryStorage();
  const store = new WorkspaceStore(storage, "test");
  store.save({ schemaVersion: 3, projects: [{ id: "safe" }], people: [], tasks: [] });
  store.save({ schemaVersion: 3, projects: [{ id: "latest" }], people: [], tasks: [] });
  storage.setItem("test:primary", "{ invalid json");

  const recovered = store.load();

  assert.equal(recovered.state.projects[0].id, "safe");
  assert.match(recovered.recoveryMessage, /recuperati/i);
  assert.equal(storage.getItem("test:corrupt"), "{ invalid json");
  assert.equal(JSON.parse(storage.getItem("test:backup")).Projects[0].Id, "safe");
});

test("load accepts original PascalCase schema and migrates legacy single assignee", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", JSON.stringify({
    SchemaVersion: 1,
    Projects: [{ Id: "project-1", Name: "Legacy" }],
    People: [{ Id: "person-1", FirstName: "Ada", LastName: "Lovelace" }],
    Tasks: [{ Id: "task-1", ProjectId: "project-1", Title: "Legacy task", AssigneePersonId: "person-1" }]
  }));
  const store = new WorkspaceStore(storage, "test");

  const loaded = store.load();

  assert.equal(loaded.state.schemaVersion, 3);
  assert.deepEqual(loaded.state.tasks[0].assigneePersonIds, ["person-1"]);
  assert.equal(loaded.state.tasks[0].assigneePersonId, undefined);
});

test("load accepts numeric .NET enum values and persists them in the .NET-compatible form", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", JSON.stringify({
    SchemaVersion: 3,
    Projects: [{ Id: "project-1", Name: "Legacy" }],
    People: [],
    Tasks: [{ Id: "task-1", ProjectId: "project-1", Title: "Done task", Status: 2, Priority: 3 }]
  }));
  const store = new WorkspaceStore(storage, "test");

  const loaded = store.load();
  assert.equal(loaded.state.tasks[0].status, "Done");
  assert.equal(loaded.state.tasks[0].priority, "Urgent");

  store.save(loaded.state);
  const persisted = JSON.parse(storage.getItem("test:primary"));
  assert.equal(persisted.Tasks[0].Status, 2);
  assert.equal(persisted.Tasks[0].Priority, 3);
});

test("load clears completion metadata when a task status is invalid", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", JSON.stringify({
    SchemaVersion: 3,
    Projects: [{ Id: "project-1", Name: "Legacy" }],
    People: [],
    Tasks: [{ Id: "task-1", ProjectId: "project-1", Title: "Repair status", Status: 99, CompletedAt: "2026-09-08T10:00:00.000Z" }]
  }));

  const state = new WorkspaceStore(storage, "test").load().state;

  assert.equal(state.tasks[0].status, "Todo");
  assert.equal(state.tasks[0].completedAt, null);
});

test("load repairs duplicate and empty IDs while preserving task references", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", JSON.stringify({
    SchemaVersion: 3,
    Projects: [
      { Id: "duplicate", Name: "First" },
      { Id: "duplicate", Name: "Second" },
      { Id: "", Name: "Empty" }
    ],
    People: [
      { Id: "person", FirstName: "First" },
      { Id: "person", FirstName: "Second" },
      { Id: "", FirstName: "Empty" }
    ],
    Tasks: [{ Id: "", ProjectId: "", Title: "Repair", AssigneePersonIds: [""] }]
  }));

  const state = new WorkspaceStore(storage, "test").load().state;
  assert.equal(new Set(state.projects.map((project) => project.id)).size, 3);
  assert.equal(new Set(state.people.map((person) => person.id)).size, 3);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.projects.some((project) => project.id === state.tasks[0].projectId), true);
  assert.equal(state.people.some((person) => person.id === state.tasks[0].assigneePersonIds[0]), true);
});

test("duplicate IDs keep task references on the first surviving entity", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", JSON.stringify({
    SchemaVersion: 3,
    Projects: [
      { Id: "duplicate-project", Name: "First" },
      { Id: "duplicate-project", Name: "Second" }
    ],
    People: [
      { Id: "duplicate-person", FirstName: "First" },
      { Id: "duplicate-person", FirstName: "Second" }
    ],
    Tasks: [{ Id: "task-1", ProjectId: "duplicate-project", Title: "Keep reference", AssigneePersonIds: ["duplicate-person"] }]
  }));

  const state = new WorkspaceStore(storage, "test").load().state;

  assert.equal(state.tasks[0].projectId, state.projects[0].id);
  assert.deepEqual(state.tasks[0].assigneePersonIds, [state.people[0].id]);
});

test("load rejects a non-object workspace instead of opening an empty one", () => {
  const storage = new MemoryStorage();
  storage.setItem("test:primary", "null");
  assert.throws(() => new WorkspaceStore(storage, "test").load(), /Impossibile leggere/);
});
