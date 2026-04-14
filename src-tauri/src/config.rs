use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameModeConfig {
    pub auto_detect: bool,
    pub process_blacklist: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Config {
    pub game_mode: GameModeConfig,
    pub agent_server_port: u16,
    pub notification_preview_duration: u64,
    pub collapse_delay_ms: u64,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            game_mode: GameModeConfig {
                auto_detect: true,
                process_blacklist: vec![],
            },
            agent_server_port: 27182,
            notification_preview_duration: 2000,
            collapse_delay_ms: 300,
        }
    }
}

fn config_path() -> PathBuf {
    let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("windows-island");
    path.push("config.json");
    path
}

pub fn load() -> Config {
    let path = config_path();
    if let Ok(data) = fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        let cfg = Config::default();
        save(&cfg);
        cfg
    }
}

pub fn save(cfg: &Config) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(data) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(path, data);
    }
}
