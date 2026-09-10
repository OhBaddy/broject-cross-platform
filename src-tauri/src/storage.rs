use serde::Serialize;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResponse {
    pub state: Value,
    pub recovery_message: Option<String>,
}

#[derive(Debug, Clone)]
struct StoragePaths {
    data: PathBuf,
    backup: PathBuf,
    corrupt: PathBuf,
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
    let Ok(directory) =
        default_paths().map(|paths| paths.data.parent().unwrap_or(Path::new(".")).to_path_buf())
    else {
        return;
    };
    if fs::create_dir_all(&directory).is_err() {
        return;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).is_err() {
            return;
        }
    }
    let path = directory.join("broject-error.log");
    let message = format!("[{}] {}\n\n", timestamp_label(), error);
    let _ = fs::OpenOptions::new()
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
}

fn default_paths() -> Result<StoragePaths, String> {
    Ok(paths_for_directory(application_directory()?))
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
        data,
    }
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
}
