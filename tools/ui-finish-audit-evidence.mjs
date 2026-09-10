import fs from "node:fs/promises";
import path from "node:path";
import playwright from "/home/ohbaddy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const { chromium } = playwright;
const baseUrl = process.env.BROJECT_BASE_URL ?? "http://127.0.0.1:4174";
const width = Number(process.env.BROJECT_AUDIT_WIDTH ?? 1080);
const height = Number(process.env.BROJECT_AUDIT_HEIGHT ?? 720);
const root = path.resolve(process.env.BROJECT_AUDIT_ROOT ?? "docs/ui-finish-audit/2026-09-10");
const evidenceRoot = path.join(root, "evidence");
const state = {
  SchemaVersion: 3,
  Projects: [
    { Id: "project-alpha", Name: "Alpha rollout", Description: "Lancio commerciale e coordinamento operativo.", AccentColor: "#00A8A8", CreatedAt: "2026-09-01T09:00:00.000Z", UpdatedAt: "2026-09-09T09:00:00.000Z" },
    { Id: "project-beta", Name: "Beta platform", Description: "Stabilizzazione della piattaforma e qualità.", AccentColor: "#E14D72", CreatedAt: "2026-08-21T09:00:00.000Z", UpdatedAt: "2026-09-08T09:00:00.000Z" }
  ],
  People: [
    { Id: "person-anna", FirstName: "Anna", LastName: "Rossi", Role: "Product manager", Company: "Broject" },
    { Id: "person-luca", FirstName: "Luca", LastName: "Bianchi", Role: "Designer", Company: "Studio Nord" },
    { Id: "person-marta", FirstName: "Marta", LastName: "Verdi", Role: "Engineering lead", Company: "Broject" }
  ],
  Tasks: [
    { Id: "task-1", ProjectId: "project-alpha", Title: "Definire il piano di lancio", Notes: "Allineare canali e responsabilità.", Status: "Todo", Priority: "Urgent", Tags: "go-to-market, leadership", AssigneePersonIds: ["person-anna"], DueDate: "2026-09-10", CreatedAt: "2026-09-01T10:00:00.000Z", UpdatedAt: "2026-09-09T09:00:00.000Z" },
    { Id: "task-2", ProjectId: "project-alpha", Title: "Preparare il kit commerciale", Notes: "Versione pronta per la revisione.", Status: "Doing", Priority: "High", Tags: "sales", AssigneePersonIds: ["person-luca", "person-anna"], DueDate: "2026-09-12", CreatedAt: "2026-09-02T10:00:00.000Z", UpdatedAt: "2026-09-08T09:00:00.000Z" },
    { Id: "task-3", ProjectId: "project-alpha", Title: "Rivedere il budget media", Notes: null, Status: "Done", Priority: "Medium", Tags: "budget", AssigneePersonIds: ["person-anna"], DueDate: "2026-09-05", CompletedAt: "2026-09-06T09:00:00.000Z", CreatedAt: "2026-09-01T10:00:00.000Z", UpdatedAt: "2026-09-06T09:00:00.000Z" },
    { Id: "task-4", ProjectId: "project-beta", Title: "Chiudere i bug critici", Notes: "Verificare i casi di errore principali.", Status: "Todo", Priority: "High", Tags: "quality", AssigneePersonIds: ["person-marta"], DueDate: "2026-09-11", CreatedAt: "2026-09-03T10:00:00.000Z", UpdatedAt: "2026-09-09T08:00:00.000Z" },
    { Id: "task-5", ProjectId: "project-beta", Title: "Aggiornare la documentazione", Notes: null, Status: "Doing", Priority: "Low", Tags: "docs", AssigneePersonIds: [], DueDate: null, CreatedAt: "2026-09-04T10:00:00.000Z", UpdatedAt: "2026-09-07T08:00:00.000Z" }
  ]
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROJECT_CHROMIUM ?? "/snap/bin/chromium",
  args: ["--no-sandbox"]
});
const page = await browser.newPage({ viewport: { width, height } });
await fs.mkdir(evidenceRoot, { recursive: true });

const seed = async () => {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("broject:primary", JSON.stringify(value));
  }, state);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(120);
};

const capture = async (finding, name, locator) => {
  const target = page.locator(locator).first();
  await target.waitFor({ state: "visible" });
  const directory = path.join(evidenceRoot, finding);
  await fs.mkdir(directory, { recursive: true });
  await target.screenshot({ path: path.join(directory, `${width}x${height}-${name}.png`) });
};

await seed();
await page.locator("#projectNavList .project-nav-item").first().click();
await page.locator('[data-project-view="board"]').click();
await capture("F01-board-card-overflow", "board-column", ".todo-column");
await capture("F09-status-line-corners", "task-card", ".todo-column .task-card");
await page.locator('[data-project-view="calendar"]').click();
await capture("F02-calendar-scroll-affordance", "calendar-left", "#calendarGrid");
await page.locator("#calendarGrid").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
await capture("F02-calendar-scroll-affordance", "calendar-right", "#calendarGrid");
await page.locator('.nav-button[data-section="my-work"]').click();
await capture("F03-my-work-column-height", "columns", ".my-work-grid");
await capture("F10-my-work-inner-gutter", "column", ".my-work-grid .section-card");
await page.locator('.nav-button[data-section="people"]').click();
await capture("F04-people-metadata-truncation", "people-cards", "#peopleList");
await page.locator('.nav-button[data-section="reports"]').click();
await capture("F05-report-card-whitespace", "report-cards", ".report-grid");
await page.locator("#helpButton").click();
await capture("F06-help-scroll-clipping", "help-top", "#helpDialog");
await page.keyboard.press("Escape");
await page.locator("#newProjectButton").click();
await capture("F07-modal-min-height", "project-dialog", "#projectDialog");
await page.locator("#projectDialog").locator('button[aria-label="Chiudi"]').click();
await page.locator('.nav-button[data-section="people"]').click();
await page.locator("#addPersonButton").click();
await capture("F07-modal-min-height", "person-dialog", "#personDialog");
await page.locator("#personDialog").locator('button[aria-label="Chiudi"]').click();
await page.locator('.nav-button[data-section="reports"]').click();
await page.locator("#reportProjectSelect").selectOption("project-alpha");
await page.locator("#exportProjectButton").click();
await capture("F07-modal-min-height", "report-notes-dialog", "#reportNotesDialog");

await browser.close();
console.log(JSON.stringify({ width, height, evidenceRoot }));
