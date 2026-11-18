use std::{
    fs,
    io::{ErrorKind, Write},
    path::Path,
    sync::Mutex,
};

use crate::paths::{get_config_backup_path, get_config_path};

const DEFAULT_CONFIG: &str = "{}";
static CONFIG_WRITE: Mutex<()> = Mutex::new(());

fn write_config(config: &str, path: &Path) -> Result<(), String> {
    // Validate before touching the existing file. A failed save must not turn
    // the last known project profiles into an empty or partially written file.
    let value: serde_json::Value = serde_json::from_str(config)
        .map_err(|error| format!("invalid Connectome configuration: {error}"))?;
    let mut pretty_config = serde_json::to_string_pretty(&value)
        .map_err(|error| format!("cannot encode Connectome configuration: {error}"))?;

    pretty_config.push('\n');
    let parent = path.parent().ok_or("configuration path has no parent")?;
    let _guard = CONFIG_WRITE
        .lock()
        .map_err(|_| "configuration writer is unavailable")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("cannot create configuration directory: {error}"))?;
    let mut staged = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("cannot stage Connectome configuration: {error}"))?;
    staged
        .write_all(pretty_config.as_bytes())
        .map_err(|error| format!("cannot write Connectome configuration: {error}"))?;
    staged
        .as_file()
        .sync_all()
        .map_err(|error| format!("cannot sync Connectome configuration: {error}"))?;
    staged
        .persist(path)
        .map_err(|error| format!("cannot publish Connectome configuration: {}", error.error))?;
    Ok(())
}

#[tauri::command]
pub fn load_config() -> Result<String, String> {
    let config_path = get_config_path();
    match fs::read_to_string(&config_path) {
        Ok(config) => Ok(config),
        // Loading an empty first-run configuration must not race a concurrent
        // save and replace a newly persisted project profile with `{}`.
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(DEFAULT_CONFIG.to_string()),
        Err(error) => Err(format!("cannot read Connectome configuration: {error}")),
    }
}

#[tauri::command]
pub fn save_config(config: &str) -> Result<(), String> {
    write_config(config, &get_config_path())
}

#[tauri::command]
pub fn backup_config(config: &str, version: u32) -> Result<(), String> {
    write_config(config, &get_config_backup_path(version))
}

#[tauri::command]
pub fn has_config_backup(version: u32) -> bool {
    get_config_backup_path(version).exists()
}

#[tauri::command]
pub fn restore_config_backup(version: u32) -> Result<(), String> {
    let backup_path = get_config_backup_path(version);
    let config_path = get_config_path();

    if !backup_path.exists() {
        return Err("Backup does not exist".into());
    }

    let backup = fs::read_to_string(backup_path)
        .map_err(|error| format!("cannot read configuration backup: {error}"))?;
    write_config(&backup, &config_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_json_does_not_truncate_the_last_saved_project() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("config.json");
        write_config(r#"{"projects":["first"]}"#, &path).unwrap();
        let original = fs::read(&path).unwrap();
        assert!(write_config("{", &path).is_err());
        assert_eq!(fs::read(path).unwrap(), original);
    }

    #[test]
    fn replacing_a_config_retains_the_new_profile_on_reopen() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("config.json");
        write_config(r#"{"projects":["first"]}"#, &path).unwrap();
        write_config(r#"{"projects":["first","second"]}"#, &path).unwrap();
        let reopened: serde_json::Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(reopened["projects"], serde_json::json!(["first", "second"]));
    }

    #[test]
    fn failed_publication_reports_error_and_preserves_existing_target() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("existing-directory");
        fs::create_dir(&path).unwrap();
        fs::write(path.join("keep"), b"user data").unwrap();
        assert!(write_config("{}", &path).is_err());
        assert_eq!(fs::read(path.join("keep")).unwrap(), b"user data");
    }
}
