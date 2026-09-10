use std::fmt;

#[cfg(unix)]
extern "C" {
    fn flock(file_descriptor: i32, operation: i32) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn CreateMutexW(
        attributes: *mut std::ffi::c_void,
        initially_owned: i32,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
}

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(
        window: *mut std::ffi::c_void,
        text: *const u16,
        caption: *const u16,
        kind: u32,
    ) -> i32;
}

#[derive(Debug)]
pub enum AcquireError {
    AlreadyRunning,
    Failed(String),
}

impl fmt::Display for AcquireError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AlreadyRunning => formatter.write_str("Broject è già aperto."),
            Self::Failed(error) => formatter.write_str(error),
        }
    }
}

pub struct SingleInstance {
    #[cfg(unix)]
    _lock_file: std::fs::File,
    #[cfg(windows)]
    mutex: *mut std::ffi::c_void,
}

pub fn acquire() -> Result<SingleInstance, AcquireError> {
    #[cfg(unix)]
    {
        use std::fs::OpenOptions;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        use std::os::unix::io::AsRawFd;

        let directory = crate::storage::application_directory().map_err(AcquireError::Failed)?;
        std::fs::create_dir_all(&directory).map_err(|error| {
            AcquireError::Failed(format!("Impossibile creare la directory dell'app: {error}"))
        })?;
        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o700)).map_err(
            |error| {
                AcquireError::Failed(format!(
                    "Impossibile proteggere la directory dell'app: {error}"
                ))
            },
        )?;
        let lock_file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .mode(0o600)
            .open(directory.join("broject-instance.lock"))
            .map_err(|error| {
                AcquireError::Failed(format!("Impossibile creare il lock di Broject: {error}"))
            })?;
        std::fs::set_permissions(
            directory.join("broject-instance.lock"),
            std::fs::Permissions::from_mode(0o600),
        )
        .map_err(|error| {
            AcquireError::Failed(format!(
                "Impossibile proteggere il lock di Broject: {error}"
            ))
        })?;

        const LOCK_EX: i32 = 2;
        const LOCK_NB: i32 = 4;
        let result = unsafe { flock(lock_file.as_raw_fd(), LOCK_EX | LOCK_NB) };
        if result != 0 {
            let error = std::io::Error::last_os_error();
            if error.kind() == std::io::ErrorKind::WouldBlock {
                return Err(AcquireError::AlreadyRunning);
            }
            return Err(AcquireError::Failed(format!(
                "Impossibile acquisire il lock di Broject: {error}"
            )));
        }
        return Ok(SingleInstance {
            _lock_file: lock_file,
        });
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::ptr::null_mut;

        const ERROR_ALREADY_EXISTS: u32 = 183;
        let name: Vec<u16> = std::ffi::OsStr::new("Local\\Broject.App.SingleInstance")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mutex = unsafe { CreateMutexW(null_mut(), 1, name.as_ptr()) };
        if mutex.is_null() {
            return Err(AcquireError::Failed(format!(
                "Impossibile creare il lock di Broject: codice {}",
                unsafe { GetLastError() }
            )));
        }
        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            unsafe {
                CloseHandle(mutex);
            }
            return Err(AcquireError::AlreadyRunning);
        }
        return Ok(SingleInstance { mutex });
    }

    #[cfg(not(any(unix, windows)))]
    {
        Ok(SingleInstance {})
    }
}

#[cfg(windows)]
impl Drop for SingleInstance {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.mutex);
        }
    }
}

pub fn show_message(title: &str, message: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let text: Vec<u16> = std::ffi::OsStr::new(message)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let caption: Vec<u16> = std::ffi::OsStr::new(title)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x40);
        }
        return;
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display dialog \"{}\" with title \"{}\" buttons {{\"OK\"}} default button \"OK\"",
            applescript_literal(message),
            applescript_literal(title)
        );
        if let Ok(status) = std::process::Command::new("osascript")
            .args(["-e"])
            .arg(&script)
            .status()
        {
            if status.success() {
                return;
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let title_arg = format!("--title={title}");
        let text_arg = format!("--text={message}");
        if let Ok(status) = std::process::Command::new("zenity")
            .args(["--info"])
            .arg(title_arg)
            .arg(text_arg)
            .status()
        {
            if status.success() {
                return;
            }
        }
        if let Ok(status) = std::process::Command::new("kdialog")
            .args(["--title", title, "--msgbox", message])
            .status()
        {
            if status.success() {
                return;
            }
        }
    }

    #[cfg(not(windows))]
    eprintln!("{title}: {message}");
}

#[cfg(target_os = "macos")]
fn applescript_literal(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}
