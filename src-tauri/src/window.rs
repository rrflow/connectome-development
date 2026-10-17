use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

static LAST_FOCUSED_WINDOW: OnceLock<Mutex<Option<String>>> = OnceLock::new();

#[tauri::command]
pub fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

#[tauri::command]
pub async fn new_window(app: AppHandle) {
    open_new_window(&app).await;
}

/// Every application window label starts with this prefix. The capability in
/// `capabilities/connectome.json` grants permissions to `connectome-*`; a
/// window outside that pattern receives no core or plugin permission and the
/// renderer cannot start.
pub const WINDOW_LABEL_PREFIX: &str = "connectome-";

pub async fn open_new_window(app: &AppHandle) {
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let window_label = format!("{WINDOW_LABEL_PREFIX}{current_time}");

    #[allow(unused_mut)]
    let mut builder = tauri::WebviewWindowBuilder::new(app, &window_label, Default::default())
        .title("Connectome · RRFlow")
        .inner_size(1435.0, 775.0)
        .center()
        .min_inner_size(825.0, 675.0);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.decorations(false);
    }

    let window = builder.build().expect("Failed to create window");

    window.on_window_event(move |event| {
        if let WindowEvent::Focused(focused) = event {
            if *focused {
                set_last_focused_window(&window_label);
            }
        }
    });
}

pub fn set_last_focused_window(label: &str) {
    let storage = LAST_FOCUSED_WINDOW.get_or_init(|| Mutex::new(None));
    let mut last = storage.lock().unwrap();
    *last = Some(label.to_string());
}

pub fn get_last_focused_window(app: &AppHandle) -> tauri::WebviewWindow {
    let storage = LAST_FOCUSED_WINDOW.get_or_init(|| Mutex::new(None));
    let last = storage.lock().unwrap();
    if let Some(label) = last.as_ref() {
        if let Some(window) = app.get_webview_window(label) {
            return window;
        }
    }

    // Fallback: return the first available window
    app.webview_windows()
        .values()
        .next()
        .expect("No windows available")
        .clone()
}

pub fn emit_last(app: &AppHandle, event: &str, payload: impl serde::Serialize + Clone) {
    let last_window = get_last_focused_window(app);

    app.emit_to(last_window.label(), event, payload)
        .expect("Failed to emit event");
}

#[cfg(test)]
mod tests {
    use super::WINDOW_LABEL_PREFIX;

    /// Tauri matches capability window patterns case-sensitively; a mismatch
    /// leaves the window without permissions and renders a blank screen.
    #[test]
    fn application_windows_match_the_capability_window_pattern() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/connectome.json"))
                .expect("capability is JSON");
        let label = format!("{WINDOW_LABEL_PREFIX}1792192224");
        let patterns = capability["windows"]
            .as_array()
            .expect("capability names its windows");
        assert!(
            patterns
                .iter()
                .filter_map(|pattern| pattern.as_str())
                .any(|pattern| {
                    match pattern.strip_suffix('*') {
                        Some(prefix) => label.starts_with(prefix),
                        None => label == pattern,
                    }
                }),
            "window label {label} matches none of {patterns:?}"
        );
    }
}
