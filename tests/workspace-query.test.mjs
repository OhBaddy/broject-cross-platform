import test from "node:test";
import assert from "node:assert/strict";
import { searchWorkspace, sortProjectTasks } from "../src/core/workspace-query.mjs";

const project = { id: "project-1", name: "Qualità prodotto", description: "Contesto commerciale" };
const person = {
  id: "person-1",
  firstName: "Élise",
  lastName: "Rossi",
  role: "Designer",
  company: "Acme"
};

const state = {
  schemaVersion: 3,
  projects: [project],
  people: [person],
  tasks: [
    {
      id: "task-2",
      projectId: project.id,
      title: "Verifica 02",
      notes: "Appunti riservati",
      conclusions: "Decisione approvata",
      tags: "lancio, revisione",
      assigneePersonIds: [person.id],
      status: "Todo",
      priority: "Medium"
    },
    {
      id: "task-1",
      projectId: project.id,
      title: "Verifica 01",
      notes: "",
      conclusions: "",
      tags: "",
      assigneePersonIds: [person.id],
      status: "Done",
      priority: "Medium"
    }
  ]
};

test("search includes completed and undated tasks, and sorts task results by title", () => {
  const result = searchWorkspace(state, "  verifica  ");

  assert.deepEqual(result.tasks.map((task) => task.id), ["task-1", "task-2"]);
  assert.equal(result.projects.length, 0);
  assert.equal(result.people.length, 0);
  assert.deepEqual(state.tasks.map((task) => task.id), ["task-2", "task-1"]);
});

test("search matches project descriptions and assigned people details", () => {
  assert.deepEqual(searchWorkspace(state, "commerciale").projects.map((item) => item.id), [project.id]);
  assert.deepEqual(searchWorkspace(state, "designer").tasks.map((item) => item.id), ["task-1", "task-2"]);
  assert.deepEqual(searchWorkspace(state, "acme").people.map((item) => item.id), [person.id]);
});

test("blank search returns all entities with deterministic ordering", () => {
  const result = searchWorkspace(state, " \t ");

  assert.equal(result.tasks.length, 2);
  assert.equal(result.projects.length, 1);
  assert.equal(result.people.length, 1);
});

test("search ordering follows WPF ordinal-ignore-case semantics instead of user locale collation", () => {
  const result = searchWorkspace({
    projects: [],
    people: [],
    tasks: [
      { id: "accented", title: "Ångström", assigneePersonIds: [] },
      { id: "ascii", title: "Zeta", assigneePersonIds: [] }
    ]
  }, "");

  assert.deepEqual(result.tasks.map((task) => task.id), ["ascii", "accented"]);
});

test("project tasks follow the WPF status, priority, due date and title order", () => {
  const tasks = [
    { id: "done", title: "A", status: "Done", priority: "Urgent", dueDate: "2026-01-01" },
    { id: "todo-late", title: "A", status: "Todo", priority: "Urgent", dueDate: "2026-05-02" },
    { id: "todo-early-title-b", title: "B", status: "Todo", priority: "High", dueDate: "2026-05-01" },
    { id: "todo-early-title-a", title: "A", status: "Todo", priority: "High", dueDate: "2026-05-01" },
    { id: "doing", title: "Z", status: "Doing", priority: "Low", dueDate: null },
    { id: "todo-urgent-early", title: "Z", status: "Todo", priority: "Urgent", dueDate: "2026-05-01" },
    { id: "same-b", title: "Same", status: "Doing", priority: "Medium", dueDate: "2026-06-01" },
    { id: "same-a", title: "Same", status: "Doing", priority: "Medium", dueDate: "2026-06-01" }
  ];

  assert.deepEqual(sortProjectTasks(tasks).map((task) => task.id), [
    "todo-urgent-early",
    "todo-late",
    "todo-early-title-a",
    "todo-early-title-b",
    "same-b",
    "same-a",
    "doing",
    "done"
  ]);
  assert.deepEqual(tasks.map((task) => task.id), ["done", "todo-late", "todo-early-title-b", "todo-early-title-a", "doing", "todo-urgent-early", "same-b", "same-a"]);
});
