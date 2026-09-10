use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReportResponse {
    pub saved: bool,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenReportResponse {
    pub opened: bool,
}

pub fn save_report(
    default_file_name: &str,
    dialog_title: &str,
    bytes: Vec<u8>,
) -> Result<SaveReportResponse, String> {
    if bytes.is_empty() {
        return Err("Il report è vuoto e non può essere salvato.".to_string());
    }
    if !is_xlsx_package(&bytes) {
        return Err("Il report non è un workbook XLSX valido.".to_string());
    }

    let default_file_name = safe_default_file_name(default_file_name);
    let Some(selected_path) = choose_save_path(&default_file_name, dialog_title)? else {
        return Ok(SaveReportResponse {
            saved: false,
            path: None,
        });
    };
    let selected_path = with_xlsx_extension(selected_path);
    atomic_write(&selected_path, &bytes).map_err(|error| {
        format!(
            "Impossibile salvare il report in {}: {error}",
            selected_path.display()
        )
    })?;

    Ok(SaveReportResponse {
        saved: true,
        path: Some(selected_path.to_string_lossy().into_owned()),
    })
}

fn is_xlsx_package(bytes: &[u8]) -> bool {
    if !bytes.starts_with(b"PK\x03\x04") {
        return false;
    }

    let required_entries = [
        b"[Content_Types].xml".as_slice(),
        b"xl/workbook.xml".as_slice(),
    ];
    required_entries
        .iter()
        .all(|entry| bytes.windows(entry.len()).any(|window| window == *entry))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let directory = path
        .parent()
        .ok_or("Directory di destinazione non disponibile")?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Impossibile creare la directory di destinazione: {error}"))?;
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("broject.xlsx");
    let temporary = directory.join(format!(".{file_name}.{suffix}.tmp"));
    let backup = directory.join(format!(".{file_name}.{suffix}.bak"));
    let had_existing = match fs::metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() {
                return Err("La destinazione esiste ma non è un file.".to_string());
            }
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Impossibile controllare la destinazione: {error}")),
    };

    let result = (|| {
        fs::write(&temporary, bytes).map_err(|error| format!("scrittura temporanea: {error}"))?;
        if had_existing {
            fs::copy(path, &backup)
                .map_err(|error| format!("backup del report precedente: {error}"))?;
        }

        publish_temporary(&temporary, path)?;
        Ok::<(), String>(())
    })();

    let mut result = result;
    if result.is_err() && had_existing {
        let original_error = match result {
            Err(error) => error,
            Ok(()) => unreachable!(),
        };
        result = match fs::copy(&backup, path) {
            Ok(_) => Err(original_error),
            Err(error) => Err(format!(
                "{original_error}; ripristino del report precedente non riuscito: {error}"
            )),
        };
    }
    let _ = fs::remove_file(&temporary);
    let _ = fs::remove_file(&backup);
    result
}

#[cfg(not(windows))]
fn publish_temporary(temporary: &Path, path: &Path) -> Result<(), String> {
    fs::rename(temporary, path).map_err(|error| format!("pubblicazione del report: {error}"))
}

#[cfg(windows)]
fn publish_temporary(temporary: &Path, path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    let source: Vec<u16> = temporary
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let destination: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err(format!(
            "pubblicazione del report: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(windows)]
const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;

#[cfg(windows)]
const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(existing_file_name: *const u16, new_file_name: *const u16, flags: u32) -> i32;
}

pub fn open_report(path: &str) -> Result<OpenReportResponse, String> {
    let path = Path::new(path);
    if !path.is_file() {
        return Err(format!("Il report non esiste più: {}", path.display()));
    }

    let path_string = path.to_string_lossy().into_owned();
    let status = open_report_path(&path_string)
        .map_err(|error| format!("Impossibile aprire il report: {error}"))?;

    if !status.success() {
        return Err(format!(
            "Il sistema non ha aperto il report: {}",
            path.display()
        ));
    }
    Ok(OpenReportResponse { opened: true })
}

#[cfg(windows)]
fn open_report_path(path: &str) -> std::io::Result<std::process::ExitStatus> {
    Command::new("explorer.exe").arg(path).status()
}

#[cfg(target_os = "macos")]
fn open_report_path(path: &str) -> std::io::Result<std::process::ExitStatus> {
    Command::new("open").arg(path).status()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_report_path(path: &str) -> std::io::Result<std::process::ExitStatus> {
    let candidates = [
        ("xdg-open", vec![path]),
        ("gio", vec!["open", path]),
        ("kde-open5", vec![path]),
        ("kde-open", vec![path]),
    ];
    let mut last_status = None;
    for (program, args) in candidates {
        match Command::new(program).args(args).status() {
            Ok(status) if status.success() => return Ok(status),
            Ok(status) => last_status = Some(status),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
    }
    if let Some(status) = last_status {
        return Ok(status);
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "Nessun programma disponibile per aprire il report",
    ))
}

fn safe_default_file_name(value: &str) -> String {
    let candidate = Path::new(value)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("Broject.xlsx")
        .trim();
    let mut result = candidate.to_string();
    if !result.to_ascii_lowercase().ends_with(".xlsx") {
        result.push_str(".xlsx");
    }
    result
}

fn with_xlsx_extension(mut path: PathBuf) -> PathBuf {
    let has_xlsx = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("xlsx"))
        .unwrap_or(false);
    if !has_xlsx {
        path.set_extension("xlsx");
    }
    path
}

fn selected_path(output: &Output) -> Option<PathBuf> {
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!path.is_empty()).then(|| PathBuf::from(path))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn dialog_should_try_fallback(success: bool, code: Option<i32>, stderr_empty: bool) -> bool {
    !success && !(code == Some(1) && stderr_empty)
}

#[cfg(windows)]
fn choose_save_path(
    default_file_name: &str,
    dialog_title: &str,
) -> Result<Option<PathBuf>, String> {
    let dialog_title = powershell_literal(dialog_title);
    let default_file_name = powershell_literal(default_file_name);
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.SaveFileDialog; $dialog.Title = '{dialog_title}'; $dialog.Filter = 'Excel workbook (*.xlsx)|*.xlsx'; $dialog.FileName = '{default_file_name}'; $dialog.DefaultExt = 'xlsx'; $dialog.AddExtension = $true; $dialog.OverwritePrompt = $true; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{ [Console]::Write($dialog.FileName) }}"
    );
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-STA", "-Command"])
        .arg(&script)
        .output()
        .map_err(|error| format!("Il dialogo di salvataggio non è disponibile: {error}"))?;
    if !output.status.success() {
        return Err("Il dialogo di salvataggio non è disponibile.".to_string());
    }
    Ok(selected_path(&output))
}

#[cfg(target_os = "macos")]
fn choose_save_path(
    default_file_name: &str,
    dialog_title: &str,
) -> Result<Option<PathBuf>, String> {
    let dialog_title = applescript_literal(dialog_title);
    let default_file_name = applescript_literal(default_file_name);
    let script = format!(
        "try\nset selectedFile to choose file name with prompt \"{dialog_title}\" default name \"{default_file_name}\"\nreturn POSIX path of selectedFile\non error number -128\nreturn \"\"\nend try"
    );
    let output = Command::new("osascript")
        .args(["-e"])
        .arg(&script)
        .output()
        .map_err(|error| format!("Il dialogo di salvataggio non è disponibile: {error}"))?;
    if !output.status.success() {
        return Err("Il dialogo di salvataggio non è disponibile.".to_string());
    }
    Ok(selected_path(&output))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn choose_save_path(
    default_file_name: &str,
    dialog_title: &str,
) -> Result<Option<PathBuf>, String> {
    let zenity_file_name = format!("--filename={default_file_name}");
    let zenity_title = format!("--title={dialog_title}");
    let zenity = command_output(
        "zenity",
        &[
            "--file-selection",
            "--save",
            "--confirm-overwrite",
            zenity_title.as_str(),
            zenity_file_name.as_str(),
        ],
    )?;
    if let Some(output) = zenity {
        if output.status.success() {
            return Ok(selected_path(&output));
        }
        if !dialog_should_try_fallback(
            output.status.success(),
            output.status.code(),
            output.stderr.is_empty(),
        ) {
            return Ok(None);
        }
    }

    let kdialog = command_output(
        "kdialog",
        &[
            "--getsavefilename",
            default_file_name,
            "*.xlsx",
            "--title",
            dialog_title,
        ],
    )?;
    if let Some(output) = kdialog {
        if output.status.success() {
            return Ok(selected_path(&output));
        }
        if !dialog_should_try_fallback(
            output.status.success(),
            output.status.code(),
            output.stderr.is_empty(),
        ) {
            return Ok(None);
        }
    }

    Err("Nessun dialogo di salvataggio disponibile (installa Zenity o KDE Dialog).".to_string())
}

#[cfg(not(any(windows, unix)))]
fn choose_save_path(
    _default_file_name: &str,
    _dialog_title: &str,
) -> Result<Option<PathBuf>, String> {
    Err("Il dialogo di salvataggio non è supportato su questo sistema.".to_string())
}

#[cfg(unix)]
fn command_output(program: &str, args: &[&str]) -> Result<Option<Output>, String> {
    match Command::new(program).args(args).output() {
        Ok(output) => Ok(Some(output)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Il dialogo di salvataggio non è disponibile ({program}): {error}"
        )),
    }
}

#[cfg(windows)]
fn powershell_literal(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "macos")]
fn applescript_literal(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

#[cfg(test)]
mod tests {
    use super::{atomic_write, dialog_should_try_fallback, is_xlsx_package};
    use std::fs;

    #[test]
    fn atomic_write_replaces_existing_file_without_leaving_sidecars() {
        let directory = std::env::temp_dir().join(format!("broject-report-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("report.xlsx");
        fs::write(&path, b"original").unwrap();

        atomic_write(&path, b"replacement").unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"replacement");
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn failed_dialog_with_error_retries_the_next_backend() {
        assert!(dialog_should_try_fallback(false, Some(1), false));
    }

    #[test]
    fn cancelled_dialog_does_not_open_a_second_backend() {
        assert!(!dialog_should_try_fallback(false, Some(1), true));
    }

    #[test]
    fn xlsx_validation_rejects_non_workbook_bytes() {
        assert!(!is_xlsx_package(b"not an xlsx"));
        assert!(!is_xlsx_package(b"PK\x03\x04not a workbook"));
    }

    #[test]
    fn xlsx_validation_accepts_required_package_entries() {
        let bytes = b"PK\x03\x04[Content_Types].xml...xl/workbook.xml";
        assert!(is_xlsx_package(bytes));
    }
}
