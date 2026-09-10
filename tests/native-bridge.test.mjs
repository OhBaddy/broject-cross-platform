import test from "node:test";
import assert from "node:assert/strict";
import { createNativeBridge } from "../src/core/native-bridge.mjs";

test("native bridge loads PascalCase state from Tauri command", async () => {
  const calls = [];
  const bridge = createNativeBridge(async (command, args) => {
    calls.push([command, args]);
    return {
      state: { SchemaVersion: 3, Projects: [{ Id: "p1", Name: "Legacy" }], People: [], Tasks: [] },
      recoveryMessage: "Recuperato"
    };
  });

  const result = await bridge.load();

  assert.equal(result.state.projects[0].name, "Legacy");
  assert.equal(result.recoveryMessage, "Recuperato");
  assert.equal(calls[0][0], "load_workspace");
});

test("native bridge saves PascalCase payload through Tauri command", async () => {
  let received;
  const bridge = createNativeBridge(async (command, args) => {
    received = { command, args };
    return null;
  });

  await bridge.save({ schemaVersion: 3, projects: [{ id: "p1", name: "Alpha" }], people: [], tasks: [] });

  assert.equal(received.command, "save_workspace");
  const payload = JSON.parse(received.args.stateJson);
  assert.equal(payload.Projects[0].Id, "p1");
  assert.equal(payload.Projects[0].Name, "Alpha");
});

test("native bridge sends XLSX bytes to the native save dialog", async () => {
  let received;
  const bridge = createNativeBridge(async (command, args) => {
    received = { command, args };
    return { saved: true, path: "/tmp/Broject.xlsx" };
  });

  const result = await bridge.saveReport(new Uint8Array([80, 75, 3, 4]), "Broject.xlsx", "Esporta report progetto");

  assert.deepEqual(result, { saved: true, path: "/tmp/Broject.xlsx" });
  assert.equal(received.command, "save_report");
  assert.deepEqual(received.args, {
    defaultFileName: "Broject.xlsx",
    dialogTitle: "Esporta report progetto",
    bytes: [80, 75, 3, 4]
  });
});

test("native bridge opens a saved report through the desktop shell", async () => {
  let received;
  const bridge = createNativeBridge(async (command, args) => {
    received = { command, args };
    return { opened: true };
  });

  const result = await bridge.openReport("/tmp/Broject.xlsx");

  assert.deepEqual(result, { opened: true });
  assert.deepEqual(received, {
    command: "open_report",
    args: { path: "/tmp/Broject.xlsx" }
  });
});

test("browser bridge reports a canceled native export without touching the DOM", async () => {
  const bridge = createNativeBridge(null, { save() {}, load() {} });

  assert.deepEqual(await bridge.saveReport(new Uint8Array([1]), "Broject.xlsx"), {
    saved: false,
    native: false
  });
  assert.deepEqual(await bridge.openReport("/tmp/Broject.xlsx"), {
    opened: false,
    native: false
  });
});

test("native bridge forwards unexpected runtime errors to the local log", async () => {
  let received;
  const bridge = createNativeBridge(async (command, args) => {
    received = { command, args };
    return null;
  });

  await bridge.logError("Errore frontend di prova");

  assert.deepEqual(received, {
    command: "log_error",
    args: { error: "Errore frontend di prova" }
  });
});
