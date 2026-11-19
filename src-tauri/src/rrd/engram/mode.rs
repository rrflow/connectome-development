//! The installation mode a project folder is planned with.
//!
//! RRFlow plans a fresh installation only for an empty folder and an existing
//! one beside files that are already there. Connectome reads which of the two
//! a folder is instead of asking: an empty folder is fresh, anything else is
//! existing. A pending preview states the mode it was planned with, so the
//! plan applied is the plan reviewed.

use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::rrd::error::RrdError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallMode {
    Fresh,
    Existing,
}

impl InstallMode {
    pub(super) fn argument(self) -> &'static str {
        match self {
            Self::Fresh => "fresh",
            Self::Existing => "existing",
        }
    }

    /// The mode `project` calls for. The caller has already created the
    /// folder, so one that was absent is empty here.
    pub(super) fn for_directory(project: &Path) -> Result<Self, RrdError> {
        let mut entries = std::fs::read_dir(project)
            .map_err(|error| format!("cannot read the project directory: {error}"))?;
        Ok(match entries.next() {
            None => Self::Fresh,
            Some(_) => Self::Existing,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_empty_folder_is_fresh_and_anything_else_is_existing() {
        let root = std::env::temp_dir().join(format!("connectome-mode-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        assert_eq!(
            InstallMode::for_directory(&root).unwrap(),
            InstallMode::Fresh
        );
        std::fs::create_dir(root.join(".git")).unwrap();
        assert_eq!(
            InstallMode::for_directory(&root).unwrap(),
            InstallMode::Existing,
            "a hidden entry is still the project's own state"
        );
        std::fs::remove_dir_all(&root).unwrap();
        assert!(
            InstallMode::for_directory(&root).is_err(),
            "a folder that cannot be read is not guessed at"
        );
    }
}
