use ratatui::{
    crossterm::event::{self, Event, KeyCode},
    prelude::*,
    widgets::{Block, Borders, Paragraph},
};
use shared::DaemonStatus;
use std::{fs, io, time::Duration};

fn main() -> io::Result<()> {
    // 1. SETUP (Ratatui 0.30 handles all the crossterm boilerplate for us!)
    let mut terminal = ratatui::init();

    // 2. THE MAIN EVENT LOOP
    loop {
        // Draw the UI
        terminal.draw(|f| ui(f))?;

        // Wait up to 250ms for a keyboard event
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    // Press 'q' or 'Esc' to quit
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    _ => {}
                }
            }
        }
    }

    // 3. CLEANUP (Safely restores the user's terminal)
    ratatui::restore();

    Ok(())
}

// --- THE RENDER ENGINE ---
fn ui(frame: &mut Frame) {
    let status_text = match fs::read_to_string("../.daemon_status.json") {
        Ok(contents) => {
            if let Ok(daemon) = serde_json::from_str::<DaemonStatus>(&contents) {
                format!(
                    "SYSTEM ONLINE\nStatus: {}\nPort: {}\nURL: {}\nPID: {}",
                    daemon.status.to_uppercase(),
                    daemon.port,
                    daemon.url.unwrap_or_default(),
                    daemon.pid
                )
            } else {
                "Error parsing daemon status.".to_string()
            }
        }
        Err(_) => "SYSTEM OFFLINE\nNo background process detected.".to_string(),
    };

    let paragraph = Paragraph::new(status_text)
        .block(Block::default().title(" DAEMON STATUS ").borders(Borders::ALL))
        .style(Style::default().fg(Color::Green))
        .alignment(Alignment::Left);

    // 🔥 frame.area() works natively here!
    frame.render_widget(paragraph, frame.area());
}