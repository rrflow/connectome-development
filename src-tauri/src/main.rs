#![allow(deprecated)]
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::{env, sync::OnceLock};

use log::info;
use paths::get_logs_directory;
use rrd::estate::EstateState;
use rrd::RrdClientState;
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_log::{Target, TargetKind};
use time::{format_description, OffsetDateTime};

mod appbar;
mod config;
mod diagnostics;
mod open;
mod paths;
mod rrd;
mod whitelist;
pub mod window;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

fn set_app_handle(app: AppHandle) {
    APP_HANDLE.set(app).expect("App handle already set");
}

pub fn get_app_handle() -> &'static AppHandle {
    APP_HANDLE.get().expect("App handle not set")
}

fn main() {
    env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    let context = tauri::generate_context!();
    let log_time_fmt =
        format_description::parse("[year]-[month]-[day] [hour]:[minute]:[second]").unwrap();

    // Pre-release builds declare no updater endpoint or signing key, and the
    // updater plugin refuses to initialize without them. Register it only
    // when the build configuration carries an updater section.
    let updater_configured = context
        .config()
        .plugins
        .0
        .get("updater")
        .is_some_and(|config| !config.is_null());
    let mut builder = tauri::Builder::default();
    if updater_configured {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Build the Tauri instance
    let tauri = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_localhost::Builder::new(24454).build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            info!("Single instance intercept: {:?}", args);

            let emit_event = args.len() > 1;

            open::store_resources(app, args);

            if emit_event {
                window::emit_last(app, "open-resource", ());
            }

            if let Some((_, window)) = app.webview_windows().iter().next() {
                window.set_focus().unwrap();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .format(move |out, message, record| {
                    let now = OffsetDateTime::now_utc();
                    let time = now.format(&log_time_fmt).expect("Failed to format time");

                    out.finish(format_args!("{} [{}] {}", time, record.level(), message))
                })
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                    Target::new(TargetKind::Folder {
                        path: get_logs_directory(),
                        file_name: Some("connectome".into()),
                    }),
                ])
                .build(),
        )
        .manage(open::OpenResourceState(Default::default()))
        .manage(EstateState::default())
        .manage(RrdClientState::default())
        .invoke_handler(tauri::generate_handler![
            config::load_config,
            config::save_config,
            config::backup_config,
            config::has_config_backup,
            config::restore_config_backup,
            rrd::estate::rrd_estate_preview,
            rrd::estate::rrd_estate_serve,
            rrd::estate::rrd_estate_status,
            rrd::estate::rrd_estate_stop,
            diagnostics::runtime_diagnostics_request,
            rrd::rrd_public_request,
            rrd::rrd_connect,
            rrd::rrd_session,
            rrd::rrd_capabilities,
            rrd::rrd_database,
            rrd::rrd_schema,
            rrd::rrd_storage,
            rrd::rrd_query,
            rrd::rrd_vector_collections,
            rrd::rrd_vector_points,
            rrd::rrd_vector_search,
            rrd::rrd_vector_map,
            rrd::rrd_disconnect,
            window::toggle_devtools,
            window::new_window,
            open::get_opened_resources,
            open::clear_opened_resources,
            open::read_query_file,
            open::write_query_file,
            open::prune_allowed_files,
            open::open_query_file,
            open::open_in_explorer,
        ])
        .setup(|app| {
            info!("Launch args: {:?}", env::args());
            set_app_handle(app.handle().clone());

            #[cfg(any(windows, target_os = "linux"))]
            {
                open::store_resources(get_app_handle(), env::args());
            }

            tauri::async_runtime::block_on(window::open_new_window(app.handle()));

            Ok(())
        })
        .build(context)
        .expect("Tauri failed to initialize");

    tauri.run(move |app, event| match event {
        #[cfg(target_os = "macos")]
        RunEvent::Ready => {
            appbar::macos::setup_dock_menu();
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        RunEvent::Opened { urls } => {
            info!("Opened resources: {:?}", urls);

            *app.state::<open::OpenResourceState>().0.lock().unwrap() = urls;
            window::emit_last(app, "open-resource", ());
        }
        RunEvent::Exit => {
            rrd::estate::stop_on_exit(&app.state::<EstateState>());
        }
        _ => (),
    })
}
