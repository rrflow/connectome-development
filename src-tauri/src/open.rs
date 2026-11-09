use std::fs::{self, read_to_string};
use std::path::Path;
use std::sync::Mutex;

use log::info;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Window};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_dialog::FilePath;

use crate::whitelist::{append_allowed_file, read_allowed_files, write_allowed_files};
use crate::window;

const MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;

/// The state holding resources requested for opening
pub struct OpenResourceState(pub Mutex<Vec<url::Url>>);

pub fn store_resources<T: IntoIterator<Item = String>>(app: &AppHandle, args: T) {
    let mut urls = Vec::new();

    for arg in args.into_iter().skip(1) {
        let path = Path::new(&arg);

        if let Ok(url) = url::Url::from_file_path(path) {
            urls.push(url);
        } else if let Ok(url) = url::Url::parse(&arg) {
            urls.push(url);
        }
    }

    if !urls.is_empty() {
        *app.state::<OpenResourceState>().0.lock().unwrap() = urls;
    }
}

#[derive(Serialize)]
pub enum OpenedResource {
    File(FileResource),
    Link(LinkResource),
    Unknown,
}

#[derive(Serialize)]
pub struct FileResource {
    pub success: bool,
    pub name: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct LinkResource {
    pub host: String,
    pub params: String,
}

#[tauri::command]
pub fn get_opened_resources(state: State<OpenResourceState>) -> Vec<OpenedResource> {
    {
        info!("Fetching requested resources {:?}", state.0.lock().unwrap());
    }

    state
        .0
        .lock()
        .unwrap()
        .iter()
        .map(|u| match u.scheme() {
            "file" => {
                let buf = u.to_file_path().unwrap();
                let success = buf.metadata().unwrap().len() < MAX_FILE_SIZE;
                let name = buf.file_stem().unwrap().to_owned().into_string().unwrap();
                let path = buf.canonicalize().unwrap().to_str().unwrap().to_owned();

                append_allowed_file(&buf);

                OpenedResource::File(FileResource {
                    success,
                    name,
                    path,
                })
            }
            "connectome" => {
                let host = u.host_str().unwrap_or_default().to_owned();
                let params = u.query().unwrap_or_default().to_owned();

                OpenedResource::Link(LinkResource { host, params })
            }
            _ => OpenedResource::Unknown,
        })
        .collect()
}

#[tauri::command]
pub fn clear_opened_resources(state: State<OpenResourceState>) {
    *state.0.lock().unwrap() = Vec::new();
}

#[tauri::command]
pub fn read_query_file(path: String) -> Result<String, String> {
    let whitelist = read_allowed_files();

    match read_to_string(path.clone()) {
        Ok(content) => {
            if whitelist.contains(&path) {
                Ok(content)
            } else {
                Err("File is not allowed".into())
            }
        }
        Err(_) => Err("Failed to read file".into()),
    }
}

#[tauri::command]
pub fn write_query_file(path: String, content: String) -> Result<(), String> {
    let whitelist = read_allowed_files();

    if !whitelist.contains(&path) {
        return Err("File is not allowed".into());
    }

    match fs::write(path, content) {
        Ok(_) => Ok(()),
        Err(_) => Err("Failed to write file".into()),
    }
}

#[tauri::command]
pub fn prune_allowed_files(paths: Vec<String>) {
    let mut whitelist = read_allowed_files();

    whitelist.retain(|p| paths.contains(p));
    write_allowed_files(whitelist);
}

#[tauri::command]
pub async fn open_query_file(app: AppHandle, window: Window) {
    let mut dialog = app.dialog().file();

    #[cfg(desktop)]
    {
        dialog = dialog.set_parent(&window);
    }

    let files = dialog.blocking_pick_files().unwrap_or_default();
    let urls: Vec<url::Url> = files
        .iter()
        .filter_map(|f| match f {
            FilePath::Url(_) => None,
            FilePath::Path(buf) => Some(buf.display().to_string()),
        })
        .filter_map(|f| url::Url::from_file_path(f).ok())
        .collect();

    info!("My paths: {:?}", urls);

    *app.state::<OpenResourceState>().0.lock().unwrap() = urls;
    window::emit_last(&app, "open-resource", ());
}

#[tauri::command]
pub async fn open_in_explorer(path: String) {
    let whitelist = read_allowed_files();

    if whitelist.contains(&path) {
        showfile::show_path_in_file_manager(Path::new(&path));
    }
}

/// A Workbench linked path the operator chose through the native dialog.
#[derive(Debug, Deserialize)]
pub struct ExternalPathProbeRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct ExternalPathProbeView {
    pub path: String,
    pub connected: bool,
    pub is_directory: Option<bool>,
    pub size_bytes: Option<u64>,
    pub modified_at_unix_ms: Option<u64>,
    pub message: Option<String>,
}

/// Reports whether a linked path is reachable right now, without reading it.
#[tauri::command]
pub fn probe_external_path(request: ExternalPathProbeRequest) -> ExternalPathProbeView {
    let path = Path::new(request.path.as_str());
    match fs::metadata(path) {
        Ok(metadata) => {
            let modified_at_unix_ms = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
                .and_then(|duration| u64::try_from(duration.as_millis()).ok());
            ExternalPathProbeView {
                path: request.path,
                connected: true,
                is_directory: Some(metadata.is_dir()),
                size_bytes: Some(metadata.len()),
                modified_at_unix_ms,
                message: None,
            }
        }
        Err(error) => ExternalPathProbeView {
            path: request.path,
            connected: false,
            is_directory: None,
            size_bytes: None,
            modified_at_unix_ms: None,
            message: Some(error.to_string()),
        },
    }
}

#[derive(Debug, Deserialize)]
pub struct WriteExternalTextFileRequest {
    pub path: String,
    pub content: String,
    pub create_parent_dirs: bool,
}

/// Writes one text artifact under a folder the operator linked in the Workbench.
#[tauri::command]
pub fn write_external_text_file(request: WriteExternalTextFileRequest) -> Result<(), String> {
    let path = Path::new(request.path.as_str());
    if request.create_parent_dirs {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("cannot create parent directories: {error}"))?;
        }
    }
    fs::write(path, request.content).map_err(|error| format!("cannot write file: {error}"))
}
