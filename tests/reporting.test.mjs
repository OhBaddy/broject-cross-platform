import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectReport, buildPortfolioReport, reportSheetNames } from "../src/core/reporting.mjs";

const start = new Date();
start.setHours(10, 0, 0, 0);
const project = { id: "project-1", name: "Executive Rollout", description: "Dashboard", accentColor: "#6C5CE7" };
const owner = { id: "person-1", firstName: "Mario", lastName: "Rossi", role: "PM", company: "Acme" };
const developer = { id: "person-2", firstName: "Laura", lastName: "Bianchi", role: "Developer", company: "Acme" };
const state = {
  schemaVersion: 3,
  projects: [project],
  people: [owner, developer],
  tasks: [
    { id: "task-1", projectId: project.id, title: "Backlog alignment", notes: "Priorità", conclusions: "", status: "Todo", priority: "High", tags: "planning", assigneePersonIds: [owner.id], dueDate: new Date(Date.now() - 86400000).toISOString(), completedAt: null, createdAt: start.toISOString(), updatedAt: start.toISOString() },
    { id: "task-2", projectId: project.id, title: "Build dashboard", notes: "", conclusions: "", status: "Doing", priority: "Medium", tags: "", assigneePersonIds: [developer.id], dueDate: new Date(Date.now() + 3 * 86400000).toISOString(), completedAt: null, createdAt: start.toISOString(), updatedAt: start.toISOString() },
    { id: "task-3", projectId: project.id, title: "Kickoff", notes: "", conclusions: "Feedback positivo", status: "Done", priority: "Medium", tags: "", assigneePersonIds: [owner.id, developer.id], dueDate: null, completedAt: start.toISOString(), createdAt: start.toISOString(), updatedAt: start.toISOString() }
  ]
};

test("project report includes metrics, risks and involved people", () => {
  const report = buildProjectReport(state, project, "Nota finale");

  assert.deepEqual(report.metrics, { totalTasks: 3, todoTasks: 1, doingTasks: 1, doneTasks: 1, overdueTasks: 1, dueSoonTasks: 1, completionRate: 1 / 3 });
  assert.deepEqual(report.people.map((person) => person.displayName), ["Laura Bianchi", "Mario Rossi"]);
  assert.equal(report.tasks.find((task) => task.title === "Backlog alignment").isOverdue, true);
  assert.equal(report.finalNotes, "Nota finale");
});

test("portfolio report starts on Monday and includes current-week completion", () => {
  const report = buildPortfolioReport(state, new Date());

  assert.equal(report.weekStart.getDay(), 1);
  assert.equal(report.weekEnd.getTime(), report.weekStart.getTime() + 6 * 86400000);
  assert.equal(report.completedThisWeek.some((task) => task.title === "Kickoff"), true);
  assert.equal(report.metrics.totalProjects, 1);
  assert.equal(report.metrics.overdueTasks, 1);
});

test("portfolio task assignees follow the WPF display-name order", () => {
  const first = { id: "person-a", firstName: "Zoe", lastName: "Alfa", role: "", company: "" };
  const second = { id: "person-b", firstName: "Anna", lastName: "Zeta", role: "", company: "" };
  const report = buildPortfolioReport({
    schemaVersion: 3,
    projects: [project],
    people: [first, second],
    tasks: [{
      id: "ordered-task",
      projectId: project.id,
      title: "Order assignees",
      status: "Todo",
      priority: "Medium",
      assigneePersonIds: [first.id, second.id],
      dueDate: new Date().toISOString(),
      completedAt: null,
      createdAt: start.toISOString(),
      updatedAt: start.toISOString()
    }]
  }, new Date());

  assert.equal(report.risks[0].assignees, "Anna Zeta, Zoe Alfa");
});

test("report sheet names preserve existing Excel contract", () => {
  assert.deepEqual(reportSheetNames("project"), ["Dashboard", "Anagrafica", "Persone", "Kanban", "Task Da Fare", "Task Presa in carico", "Task Fatti", "Note Finali"]);
  assert.deepEqual(reportSheetNames("portfolio"), ["Executive Dashboard", "Riepilogo Progetti", "Settimana Corrente", "Sforzo Progetti", "Persone", "Rischi"]);
});

test("portfolio completion counts use task identity, not duplicate titles", () => {
  const duplicateTitleState = {
    schemaVersion: 3,
    projects: [project],
    people: [owner],
    tasks: [
      { id: "done-1", projectId: project.id, title: "Same title", status: "Done", priority: "Medium", assigneePersonIds: [owner.id], dueDate: null, completedAt: start.toISOString(), createdAt: start.toISOString(), updatedAt: start.toISOString() },
      { id: "todo-1", projectId: project.id, title: "Same title", status: "Todo", priority: "Medium", assigneePersonIds: [owner.id], dueDate: null, completedAt: null, createdAt: start.toISOString(), updatedAt: start.toISOString() }
    ]
  };

  const report = buildPortfolioReport(duplicateTitleState, new Date());
  assert.equal(report.projects[0].completedThisWeek, 1);
  assert.equal(report.people[0].completedThisWeek, 1);
});

test("date-only report deadlines stay on the local calendar day", () => {
  const at = new Date(2026, 8, 8, 12, 0, 0);
  const dateOnlyState = {
    schemaVersion: 3,
    projects: [project],
    people: [],
    tasks: [{
      id: "date-only",
      projectId: project.id,
      title: "Date only",
      status: "Todo",
      priority: "Medium",
      assigneePersonIds: [],
      dueDate: "2026-09-08",
      completedAt: null,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString()
    }]
  };

  const report = buildProjectReport(dateOnlyState, project, null, at);
  assert.equal(report.tasks[0].isOverdue, false);
  assert.equal(report.tasks[0].isDueSoon, true);
});
