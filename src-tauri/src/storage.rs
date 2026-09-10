use serde::Serialize;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResponse {
    pub state: Value,
    pub recovery_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocation {
    pub directory: String,
    pub is_default: bool,
    pub contains_workspace: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StorageInspection {
    pub directory: String,
    pub is_default: bool,
    pub contains_workspace: bool,
    pub has_primary: bool,
    pub has_backup: bool,
    pub has_corrupt: bool,
    pub has_log: bool,
}

#[derive(Debug, Clone)]
struct StoragePaths {
    data: PathBuf,
    backup: PathBuf,
    corrupt: PathBuf,
    log: PathBuf,
}

pub fn load_workspace() -> Result<LoadResponse, String> {
    load_from_paths(&default_paths()?)
}

pub fn save_workspace(state_json: &str) -> Result<(), String> {
    let state: Value = serde_json::from_str(state_json)
        .map_err(|error| format!("JSON dati non valido: {error}"))?;
    if !state.is_object() {
        return Err("JSON dati non valido: il workspace deve essere un oggetto JSON.".to_string());
    }
    let state = normalize_workspace(state);
    save_to_paths(&default_paths()?, &state, true)
}

pub fn write_error_log(error: &str) {
    let message = format!("[{}] {}\n\n", timestamp_label(), error);
    let mut directories = Vec::new();
    if let Ok(directory) = active_data_directory() {
        directories.push(directory);
    }
    if let Ok(directory) = application_directory() {
        if !directories
            .iter()
            .any(|candidate| same_directory(candidate, &directory))
        {
            directories.push(directory);
        }
    }

    for directory in directories {
        if fs::create_dir_all(&directory).is_err() {
            continue;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).is_err() {
                continue;
            }
        }
        let path = directory.join("broject-error.log");
        let result = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .and_then(|mut file| {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = file.set_permissions(std::fs::Permissions::from_mode(0o600));
                }
                use std::io::Write;
                file.write_all(message.as_bytes())
            });
        if result.is_ok() {
            return;
        }
    }
}

fn default_paths() -> Result<StoragePaths, String> {
    Ok(paths_for_directory(active_data_directory()?))
}

pub fn get_storage_location() -> Result<StorageLocation, String> {
    let directory = active_data_directory()?;
    storage_location_for_directory(&directory)
}

pub fn choose_storage_location() -> Result<Option<StorageLocation>, String> {
    let Some(directory) = choose_data_directory()? else {
        return Ok(None);
    };
    let directory = validate_directory_path(directory)?;
    storage_location_for_directory(&directory).map(Some)
}

pub fn inspect_storage_location(directory: &str) -> Result<StorageInspection, String> {
    let directory = validate_directory_path(PathBuf::from(directory))?;
    inspect_directory(&directory)
}

pub fn set_storage_location(directory: &str, mode: &str) -> Result<StorageLocation, String> {
    if !matches!(mode, "copy" | "use-existing") {
        return Err("Modalità di cambio cartella non valida.".to_string());
    }

    let target = validate_directory_path(PathBuf::from(directory))?;
    let source = active_data_directory()?;
    if same_directory(&source, &target) {
        return storage_location_for_directory(&target);
    }

    let source_inspection = inspect_directory(&source)?;
    let target_inspection = inspect_directory(&target)?;
    if mode == "copy" && target_inspection.has_any_broject_file() {
        return Err("La cartella scelta contiene già file di Broject. Scegli una cartella vuota oppure usa i dati esistenti.".to_string());
    }

    ensure_writable_directory(&target)?;
    if mode == "copy" && source_inspection.contains_workspace {
        copy_storage_files(
            &paths_for_directory(source),
            &paths_for_directory(target.clone()),
        )?;
    }
    write_storage_settings(&target)?;
    storage_location_for_directory(&target)
}

pub fn application_directory() -> Result<PathBuf, String> {
    let directory = if cfg!(windows) {
        let root = env::var_os("APPDATA")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .or_else(|| {
                env::var_os("USERPROFILE")
                    .filter(|value| !value.is_empty())
                    .map(|value| PathBuf::from(value).join("AppData").join("Roaming"))
            })
            .ok_or("APPDATA/USERPROFILE non disponibile")?;
        root.join("Broject")
    } else if cfg!(target_os = "macos") {
        PathBuf::from(
            env::var_os("HOME")
                .filter(|value| !value.is_empty())
                .ok_or("HOME non disponibile")?,
        )
        .join("Library")
        .join("Application Support")
        .join("Broject")
    } else {
        let root = env::var_os("XDG_CONFIG_HOME")
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
            .or_else(|| {
                env::var_os("HOME")
                    .filter(|value| !value.is_empty())
                    .map(|home| PathBuf::from(home).join(".config"))
            })
            .ok_or("HOME/XDG_CONFIG_HOME non disponibile")?;
        root.join("Broject")
    };
    Ok(directory)
}

fn paths_for_directory(directory: PathBuf) -> StoragePaths {
    let data = directory.join("broject-data.json");
    StoragePaths {
        backup: PathBuf::from(format!("{}.bak", data.display())),
        corrupt: PathBuf::from(format!("{}.corrupt", data.display())),
        log: directory.join("broject-error.log"),
        data,
    }
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(application_directory()?.join("broject-settings.json"))
}

fn active_data_directory() -> Result<PathBuf, String> {
    let default = application_directory()?;
    let path = settings_path()?;
    match read_storage_settings_at(&path)? {
        Some(directory) => Ok(directory),
        None => Ok(default),
    }
}

fn write_storage_settings(directory: &Path) -> Result<(), String> {
    write_storage_settings_at(&settings_path()?, directory)
}

fn read_storage_settings_at(path: &Path) -> Result<Option<PathBuf>, String> {
    match fs::read_to_string(path) {
        Ok(contents) => {
            let value: Value = serde_json::from_str(&contents)
                .map_err(|error| format!("Configurazione cartella dati non valida: {error}"))?;
            let directory = value
                .get("dataDirectory")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or("Configurazione cartella dati non valida: directory mancante")?;
            validate_directory_path(PathBuf::from(directory)).map(Some)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Impossibile leggere la configurazione della cartella dati: {error}"
        )),
    }
}

fn write_storage_settings_at(path: &Path, directory: &Path) -> Result<(), String> {
    let application_directory = path
        .parent()
        .ok_or("Directory configurazione non disponibile")?;
    fs::create_dir_all(application_directory)
        .map_err(|error| format!("Impossibile creare la configurazione di Broject: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(
            &application_directory,
            std::fs::Permissions::from_mode(0o700),
        )
        .map_err(|error| format!("Impossibile proteggere la configurazione di Broject: {error}"))?;
    }

    let temporary = application_directory.join(format!("broject-settings.{}.tmp", unique_suffix()));
    let contents = serde_json::to_string_pretty(&json!({
        "dataDirectory": directory.to_string_lossy()
    }))
    .map_err(|error| format!("Impossibile serializzare la configurazione dati: {error}"))?;
    fs::write(&temporary, contents)
        .map_err(|error| format!("Impossibile scrivere la configurazione dati: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Impossibile proteggere la configurazione dati: {error}"))?;
    }
    let result = replace_file_atomically(&temporary, path);
    let _ = fs::remove_file(&temporary);
    result
}

fn validate_directory_path(directory: PathBuf) -> Result<PathBuf, String> {
    if !directory.is_absolute() {
        return Err("La cartella dati deve essere un percorso assoluto.".to_string());
    }
    match fs::metadata(&directory) {
        Ok(metadata) if metadata.is_dir() => Ok(directory),
        Ok(_) => Err(format!(
            "La destinazione esiste ma non è una cartella: {}",
            directory.display()
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(directory),
        Err(error) => Err(format!(
            "Impossibile controllare la cartella dati {}: {error}",
            directory.display()
        )),
    }
}

fn same_directory(left: &Path, right: &Path) -> bool {
    #[cfg(windows)]
    {
        return left
            .to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy());
    }
    #[cfg(not(windows))]
    {
        left == right
    }
}

fn inspect_directory(directory: &Path) -> Result<StorageInspection, String> {
    let directory = validate_directory_path(directory.to_path_buf())?;
    let paths = paths_for_directory(directory.clone());
    let has_primary = path_exists(&paths.data)?;
    let has_backup = path_exists(&paths.backup)?;
    let has_corrupt = path_exists(&paths.corrupt)?;
    let has_log = path_exists(&paths.log)?;
    Ok(StorageInspection {
        directory: directory.to_string_lossy().into_owned(),
        is_default: same_directory(&directory, &application_directory()?),
        contains_workspace: has_primary || has_backup || has_corrupt,
        has_primary,
        has_backup,
        has_corrupt,
        has_log,
    })
}

fn storage_location_for_directory(directory: &Path) -> Result<StorageLocation, String> {
    let inspection = inspect_directory(directory)?;
    Ok(StorageLocation {
        directory: inspection.directory,
        is_default: inspection.is_default,
        contains_workspace: inspection.contains_workspace,
    })
}

impl StorageInspection {
    fn has_any_broject_file(&self) -> bool {
        self.has_primary || self.has_backup || self.has_corrupt || self.has_log
    }
}

fn ensure_writable_directory(directory: &Path) -> Result<(), String> {
    fs::create_dir_all(directory)
        .map_err(|error| format!("Impossibile creare la cartella dati: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(directory, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Impossibile proteggere la cartella dati: {error}"))?;
    }
    let probe = directory.join(format!(".broject-write-test-{}.tmp", unique_suffix()));
    fs::write(&probe, b"")
        .map_err(|error| format!("La cartella dati non è scrivibile: {error}"))?;
    let _ = fs::remove_file(probe);
    Ok(())
}

fn copy_storage_files(source: &StoragePaths, target: &StoragePaths) -> Result<(), String> {
    let files = [
        (&source.data, &target.data),
        (&source.backup, &target.backup),
        (&source.corrupt, &target.corrupt),
        (&source.log, &target.log),
    ];
    let mut published = Vec::new();
    for (source_path, target_path) in files {
        if !path_exists(source_path)? {
            continue;
        }
        let temporary = target_path.with_file_name(format!(
            ".{}.migration-{}.tmp",
            target_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("broject-data"),
            unique_suffix()
        ));
        let copy_result = fs::copy(source_path, &temporary).map_err(|error| {
            format!(
                "Impossibile copiare {} nella nuova cartella: {error}",
                source_path.display()
            )
        });
        if let Err(error) = copy_result {
            let _ = fs::remove_file(&temporary);
            cleanup_published_files(&published);
            return Err(error);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Err(error) =
                fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            {
                let _ = fs::remove_file(&temporary);
                cleanup_published_files(&published);
                return Err(format!("Impossibile proteggere la copia dati: {error}"));
            }
        }
        if target_path == &target.data && read_json(&temporary).is_err() {
            let _ = fs::remove_file(&temporary);
            cleanup_published_files(&published);
            return Err("Il file dati esistente non è un JSON di workspace valido.".to_string());
        }
        if let Err(error) = replace_file_atomically(&temporary, target_path) {
            let _ = fs::remove_file(&temporary);
            cleanup_published_files(&published);
            return Err(error);
        }
        published.push(target_path.to_path_buf());
    }
    Ok(())
}

fn cleanup_published_files(files: &[PathBuf]) {
    for path in files {
        let _ = fs::remove_file(path);
    }
}

fn selected_path(output: &Output) -> Option<PathBuf> {
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!path.is_empty()).then(|| PathBuf::from(path))
}

#[cfg(windows)]
fn choose_data_directory() -> Result<Option<PathBuf>, String> {
    let title = powershell_literal("Scegli la cartella dati di Broject");
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = '{title}'; $dialog.ShowNewFolderButton = $true; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ [Console]::Write($dialog.SelectedPath) }}"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-STA", "-Command"])
        .arg(&script)
        .output()
        .map_err(|error| format!("Il dialogo cartella non è disponibile: {error}"))?;
    if !output.status.success() {
        return Err("Il dialogo cartella non è disponibile.".to_string());
    }
    Ok(selected_path(&output))
}

#[cfg(target_os = "macos")]
fn choose_data_directory() -> Result<Option<PathBuf>, String> {
    let script = "try\nset selectedFolder to choose folder with prompt \"Scegli la cartella dati di Broject\"\nreturn POSIX path of selectedFolder\non error number -128\nreturn \"\"\nend try";
    let output = Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|error| format!("Il dialogo cartella non è disponibile: {error}"))?;
    if !output.status.success() {
        return Err("Il dialogo cartella non è disponibile.".to_string());
    }
    Ok(selected_path(&output))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn choose_data_directory() -> Result<Option<PathBuf>, String> {
    let title = "--title=Scegli la cartella dati di Broject";
    if let Some(output) = command_output("zenity", &["--file-selection", "--directory", title])? {
        if output.status.success() {
            return Ok(selected_path(&output));
        }
        if output.status.code() == Some(1) && output.stderr.is_empty() {
            return Ok(None);
        }
    }

    if let Some(output) = command_output(
        "kdialog",
        &[
            "--getexistingdirectory",
            "",
            "--title",
            "Scegli la cartella dati di Broject",
        ],
    )? {
        if output.status.success() {
            return Ok(selected_path(&output));
        }
        if output.status.code() == Some(1) && output.stderr.is_empty() {
            return Ok(None);
        }
    }

    Err("Nessun dialogo cartella disponibile (installa Zenity o KDE Dialog).".to_string())
}

#[cfg(not(any(windows, unix)))]
fn choose_data_directory() -> Result<Option<PathBuf>, String> {
    Err("Il dialogo cartella non è supportato su questo sistema.".to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn command_output(program: &str, args: &[&str]) -> Result<Option<Output>, String> {
    match Command::new(program).args(args).output() {
        Ok(output) => Ok(Some(output)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Il dialogo cartella non è disponibile ({program}): {error}"
        )),
    }
}

#[cfg(windows)]
fn powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

fn load_from_paths(paths: &StoragePaths) -> Result<LoadResponse, String> {
    let primary_exists = path_exists(&paths.data)?;
    if primary_exists {
        match read_json(&paths.data) {
            Ok(state) => {
                return Ok(LoadResponse {
                    state: normalize_workspace(state),
                    recovery_message: None,
                })
            }
            Err(ReadError::Json) => {
                fs::copy(&paths.data, &paths.corrupt).map_err(|error| {
                    format!("Impossibile conservare il file dati corrotto: {error}")
                })?;
            }
            Err(ReadError::Io(error)) => {
                return Err(format!("Impossibile leggere i dati di Broject: {error}"))
            }
        }
    }

    let backup_exists = path_exists(&paths.backup)?;
    if backup_exists {
        match read_json(&paths.backup) {
            Ok(state) => {
                let state = normalize_workspace(state);
                save_to_paths(paths, &state, false)?;
                return Ok(LoadResponse {
                    state,
                    recovery_message: Some("Dati recuperati dalla copia di sicurezza. Le ultime modifiche potrebbero non essere presenti.".to_string()),
                });
            }
            Err(ReadError::Json) => {}
            Err(ReadError::Io(error)) => {
                return Err(format!(
                    "Impossibile leggere la copia di sicurezza di Broject: {error}"
                ))
            }
        }
    }

    if !primary_exists && !backup_exists && !path_exists(&paths.corrupt)? {
        return Ok(LoadResponse {
            state: empty_state(),
            recovery_message: None,
        });
    }

    Err(format!(
        "Impossibile leggere i dati di Broject o la copia di sicurezza. I file sono stati conservati in {}. Ripristina una copia valida prima di riaprire l’app.",
        paths.data.parent().unwrap_or(Path::new(".")).display()
    ))
}

#[derive(Debug)]
enum ReadError {
    Io(String),
    Json,
}

fn read_json(path: &Path) -> Result<Value, ReadError> {
    let contents = fs::read_to_string(path).map_err(|error| ReadError::Io(error.to_string()))?;
    let value: Value = serde_json::from_str(&contents).map_err(|_| ReadError::Json)?;
    if !value.is_object() {
        return Err(ReadError::Json);
    }
    Ok(value)
}

fn normalize_workspace(state: Value) -> Value {
    let object = state.as_object().cloned().unwrap_or_default();
    let schema_version = field(&object, "schemaVersion", "SchemaVersion")
        .and_then(Value::as_i64)
        .unwrap_or(3)
        .max(3);

    let raw_projects = field(&object, "projects", "Projects")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let raw_people = field(&object, "people", "People")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let raw_tasks = field(&object, "tasks", "Tasks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let accents = [
        "#6C5CE7", "#00A8A8", "#E14D72", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981", "#EC4899",
    ];
    let mut project_ids = HashSet::new();
    let mut repaired_project_ids = HashMap::new();
    let projects: Vec<Value> = raw_projects
        .iter()
        .enumerate()
        .map(|(index, raw)| {
            let item = raw.as_object().cloned().unwrap_or_default();
            let id = repair_id(
                &item,
                "id",
                "Id",
                &mut project_ids,
                &mut repaired_project_ids,
            );
            let accent = string_field(&item, "accentColor", "AccentColor");
            json!({
                "Id": id,
                "Name": string_field(&item, "name", "Name"),
                "Description": optional_field(&item, "description", "Description"),
                "AccentColor": if accent.trim().is_empty() { accents[index % accents.len()].to_string() } else { accent },
                "CreatedAt": optional_field(&item, "createdAt", "CreatedAt"),
                "UpdatedAt": optional_field(&item, "updatedAt", "UpdatedAt")
            })
        })
        .collect();

    let mut person_ids = HashSet::new();
    let mut repaired_person_ids = HashMap::new();
    let people: Vec<Value> = raw_people
        .iter()
        .map(|raw| {
            let item = raw.as_object().cloned().unwrap_or_default();
            let id = repair_id(&item, "id", "Id", &mut person_ids, &mut repaired_person_ids);
            json!({
                "Id": id,
                "FirstName": string_field(&item, "firstName", "FirstName"),
                "LastName": string_field(&item, "lastName", "LastName"),
                "Role": string_field(&item, "role", "Role"),
                "Company": string_field(&item, "company", "Company")
            })
        })
        .collect();

    let mut task_ids = HashSet::new();
    let mut repaired_task_ids = HashMap::new();
    let tasks: Vec<Value> = raw_tasks
        .iter()
        .filter_map(|raw| {
            let item = raw.as_object().cloned().unwrap_or_default();
            let raw_project_id = string_field(&item, "projectId", "ProjectId");
            let project_id = if project_ids.contains(&raw_project_id) {
                raw_project_id
            } else {
                repaired_project_ids.get(&raw_project_id).cloned().unwrap_or(raw_project_id)
            };
            if !project_ids.contains(&project_id) {
                return None;
            }

            let id = repair_id(&item, "id", "Id", &mut task_ids, &mut repaired_task_ids);
            let (status, valid_status) = enum_value(field(&item, "status", "Status"), &["Todo", "Doing", "Done"], 0);
            let (priority, _) = enum_value(field(&item, "priority", "Priority"), &["Low", "Medium", "High", "Urgent"], 1);
            let mut assignees = Vec::new();
            if let Some(values) = field(&item, "assigneePersonIds", "AssigneePersonIds").and_then(Value::as_array) {
                for value in values {
                    if let Some(id) = value.as_str() {
                        assignees.push(id.to_string());
                    }
                }
            }
            if let Some(id) = field(&item, "assigneePersonId", "AssigneePersonId").and_then(Value::as_str) {
                assignees.push(id.to_string());
            }
            let mut seen_assignees = HashSet::new();
            let assignees: Vec<String> = assignees
                .into_iter()
                .filter_map(|id| {
                    let repaired = if person_ids.contains(&id) {
                        id
                    } else {
                        repaired_person_ids.get(&id).cloned().unwrap_or(id)
                    };
                    if person_ids.contains(&repaired) && seen_assignees.insert(repaired.clone()) {
                        Some(repaired)
                    } else {
                        None
                    }
                })
                .collect();

            Some(json!({
                "Id": id,
                "ProjectId": project_id,
                "Title": string_field(&item, "title", "Title"),
                "Notes": optional_field(&item, "notes", "Notes"),
                "Conclusions": optional_field(&item, "conclusions", "Conclusions"),
                "Status": status,
                "Priority": priority,
                "Tags": optional_field(&item, "tags", "Tags"),
                "AssigneePersonIds": assignees,
                "DueDate": optional_field(&item, "dueDate", "DueDate"),
                "CompletedAt": if valid_status { optional_field(&item, "completedAt", "CompletedAt") } else { Value::Null },
                "CreatedAt": optional_field(&item, "createdAt", "CreatedAt"),
                "UpdatedAt": optional_field(&item, "updatedAt", "UpdatedAt")
            }))
        })
        .collect();

    json!({
        "SchemaVersion": schema_version,
        "Projects": projects,
        "People": people,
        "Tasks": tasks
    })
}

fn field<'a>(object: &'a Map<String, Value>, camel: &str, pascal: &str) -> Option<&'a Value> {
    object
        .get(camel)
        .filter(|value| !value.is_null())
        .or_else(|| object.get(pascal))
}

fn string_field(object: &Map<String, Value>, camel: &str, pascal: &str) -> String {
    field(object, camel, pascal)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn optional_field(object: &Map<String, Value>, camel: &str, pascal: &str) -> Value {
    field(object, camel, pascal).cloned().unwrap_or(Value::Null)
}

fn repair_id(
    object: &Map<String, Value>,
    camel: &str,
    pascal: &str,
    seen: &mut HashSet<String>,
    repairs: &mut HashMap<String, String>,
) -> String {
    let original = string_field(object, camel, pascal);
    if !original.is_empty() && seen.insert(original.clone()) {
        return original;
    }

    let replacement = fresh_id(seen);
    repairs
        .entry(original)
        .or_insert_with(|| replacement.clone());
    replacement
}

fn fresh_id(seen: &mut HashSet<String>) -> String {
    loop {
        let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
        let high = (unique_suffix() as u64) ^ counter.rotate_left(17);
        let low = ((std::process::id() as u64) << 32) ^ counter.wrapping_mul(0x9E3779B97F4A7C15);
        let time_low = high as u32;
        let time_mid = (high >> 32) as u16;
        let time_high_and_version = ((high >> 48) as u16 & 0x0FFF) | 0x4000;
        let clock_sequence = ((low >> 48) as u16 & 0x3FFF) | 0x8000;
        let node = low & 0x0000_FFFF_FFFF_FFFF;
        let candidate = format!("{time_low:08x}-{time_mid:04x}-{time_high_and_version:04x}-{clock_sequence:04x}-{node:012x}");
        if seen.insert(candidate.clone()) {
            return candidate;
        }
    }
}

fn enum_value(value: Option<&Value>, names: &[&str], default: u64) -> (Value, bool) {
    if let Some(number) = value.and_then(Value::as_u64) {
        if number < names.len() as u64 {
            return (json!(number), true);
        }
    }
    if let Some(name) = value.and_then(Value::as_str) {
        if let Some(index) = names
            .iter()
            .position(|candidate| candidate.eq_ignore_ascii_case(name))
        {
            return (json!(index), true);
        }
    }
    (json!(default), false)
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "Impossibile controllare {}: {error}",
            path.display()
        )),
    }
}

fn save_to_paths(paths: &StoragePaths, state: &Value, create_backup: bool) -> Result<(), String> {
    let directory = paths
        .data
        .parent()
        .ok_or("Directory dati non disponibile")?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Impossibile creare directory dati: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(directory, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Impossibile proteggere directory dati: {error}"))?;
    }
    let json = serde_json::to_string_pretty(state)
        .map_err(|error| format!("Impossibile serializzare dati: {error}"))?;
    let temp = directory.join(format!("broject-data.{}.tmp", unique_suffix()));
    fs::write(&temp, json)
        .map_err(|error| format!("Impossibile scrivere dati temporanei: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temp, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Impossibile proteggere dati temporanei: {error}"))?;
    }

    let result = (|| {
        if path_exists(&paths.data)? {
            if create_backup {
                fs::copy(&paths.data, &paths.backup)
                    .map_err(|error| format!("Impossibile creare backup: {error}"))?;
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    fs::set_permissions(&paths.backup, std::fs::Permissions::from_mode(0o600))
                        .map_err(|error| format!("Impossibile proteggere backup: {error}"))?;
                }
            }
        }
        replace_file_atomically(&temp, &paths.data)
    })();
    let _ = fs::remove_file(&temp);
    result
}

fn replace_file_atomically(source: &Path, destination: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(from: *const u16, to: *const u16, flags: u32) -> i32;
        }

        const MOVEFILE_REPLACE_EXISTING: u32 = 0x00000001;
        const MOVEFILE_WRITE_THROUGH: u32 = 0x00000008;
        let from: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        let replaced = unsafe {
            MoveFileExW(
                from.as_ptr(),
                to.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if replaced == 0 {
            return Err(format!(
                "Impossibile finalizzare dati: {}",
                std::io::Error::last_os_error()
            ));
        }
        return Ok(());
    }

    #[cfg(not(windows))]
    fs::rename(source, destination)
        .map_err(|error| format!("Impossibile finalizzare dati: {error}"))
}

fn empty_state() -> Value {
    json!({ "SchemaVersion": 3, "Projects": [], "People": [], "Tasks": [] })
}

fn unique_suffix() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

fn timestamp_label() -> String {
    format!("unix:{}", unique_suffix())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_paths(label: &str) -> StoragePaths {
        let directory = env::temp_dir().join(format!("broject-rust-{label}-{}", unique_suffix()));
        paths_for_directory(directory)
    }

    #[test]
    fn save_creates_backup_before_replacement() {
        let paths = test_paths("backup");
        save_to_paths(&paths, &json!({ "value": "one" }), true).unwrap();
        save_to_paths(&paths, &json!({ "value": "two" }), true).unwrap();
        assert_eq!(read_json(&paths.data).unwrap()["value"], "two");
        assert_eq!(read_json(&paths.backup).unwrap()["value"], "one");
        let _ = fs::remove_dir_all(paths.data.parent().unwrap());
    }

    #[test]
    fn corrupt_primary_recovers_backup_and_preserves_corrupt_file() {
        let paths = test_paths("recovery");
        save_to_paths(&paths, &json!({ "SchemaVersion": 3, "Projects": [{ "Id": "safe", "Name": "Safe" }], "People": [], "Tasks": [] }), true).unwrap();
        save_to_paths(&paths, &json!({ "SchemaVersion": 3, "Projects": [{ "Id": "latest", "Name": "Latest" }], "People": [], "Tasks": [] }), true).unwrap();
        fs::write(&paths.data, "{ broken").unwrap();
        let result = load_from_paths(&paths).unwrap();
        assert_eq!(result.state["Projects"][0]["Name"], "Safe");
        assert!(result.recovery_message.is_some());
        assert_eq!(fs::read_to_string(&paths.corrupt).unwrap(), "{ broken");
        let _ = fs::remove_dir_all(paths.data.parent().unwrap());
    }

    #[test]
    fn invalid_primary_without_backup_refuses_empty_workspace() {
        let paths = test_paths("invalid");
        fs::create_dir_all(paths.data.parent().unwrap()).unwrap();
        fs::write(&paths.data, "{ broken").unwrap();
        assert!(load_from_paths(&paths).is_err());
        let _ = fs::remove_dir_all(paths.data.parent().unwrap());
    }

    #[test]
    fn replacement_keeps_only_the_published_primary_file() {
        let paths = test_paths("atomic");
        fs::create_dir_all(paths.data.parent().unwrap()).unwrap();
        fs::write(&paths.data, "before").unwrap();
        let temporary = paths.data.parent().unwrap().join("broject-data-test.tmp");
        fs::write(&temporary, "after").unwrap();

        replace_file_atomically(&temporary, &paths.data).unwrap();

        assert_eq!(fs::read_to_string(&paths.data).unwrap(), "after");
        assert!(!temporary.exists());
        let _ = fs::remove_dir_all(paths.data.parent().unwrap());
    }

    #[test]
    fn normalize_repairs_duplicate_ids_and_legacy_assignee_references() {
        let state = normalize_workspace(json!({
            "SchemaVersion": 1,
            "Projects": [
                { "Id": "project", "Name": "First" },
                { "Id": "project", "Name": "Second" },
                { "Id": "", "Name": "Empty" }
            ],
            "People": [{ "Id": "person", "FirstName": "Ada" }],
            "Tasks": [{ "Id": "", "ProjectId": "", "Title": "Repair", "AssigneePersonId": "person" }]
        }));

        assert_eq!(state["SchemaVersion"], 3);
        assert_eq!(state["Projects"].as_array().unwrap().len(), 3);
        assert_eq!(state["Tasks"].as_array().unwrap().len(), 1);
        let task = &state["Tasks"][0];
        assert!(state["Projects"]
            .as_array()
            .unwrap()
            .iter()
            .any(|project| project["Id"] == task["ProjectId"]));
        assert_eq!(task["AssigneePersonIds"].as_array().unwrap().len(), 1);
        assert_eq!(task["AssigneePersonIds"][0], json!("person"));
        assert_eq!(state["Projects"][1]["Id"].as_str().unwrap().len(), 36);
        assert_eq!(
            state["Projects"][1]["Id"]
                .as_str()
                .unwrap()
                .matches('-')
                .count(),
            4
        );
        assert!(task.get("AssigneePersonId").is_none());
    }

    #[test]
    fn storage_settings_round_trip_and_reject_invalid_directory() {
        let root = env::temp_dir().join(format!("broject-rust-settings-{}", unique_suffix()));
        let settings = root.join("config").join("broject-settings.json");
        let selected = root.join("selected");

        assert_eq!(read_storage_settings_at(&settings).unwrap(), None);
        write_storage_settings_at(&settings, &selected).unwrap();
        assert_eq!(
            read_storage_settings_at(&settings).unwrap(),
            Some(selected.clone())
        );

        fs::write(&settings, r#"{"dataDirectory":"relative"}"#).unwrap();
        assert!(read_storage_settings_at(&settings).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn inspect_directory_reports_workspace_files_without_creating_it() {
        let paths = test_paths("inspect");
        let directory = paths.data.parent().unwrap();
        let inspection = inspect_directory(directory).unwrap();

        assert!(!inspection.contains_workspace);
        assert!(!directory.exists());

        fs::create_dir_all(directory).unwrap();
        fs::write(
            &paths.data,
            r#"{"SchemaVersion":3,"Projects":[],"People":[],"Tasks":[]}"#,
        )
        .unwrap();
        fs::write(&paths.backup, "backup").unwrap();
        fs::write(&paths.log, "log").unwrap();
        let inspection = inspect_directory(directory).unwrap();
        assert!(inspection.contains_workspace);
        assert!(inspection.has_primary);
        assert!(inspection.has_backup);
        assert!(!inspection.has_corrupt);
        assert!(inspection.has_log);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn copy_storage_files_preserves_recovery_files_and_validates_primary() {
        let source = test_paths("copy-source");
        let target = test_paths("copy-target");
        fs::create_dir_all(source.data.parent().unwrap()).unwrap();
        fs::write(
            &source.data,
            r#"{"SchemaVersion":3,"Projects":[],"People":[],"Tasks":[]}"#,
        )
        .unwrap();
        fs::write(&source.backup, "backup").unwrap();
        fs::write(&source.corrupt, "corrupt").unwrap();
        fs::write(&source.log, "log").unwrap();
        fs::create_dir_all(target.data.parent().unwrap()).unwrap();

        copy_storage_files(&source, &target).unwrap();

        assert_eq!(
            fs::read_to_string(&target.data).unwrap(),
            fs::read_to_string(&source.data).unwrap()
        );
        assert_eq!(fs::read_to_string(&target.backup).unwrap(), "backup");
        assert_eq!(fs::read_to_string(&target.corrupt).unwrap(), "corrupt");
        assert_eq!(fs::read_to_string(&target.log).unwrap(), "log");
        let _ = fs::remove_dir_all(source.data.parent().unwrap());
        let _ = fs::remove_dir_all(target.data.parent().unwrap());
    }

    #[test]
    fn copy_storage_files_removes_partial_output_after_invalid_primary() {
        let source = test_paths("copy-invalid-source");
        let target = test_paths("copy-invalid-target");
        fs::create_dir_all(source.data.parent().unwrap()).unwrap();
        fs::write(&source.data, "broken").unwrap();
        fs::write(&source.backup, "backup").unwrap();
        fs::create_dir_all(target.data.parent().unwrap()).unwrap();

        assert!(copy_storage_files(&source, &target).is_err());
        assert!(!target.data.exists());
        assert!(!target.backup.exists());
        let _ = fs::remove_dir_all(source.data.parent().unwrap());
        let _ = fs::remove_dir_all(target.data.parent().unwrap());
    }
}
