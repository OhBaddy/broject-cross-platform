import test from "node:test";
import assert from "node:assert/strict";
import {
  overviewFocusTasks,
  overviewHint,
  projectStatus,
  sortOverviewProjects,
  myWorkSnapshot,
  formatTaskTags,
  taskDueLabel,
  taskDueTone,
  localDate,
  peopleSnapshot,
  peopleSearchSnapshot,
  parseItalianDate,
  formatItalianDate,
  completedSummaryLabel,
  relativeTime
} from "../src/core/dashboard-query.mjs";

const today = new Date("2026-09-08T12:00:00");

test("overview focus follows WPF priority, overdue and six-item rules", () => {
  const tasks = [
    { id: "far-high", title: "Far high", status: "Todo", priority: "High", dueDate: "2026-12-01" },
    { id: "overdue-medium", title: "Overdue", status: "Doing", priority: "Medium", dueDate: "2026-09-01" },
    { id: "urgent-none", title: "Urgent", status: "Todo", priority: "Urgent", dueDate: null },
    { id: "soon-low", title: "Soon", status: "Todo", priority: "Low", dueDate: "2026-09-10" },
    { id: "done-urgent", title: "Done", status: "Done", priority: "Urgent", dueDate: "2026-09-01" },
    { id: "high-none", title: "High no date", status: "Doing", priority: "High", dueDate: null },
    { id: "soon-high", title: "Soon high", status: "Todo", priority: "High", dueDate: "2026-09-12" },
    { id: "overdue-urgent", title: "Overdue urgent", status: "Todo", priority: "Urgent", dueDate: "2026-09-02" }
  ];

  assert.deepEqual(overviewFocusTasks(tasks, today).map((task) => task.id), [
    "overdue-urgent",
    "overdue-medium",
    "urgent-none",
    "soon-high",
    "far-high",
    "high-none"
  ]);
  assert.deepEqual(tasks.map((task) => task.id), [
    "far-high",
    "overdue-medium",
    "urgent-none",
    "soon-low",
    "done-urgent",
    "high-none",
    "soon-high",
    "overdue-urgent"
  ]);
});

test("overview hint and project cards use WPF wording and ordering", () => {
  assert.equal(
    overviewHint([
      { status: "Todo", dueDate: "2026-09-07" },
      { status: "Doing", dueDate: null }
    ], today),
    "1 attività scadute: decidi da quale ripartire."
  );
  assert.equal(overviewHint([{ status: "Todo", dueDate: null }], today), "1 attività aperte. Scegli il prossimo passo.");
  assert.equal(overviewHint([{ status: "Done", dueDate: "2026-09-01" }], today), "Tutto pronto per il prossimo progetto.");

  const projects = [
    { id: "alpha", name: "Alpha" },
    { id: "beta", name: "Beta" },
    { id: "gamma", name: "Gamma" },
    { id: "delta", name: "Delta" },
    { id: "epsilon", name: "Epsilon" },
    { id: "zeta", name: "Zeta" },
    { id: "eta", name: "Eta" }
  ];
  const tasks = [
    { projectId: "alpha", status: "Todo" },
    { projectId: "beta", status: "Done" },
    { projectId: "beta", status: "Done" },
    { projectId: "gamma", status: "Done" },
    { projectId: "gamma", status: "Todo" }
  ];

  assert.deepEqual(sortOverviewProjects(projects, tasks).map((project) => project.id), [
    "beta", "gamma", "alpha", "delta", "epsilon", "eta"
  ]);
});

test("project status and My Work metrics mirror WPF", () => {
  assert.deepEqual(projectStatus([], today), { label: "Da pianificare", danger: false });
  assert.deepEqual(projectStatus([{ status: "Todo", dueDate: "2026-09-07" }], today), { label: "1 rischio", danger: true });
  assert.deepEqual(projectStatus([
    { status: "Todo", dueDate: "2026-09-07" },
    { status: "Todo", dueDate: "2026-09-07" }
  ], today), { label: "2 rischi", danger: true });
  assert.deepEqual(projectStatus([{ status: "Done", dueDate: "2026-09-07" }], today), { label: "Completato", danger: false });
  assert.deepEqual(projectStatus([{ status: "Doing", dueDate: null }], today), { label: "In linea", danger: false });

  const tasks = [
    { id: "mine-todo", assigneePersonIds: ["p1"], status: "Todo", priority: "Low", dueDate: "2026-09-11" },
    { id: "mine-doing", assigneePersonIds: ["p1"], status: "Doing", priority: "Urgent", dueDate: null },
    { id: "mine-overdue", assigneePersonIds: ["p1"], status: "Todo", priority: "High", dueDate: "2026-09-07" },
    { id: "mine-done", assigneePersonIds: ["p1"], status: "Done", priority: "Medium", dueDate: null, completedAt: "2026-09-08T10:00:00" },
    { id: "other", assigneePersonIds: ["p2"], status: "Todo", priority: "Urgent", dueDate: "2026-09-08" }
  ];
  const snapshot = myWorkSnapshot(tasks, "p1", today);
  assert.deepEqual(snapshot.todo.map((task) => task.id), ["mine-overdue", "mine-todo"]);
  assert.deepEqual(snapshot.doing.map((task) => task.id), ["mine-doing"]);
  assert.deepEqual(snapshot.due.map((task) => task.id), ["mine-overdue", "mine-todo"]);
  assert.deepEqual(snapshot.completed.map((task) => task.id), ["mine-done"]);
  assert.deepEqual(snapshot.metrics, { todo: 2, doing: 1, overdue: 1, completedThisWeek: 1 });
});

test("task labels mirror WPF tags, notes and due-date states", () => {
  assert.equal(formatTaskTags("alpha, #beta, gamma, delta, epsilon"), "#alpha  #beta  #gamma  #delta");
  assert.equal(formatTaskTags("  "), "");
  assert.equal(taskDueLabel({ status: "Done", dueDate: null }, today), "Completata");
  assert.equal(taskDueLabel({ status: "Todo", dueDate: null }, today), "Senza scadenza");
  assert.equal(taskDueLabel({ status: "Todo", dueDate: "2026-09-06" }, today), "Scaduta da 2g");
  assert.equal(taskDueLabel({ status: "Todo", dueDate: "2026-09-08" }, today), "Oggi");
  assert.equal(taskDueLabel({ status: "Todo", dueDate: "2026-09-09" }, today), "Domani");
  assert.equal(taskDueTone({ status: "Done", dueDate: "2026-09-08" }, today), "done");
  assert.equal(taskDueTone({ status: "Todo", dueDate: "2026-09-06" }, today), "danger");
  assert.equal(taskDueTone({ status: "Todo", dueDate: "2026-09-10" }, today), "warning");
  assert.equal(taskDueTone({ status: "Todo", dueDate: "2026-09-20" }, today), "secondary");
});

test("people summary follows WPF assignment and workload rules", () => {
  const people = [
    { id: "p2", firstName: "Zoe", lastName: "Bianchi" },
    { id: "p1", firstName: "Anna", lastName: "Rossi", role: "", company: "" }
  ];
  const tasks = [
    { assigneePersonIds: ["p1"], status: "Todo" },
    { assigneePersonIds: ["p1", "p2"], status: "Doing" },
    { assigneePersonIds: ["p2"], status: "Done" },
    { assigneePersonIds: [], status: "Todo" }
  ];
  const snapshot = peopleSnapshot(people, tasks);
  assert.deepEqual(snapshot.people.map((person) => person.person.id), ["p2", "p1"]);
  assert.deepEqual(snapshot.people.map((person) => person.open), [1, 2]);
  assert.equal(snapshot.assignedTaskCount, 3);
  assert.equal(snapshot.workloadText, "Anna Rossi ha il carico più alto: 2 attività aperte.");
});

test("people workload text uses the WPF display-name fallback", () => {
  const snapshot = peopleSnapshot(
    [{ id: "unnamed", firstName: "", lastName: "" }],
    [{ assigneePersonIds: ["unnamed"], status: "Todo" }]
  );

  assert.equal(snapshot.workloadText, "Senza nome ha il carico più alto: 1 attività aperte.");
});

test("search people cards preserve WPF result order and have no workload bar", () => {
  const people = [
    { id: "p2", firstName: "Zoe", lastName: "Bianchi" },
    { id: "p1", firstName: "Anna", lastName: "Rossi" }
  ];
  const tasks = [
    { assigneePersonIds: ["p2"], status: "Todo" },
    { assigneePersonIds: ["p1"], status: "Doing" },
    { assigneePersonIds: ["p1"], status: "Done" }
  ];

  const snapshot = peopleSearchSnapshot(people, tasks);

  assert.deepEqual(snapshot.map((person) => person.person.id), ["p2", "p1"]);
  assert.deepEqual(snapshot.map((person) => person.open), [1, 1]);
  assert.deepEqual(snapshot.map((person) => person.workloadPercent), [0, 0]);
});

test("date-only task values stay on their local calendar day", () => {
  const value = localDate("2026-09-08");
  assert.equal(value.getFullYear(), 2026);
  assert.equal(value.getMonth(), 8);
  assert.equal(value.getDate(), 8);
});

test("overview activity times mirror WPF relative and completed labels", () => {
  const now = new Date("2026-09-08T12:00:00");

  assert.equal(relativeTime("2026-09-08T11:59:30", now), "Adesso");
  assert.equal(relativeTime("2026-09-08T11:45:00", now), "15 min fa");
  assert.equal(relativeTime("2026-09-08T09:00:00", now), "3 h fa");
  assert.equal(relativeTime("2026-09-06T12:00:00", now), "2 g fa");
  assert.equal(completedSummaryLabel("2026-09-08T14:30:00"), "mar 14:30");
  assert.equal(completedSummaryLabel(null), "Completata");
});

test("task editor dates follow the Italian WPF contract", () => {
  assert.equal(formatItalianDate("2026-09-08"), "08/09/2026");
  assert.equal(formatItalianDate(null), "");
  assert.equal(parseItalianDate("08/09/2026"), "2026-09-08");
  assert.equal(parseItalianDate("8/9/2026"), "2026-09-08");
  assert.equal(parseItalianDate("31/02/2026"), null);
  assert.equal(parseItalianDate("testo non valido"), null);
});
