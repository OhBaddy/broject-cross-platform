import fs from "node:fs/promises";
import path from "node:path";
import playwright from "/home/ohbaddy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const { chromium } = playwright;
const baseUrl = process.env.BROJECT_BASE_URL ?? "http://127.0.0.1:4174";
const width = Number(process.env.BROJECT_AUDIT_WIDTH ?? 1440);
const height = Number(process.env.BROJECT_AUDIT_HEIGHT ?? 900);
const outputRoot = path.resolve(process.env.BROJECT_AUDIT_ROOT ?? "docs/ui-finish-audit/2026-09-10");
const resolutionRoot = path.join(outputRoot, "screens", `${width}x${height}`);

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

const emptyState = { SchemaVersion: 3, Projects: [], People: [], Tasks: [] };
const waitForUi = async (page) => {
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector(".content-scroller")?.scrollTo(0, 0);
  });
};

const visible = (element) => {
  if (!element) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};

const inspectPage = async (page) => page.evaluate(() => {
  const visibleElement = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const rectFor = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      className: typeof element.className === "string" ? element.className : null,
      x: Math.round(rect.x * 10) / 10,
      y: Math.round(rect.y * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 120)
    };
  };
  const selectors = [
    ".app-shell", ".sidebar", ".topbar", ".content-scroller", ".view-panel:not(.is-hidden)",
    ".search-surface:not(.is-hidden)", ".view-intro", ".project-heading", ".project-toolbar",
    ".project-board", ".board-column", ".task-stack", ".calendar-toolbar", ".calendar-grid",
    ".calendar-day", ".my-work-grid", ".people-summary", ".people-grid", ".report-grid",
    ".report-card", ".report-note", ".search-results", ".task-drawer:not(.is-hidden)",
    "dialog[open]", ".help-copy", ".drawer-actions", ".modal-actions"
  ];
  const targets = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].filter(visibleElement).map(rectFor));
  const overflow = [...document.querySelectorAll("*")].filter(visibleElement).flatMap((element) => {
    const rect = element.getBoundingClientRect();
    const isOutOfViewport = rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
    const isHorizontallyScrollable = element.scrollWidth > element.clientWidth + 1;
    const isVerticallyScrollable = element.scrollHeight > element.clientHeight + 1;
    if (!isOutOfViewport && !isHorizontallyScrollable && !isVerticallyScrollable) return [];
    return [{
      ...rectFor(element),
      isOutOfViewport,
      isHorizontallyScrollable,
      isVerticallyScrollable,
      overflowX: getComputedStyle(element).overflowX,
      overflowY: getComputedStyle(element).overflowY
    }];
  }).slice(0, 120);
  const textOverflow = [...document.querySelectorAll("h1,h2,h3,h4,p,span,button,label,th,td")].filter(visibleElement).flatMap((element) => {
    if (element.scrollWidth <= element.clientWidth + 1) return [];
    return [rectFor(element)];
  }).slice(0, 80);
  return {
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight },
    activeElement: document.activeElement?.id || document.activeElement?.tagName?.toLowerCase() || null,
    openDialogs: [...document.querySelectorAll("dialog[open]")].map((element) => element.id),
    targets,
    overflow,
    textOverflow
  };
});

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROJECT_CHROMIUM ?? "/snap/bin/chromium",
  args: ["--no-sandbox"]
});
const page = await browser.newPage({ viewport: { width, height } });
await fs.mkdir(resolutionRoot, { recursive: true });

const screenshots = [];
const metrics = {};
const capture = async (name, note = "") => {
  await waitForUi(page);
  const screenshotPath = path.join(resolutionRoot, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  screenshots.push({ name, file: path.relative(outputRoot, screenshotPath), note });
  metrics[name] = await inspectPage(page);
};

const seed = async (nextState) => {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate((value) => {
    localStorage.clear();
    localStorage.setItem("broject:primary", JSON.stringify(value));
  }, nextState);
  await page.reload({ waitUntil: "networkidle" });
  await waitForUi(page);
};

await seed(state);
await capture("overview", "Vista iniziale con dati rappresentativi.");
await page.locator("#projectNavList .project-nav-item").first().click();
await capture("project-board", "Bacheca del primo progetto.");
await page.locator('[data-project-view="list"]').click();
await capture("project-list", "Elenco attività.");
await page.locator('[data-project-view="calendar"]').click();
await capture("project-calendar-left", "Settimana con scroll orizzontale allineato a sinistra.");
await page.locator("#calendarGrid").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
await capture("project-calendar-right", "Estremo destro della settimana, per verificare la discoverability dello scroll.");
await page.locator('.nav-button[data-section="my-work"]').click();
await capture("my-work", "Il mio lavoro con KPI, liste e dettaglio completati.");
await page.locator('.nav-button[data-section="people"]').click();
await capture("people", "Persone con riepilogo, carico e schede.");
await page.locator('.nav-button[data-section="reports"]').click();
await capture("reports", "Report e azioni di export.");
await page.locator("#helpButton").click();
await capture("help-top", "Guida aperta nella posizione iniziale dello scroll.");
await page.locator("#helpDialog .help-copy").evaluate((element) => { element.scrollTop = element.scrollHeight; });
await capture("help-bottom", "Guida aperta in fondo allo scroll.");
await page.keyboard.press("Escape");
await page.locator('.nav-button[data-section="overview"]').click();
await page.locator("#globalSearch").fill("Alpha");
await capture("search", "Risultati ricerca globale.");
await page.keyboard.press("Escape");
await page.locator("#projectNavList .project-nav-item").first().click();
await page.locator('[data-project-view="board"]').click();
await page.locator("#addTaskButton").click();
await capture("task-drawer", "Editor attività vuoto con azioni fisse.");
await page.locator("#closeDrawerButton").click();
await page.locator("#newProjectButton").click();
await capture("project-dialog", "Dialog nuovo progetto.");
await page.locator("#projectDialog").locator('button[aria-label="Chiudi"]').click();
await page.locator('.nav-button[data-section="people"]').click();
await page.locator("#addPersonButton").click();
await capture("person-dialog", "Dialog nuova persona.");
await page.locator("#personDialog").locator('button[aria-label="Chiudi"]').click();
await page.locator('.nav-button[data-section="reports"]').click();
await page.locator("#reportProjectSelect").selectOption("project-alpha");
await page.locator("#exportProjectButton").click();
await capture("report-notes-dialog", "Dialog note finali prima dell’export progetto.");
await page.locator("#reportNotesDialog").locator('button[aria-label="Chiudi"]').click();

await seed(emptyState);
await capture("empty-overview", "Panoramica senza progetti, persone o attività.");
await page.locator('.nav-button[data-section="people"]').click();
await capture("empty-people", "Stato vuoto Persone.");
await page.locator('.nav-button[data-section="my-work"]').click();
await capture("empty-my-work", "Stato vuoto Il mio lavoro.");

await fs.writeFile(path.join(resolutionRoot, "metrics.json"), JSON.stringify({ width, height, screenshots, metrics }, null, 2));
await browser.close();
console.log(JSON.stringify({ width, height, outputRoot, screenshots: screenshots.length, metrics: path.join(resolutionRoot, "metrics.json") }));
