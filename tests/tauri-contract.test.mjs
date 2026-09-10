import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("Tauri development config starts and serves the bundled frontend", async () => {
  const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));

  assert.equal(config.build.devUrl, "http://127.0.0.1:4173");
  assert.equal(config.build.beforeDevCommand, "npm run dev");
  assert.equal(config.build.frontendDist, "../src");
});

test("a release Cargo build cannot silently use the development localhost URL", async () => {
  await assert.rejects(
    execFileAsync(
      "cargo",
      [
        "check",
        "--locked",
        "--release",
        "--no-default-features",
        "--manifest-path",
        "src-tauri/Cargo.toml"
      ],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          CARGO_BUILD_JOBS: "1",
          CARGO_INCREMENTAL: "0"
        }
      }
    ),
    (error) => {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      assert.match(output, /custom-protocol/);
      return true;
    }
  );
});

test("Tauri bundle uses the Broject icon assets", async () => {
  const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));

  assert.deepEqual(config.bundle.icon, ["icons/icon.png", "icons/icon.ico", "icons/icon.icns"]);
  await Promise.all(config.bundle.icon.map((icon) => access(new URL(`../src-tauri/${icon}`, import.meta.url))));
});

test("Tauri bundle keeps every desktop target enabled", async () => {
  const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));

  assert.equal(config.bundle.active, true);
  assert.equal(config.bundle.targets, "all");
  assert.equal(config.productName, "Broject");
  assert.equal(config.identifier, "com.broject.workspace");
});

test("macOS bundle icon is a self-consistent ICNS package", async () => {
  const icon = await readFile(new URL("../src-tauri/icons/icon.icns", import.meta.url));

  assert.equal(icon.subarray(0, 4).toString("ascii"), "icns");
  assert.equal(icon.readUInt32BE(4), icon.length);
});

test("native report command preserves the WPF export dialog title", async () => {
  const [main, reports] = await Promise.all([
    readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/reports.rs", import.meta.url), "utf8")
  ]);

  assert.match(main, /fn save_report\(\s*default_file_name: String,\s*dialog_title: String,\s*bytes: Vec<u8>,?\s*\)/s);
  assert.match(main, /reports::save_report\(&default_file_name, &dialog_title, bytes\)/);
  assert.match(reports, /pub fn save_report\(\s*default_file_name: &str,\s*dialog_title: &str,\s*bytes: Vec<u8>,?\s*\)/s);
  assert.match(reports, /choose_save_path\(&default_file_name, dialog_title\)/);
  assert.match(reports, /fn choose_save_path\(\s*_?default_file_name: &str,\s*_?dialog_title: &str,?\s*\)/s);
});

test("native report command refuses bytes that are not an XLSX package", async () => {
  const reports = await readFile(new URL("../src-tauri/src/reports.rs", import.meta.url), "utf8");

  assert.match(reports, /fn is_xlsx_package\(bytes: &\[u8\]\) -> bool/);
  assert.match(reports, /if !is_xlsx_package\(&bytes\)/);
  assert.match(reports, /Il report non è un workbook XLSX valido/);
});

test("native save-dialog launch failures expose the browser-fallback marker", async () => {
  const reports = await readFile(new URL("../src-tauri/src/reports.rs", import.meta.url), "utf8");

  assert.equal(
    (reports.match(/map_err\(\|error\| format!\("Il dialogo di salvataggio non è disponibile:/g) ?? []).length,
    2
  );
  assert.match(reports, /format!\(\s*"Il dialogo di salvataggio non è disponibile \(\{program\}\): \{error\}"\s*\)/s);
});

test("native storage normalizes WPF payloads and repairs references before persistence", async () => {
  const storage = await readFile(new URL("../src-tauri/src/storage.rs", import.meta.url), "utf8");

  assert.match(storage, /fn normalize_workspace\(state: Value\) -> Value/);
  assert.match(storage, /let state = normalize_workspace\(state\);/);
  assert.match(storage, /state: normalize_workspace\(state\)/);
  assert.match(storage, /AssigneePersonId/);
  assert.match(storage, /repaired_project_ids/);
  assert.match(storage, /repaired_person_ids/);
});

test("native Unix single-instance lock is user-only", async () => {
  const instance = await readFile(new URL("../src-tauri/src/instance.rs", import.meta.url), "utf8");

  assert.match(instance, /OpenOptionsExt/);
  assert.match(instance, /\.mode\(0o600\)/);
  assert.match(instance, /Permissions::from_mode\(0o600\)/);
});

test("native runtime error logging preserves the WPF recovery path", async () => {
  const [main, app] = await Promise.all([
    readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8"),
    readFile(new URL("../src/app.mjs", import.meta.url), "utf8")
  ]);

  assert.match(main, /fn log_error\(error: String\)/);
  assert.match(main, /storage::write_error_log\(&error\)/);
  assert.match(main, /log_error/);
  assert.match(app, /addEventListener\("error"/);
  assert.match(app, /addEventListener\("unhandledrejection"/);
  assert.match(app, /Si è verificato un errore inatteso/);
  assert.match(app, /Puoi continuare a lavorare/);
});

test("native runtime error logging protects the application directory before writing", async () => {
  const storage = await readFile(new URL("../src-tauri/src/storage.rs", import.meta.url), "utf8");

  const loggingBlock = storage.match(/pub fn write_error_log[\s\S]*?\n}\n\nfn default_paths/);
  assert.ok(loggingBlock, "write_error_log block should remain easy to audit");
  assert.match(loggingBlock[0], /fs::create_dir_all\(&directory\)/);
  assert.match(loggingBlock[0], /fs::set_permissions\(&directory, std::fs::Permissions::from_mode\(0o700\)\)/);
});

test("native startup failures preserve the WPF data-safety copy", async () => {
  const main = await readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8");

  assert.match(main, /Broject non è riuscito ad avviarsi\. I dati locali non sono stati modificati\./);
  assert.match(main, /Il dettaglio tecnico è stato salvato nel file broject-error\.log\./);
});

test("native runtime failures preserve the WPF recovery copy", async () => {
  const main = await readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8");

  assert.match(main, /Si è verificato un errore inatteso\. Le modifiche già confermate restano salvate\.\\n\\nPuoi continuare a lavorare; se il problema si ripete, consulta broject-error\.log\./);
});

test("native unrecoverable storage errors preserve the WPF recovery instructions", async () => {
  const storage = await readFile(new URL("../src-tauri/src/storage.rs", import.meta.url), "utf8");

  assert.match(storage, /I file sono stati conservati in \{\}\. Ripristina una copia valida prima di riaprire l’app\./);
});

test("native storage exposes a persistent configurable data-directory contract", async () => {
  const [storage, main] = await Promise.all([
    readFile(new URL("../src-tauri/src/storage.rs", import.meta.url), "utf8"),
    readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8")
  ]);

  assert.match(storage, /pub struct StorageLocation/);
  assert.match(storage, /pub struct StorageInspection/);
  assert.match(storage, /broject-settings\.json/);
  assert.match(storage, /pub fn get_storage_location\(\)/);
  assert.match(storage, /pub fn choose_storage_location\(\)/);
  assert.match(storage, /pub fn inspect_storage_location\(/);
  assert.match(storage, /pub fn set_storage_location\(/);
  assert.match(storage, /contains_workspace/);
  assert.match(storage, /use-existing/);
  assert.match(storage, /FolderBrowserDialog/);
  assert.match(storage, /choose folder/);
  assert.match(storage, /--file-selection/);
  assert.match(storage, /--directory/);
  assert.match(main, /fn get_storage_location\(\)/);
  assert.match(main, /fn choose_storage_location\(\)/);
  assert.match(main, /fn inspect_storage_location\(directory: String\)/);
  assert.match(main, /fn set_storage_location\(\s*directory: String,\s*mode: String,?\s*\)/s);
  assert.match(main, /get_storage_location,\s*choose_storage_location,\s*inspect_storage_location,\s*set_storage_location/s);
});
