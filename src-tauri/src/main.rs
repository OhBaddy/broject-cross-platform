#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(debug_assertions), not(feature = "custom-protocol"), not(test)))]
compile_error!(
    "Release builds must enable the `custom-protocol` feature; use `tauri build` or `cargo build --features custom-protocol`."
);

mod instance;
mod reports;
mod storage;

#[tauri::command]
fn load_workspace() -> Result<storage::LoadResponse, String> {
    let result = storage::load_workspace();
    if let Err(error) = &result {
        storage::write_error_log(error);
    }
    result
}

#[tauri::command]
fn save_workspace(state_json: String) -> Result<(), String> {
    let result = storage::save_workspace(&state_json);
    if let Err(error) = &result {
        storage::write_error_log(error);
    }
    result
}

#[tauri::command]
fn save_report(
    default_file_name: String,
    dialog_title: String,
    bytes: Vec<u8>,
) -> Result<reports::SaveReportResponse, String> {
    let result = reports::save_report(&default_file_name, &dialog_title, bytes);
    if let Err(error) = &result {
        storage::write_error_log(error);
    }
    result
}

#[tauri::command]
fn open_report(path: String) -> Result<reports::OpenReportResponse, String> {
    let result = reports::open_report(&path);
    if let Err(error) = &result {
        storage::write_error_log(error);
    }
    result
}

#[tauri::command]
fn log_error(error: String) {
    storage::write_error_log(&error);
}

fn main() {
    let _instance = match instance::acquire() {
        Ok(instance) => instance,
        Err(instance::AcquireError::AlreadyRunning) => {
            instance::show_message("Broject", "Broject è già aperto.");
            return;
        }
        Err(error) => {
            storage::write_error_log(&error.to_string());
            instance::show_message(
                "Avvio non riuscito",
                &format!(
                    "Broject non è riuscito ad avviarsi. I dati locali non sono stati modificati.\n\n{}\n\nIl dettaglio tecnico è stato salvato nel file broject-error.log.",
                    error
                ),
            );
            return;
        }
    };

    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            save_report,
            open_report,
            log_error
        ])
        .run(tauri::generate_context!());
    if let Err(error) = result {
        storage::write_error_log(&format!("Errore runtime Tauri: {error}"));
        instance::show_message(
            "Broject",
            "Si è verificato un errore inatteso. Le modifiche già confermate restano salvate.\n\nPuoi continuare a lavorare; se il problema si ripete, consulta broject-error.log.",
        );
    }
}
