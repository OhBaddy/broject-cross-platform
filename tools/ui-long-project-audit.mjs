import fs from "node:fs/promises";
import path from "node:path";
import playwright from "/home/ohbaddy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

const { chromium } = playwright;
const baseUrl = process.env.BROJECT_BASE_URL ?? "http://127.0.0.1:4174";
const width = Number(process.env.BROJECT_AUDIT_WIDTH ?? 1080);
const height = Number(process.env.BROJECT_AUDIT_HEIGHT ?? 720);
const outputRoot = path.resolve(process.env.BROJECT_AUDIT_ROOT ?? "docs/ui-finish-audit/2026-09-10");
const outputDirectory = path.join(outputRoot, "evidence", "F11-long-project-name");
const longName = "Piano di rilascio commerciale e coordinamento operativo per Windows";
const state = {
  SchemaVersion: 3,
  Projects: [
    { Id: "project-alpha", Name: longName, Description: "Lancio commerciale e coordinamento operativo.", AccentColor: "#00A8A8", CreatedAt: "2026-09-01T09:00:00.000Z", UpdatedAt: "2026-09-09T09:00:00.000Z" },
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
await fs.mkdir(outputDirectory, { recursive: true });

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate((value) => {
  localStorage.clear();
  localStorage.setItem("broject:primary", JSON.stringify(value));
}, state);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(150);
await page.locator("#projectNavList .project-nav-item").nth(1).click();
await page.waitForTimeout(120);

await page.screenshot({ path: path.join(outputDirectory, `${width}x${height}-long-project-board.png`), fullPage: false });
await page.locator("#projectTitle").screenshot({ path: path.join(outputDirectory, `${width}x${height}-project-heading.png`) });
await page.locator("#projectNavList").screenshot({ path: path.join(outputDirectory, `${width}x${height}-project-sidebar.png`) });

const metrics = await page.evaluate((expectedName) => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return { tag: element.tagName.toLowerCase(), id: element.id || null, className: typeof element.className === "string" ? element.className : null, x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, scrollLeft: element.scrollLeft, overflowX: getComputedStyle(element).overflowX, text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 180) };
  };
  const selectors = [".content-scroller", ".view-panel:not(.is-hidden)", ".project-heading", ".project-heading-main", ".project-heading-main > div:last-child", "#projectTitle", ".project-heading-actions", ".project-toolbar", ".filter-bar", ".project-nav-list", ".project-nav-item", ".project-nav-copy", ".project-nav-name"];
  const selected = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].filter(visible).map(rect));
  const overflowing = [...document.querySelectorAll("*")].filter(visible).flatMap((element) => {
    if (element.scrollWidth <= element.clientWidth + 1) return [];
    return [rect(element)];
  }).slice(0, 80);
  return {
    longName: expectedName,
    viewport: { width: innerWidth, height: innerHeight },
    document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight },
    selected,
    overflowing
  };
}, longName);
await fs.writeFile(path.join(outputDirectory, `${width}x${height}-metrics.json`), JSON.stringify(metrics, null, 2));
await browser.close();
console.log(JSON.stringify({ width, height, longName, outputDirectory }));
