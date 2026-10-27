use std::path::PathBuf;

use dirs::config_dir;

/// Test builds never resolve a user's data directory: each test process gets
/// its own scratch directory. A test build is not a preview build, so without
/// this the real-engine process tests wrote installation plans into the
/// developer's own `RRFlow/Connectome`.
#[cfg(test)]
pub fn get_data_directory() -> PathBuf {
    std::env::temp_dir().join(format!("connectome-test-data-{}", std::process::id()))
}

/// The directory where the application data is stored.
#[cfg(not(test))]
pub fn get_data_directory() -> PathBuf {
    let mut config_path = config_dir().expect("data directory should be resolvable");
    let is_preview = env!("VITE_CONNECTOME_PREVIEW") == "true";

    config_path.push("RRFlow");

    if is_preview {
        config_path.push("ConnectomePreview");
    } else {
        config_path.push("Connectome");
    }

    config_path
}

/// The path to the configuration file
pub fn get_config_path() -> PathBuf {
    let mut config_path = get_data_directory();
    config_path.push("config.json");
    config_path
}

/// The path to a backup configuration file
pub fn get_config_backup_path(version: u32) -> PathBuf {
    let mut config_path = get_data_directory();
    config_path.push("backups");
    config_path.push(format!("config-version-{}.json", version));
    config_path
}

/// The path to the file whitelist
pub fn get_file_whitelist_path() -> PathBuf {
    let mut config_path = get_data_directory();
    config_path.push("allowed_files");
    config_path
}

/// The path to the logs directory
pub fn get_logs_directory() -> PathBuf {
    let mut config_path = get_data_directory();
    config_path.push("logs");
    config_path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builds_never_resolve_a_user_data_directory() {
        let data = get_data_directory();
        assert!(data.starts_with(std::env::temp_dir()));
        let user = config_dir()
            .expect("data directory should be resolvable")
            .join("RRFlow");
        assert!(
            !data.starts_with(&user),
            "{} is a user directory",
            data.display()
        );
        assert!(get_config_path().starts_with(&data));
    }
}
