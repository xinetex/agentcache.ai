#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;

/// Shared application state for the file watcher.
struct AppState {
    watch_path: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
}

/// Represents a file entry in a watched directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
    modified: Option<String>,
}

/// Folder metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FolderInfo {
    path: String,
    total_files: usize,
    total_directories: usize,
    total_size: u64,
    entries: Vec<FileEntry>,
}

/// Event payload emitted to the frontend on FS changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FsChangeEvent {
    kind: String,
    paths: Vec<String>,
}

/// Helper: read directory entries into FileEntry vec
fn read_entries(path: &PathBuf) -> Result<Vec<FileEntry>, String> {
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut entries = Vec::new();

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs().to_string()));

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

/// Lists files in the watched directory.
#[tauri::command]
fn list_watched_files(state: State<'_, AppState>) -> Result<Vec<FileEntry>, String> {
    let watch_path = state.watch_path.lock().map_err(|e| e.to_string())?;
    let path = watch_path.as_ref().ok_or("No watch path configured")?;
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    read_entries(path)
}

/// Returns folder metadata.
#[tauri::command]
fn get_folder_info(state: State<'_, AppState>) -> Result<FolderInfo, String> {
    let watch_path = state.watch_path.lock().map_err(|e| e.to_string())?;
    let path = watch_path.as_ref().ok_or("No watch path configured")?;
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let entries = read_entries(path)?;
    let total_files = entries.iter().filter(|e| !e.is_directory).count();
    let total_directories = entries.iter().filter(|e| e.is_directory).count();
    let total_size: u64 = entries.iter().map(|e| e.size).sum();

    Ok(FolderInfo {
        path: path.to_string_lossy().to_string(),
        total_files,
        total_directories,
        total_size,
        entries,
    })
}

/// Sets the watch path and starts FS monitoring.
/// Emits `fs-change` events to the frontend.
#[tauri::command]
fn set_watch_path(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let new_path = PathBuf::from(&path);
    if !new_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !new_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Stop existing watcher
    {
        let mut watcher_lock = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_lock = None;
    }

    // Create new watcher
    let (tx, mut rx) = mpsc::channel::<Event>(100);

    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            if let Ok(event) = result {
                let _ = tx.blocking_send(event);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher
        .watch(new_path.as_ref(), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {}", e))?;

    // Forward FS events to frontend
    let app_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            let kind = match event.kind {
                EventKind::Create(_) => "create",
                EventKind::Modify(_) => "modify",
                EventKind::Remove(_) => "remove",
                EventKind::Access(_) => "access",
                _ => "other",
            };
            let fs_event = FsChangeEvent {
                kind: kind.to_string(),
                paths: event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect(),
            };
            let _ = app_clone.emit("fs-change", &fs_event);
        }
    });

    // Update state
    {
        let mut wp = state.watch_path.lock().map_err(|e| e.to_string())?;
        *wp = Some(new_path);
    }
    {
        let mut wl = state.watcher.lock().map_err(|e| e.to_string())?;
        *wl = Some(watcher);
    }

    Ok(format!("Now watching: {}", path))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            watch_path: Mutex::new(None),
            watcher: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            list_watched_files,
            get_folder_info,
            set_watch_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentCache");
}
