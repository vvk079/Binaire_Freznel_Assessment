# Binaire - Terminal System Monitor (btop clone)

A high-performance, terminal-based system tasks and sensor monitor inspired by **btop**, developed for the Binaire Private Limited JavaScript Developer Assessment.

Built exclusively for the terminal (CLI / Powershell / Command Prompt / macOS / Linux) using Node.js, TypeScript, React Ink, `systeminformation`, `ps-list`, `pidusage`, and Firebase Authentication.

---

## Architecture & Design Principles

- **Object-Oriented Logic**: Core business logic and data providers (`SensorService`, `ProcessService`, `AuthService`, `HistoryBuffer`) are encapsulated in TypeScript classes using strict OOP design.
- **Separation of Concerns**: Per the assessment requirements, no single library covers UI, process data, and sensors together:
  - **Sensors**: `systeminformation` (+ Node.js native `os` and `fs.statfsSync` cross-platform fallbacks)
  - **Processes**: `ps-list` + `pidusage` (with PowerShell fallback for modern Windows 11 compatibility)
  - **Authentication**: `firebase` (Email/Password SDK)
  - **UI / Terminal Layout**: `ink` (React for CLI)
- **Zero Fabricated Data**: Never displays fake or simulated sensor readings. If hardware sensors are unavailable or ACPI permissions require administrative privileges, the interface reports `N/A` or `Unsupported`.
- **Guarded Process Management**: 
  - Requires explicit user confirmation dialog before terminating any process.
  - Automatically identifies and blocks termination of critical system processes (PID 0, PID 4, `smss.exe`, `csrss.exe`, `services.exe`, `init`, `systemd`, etc., as well as the monitor process itself).
  - Handles permission errors and non-existent PIDs gracefully.
- **Complete Keyboard Interactivity**: Full keyboard-driven navigation across authentication and the monitor dashboard without conflicting shortcuts.
- **Responsive Terminal**: Dynamic calculation of terminal columns and rows (`useStdout` resize events) to adapt layout across compact, medium, and large terminal windows.

---

## Features

- **Authentication Screen**:
  - Firebase Email/Password Sign-Up and Login modes.
  - Masked password input, real-time error handling with friendly error messages.
  - `Tab` to switch fields, `Enter` to submit, `Ctrl+U` to switch to Sign-Up, `Ctrl+L` to switch to Login.
- **CPU Panel (`¹cpu`)**:
  - Live multi-tiered braille/block graph with gradient shading (green base, yellow mid-range, peach/red peaks).
  - CPU model, frequency, overall CPU usage percentage, and core temperatures (`N/A` if sensor unavailable).
  - Per-core load bars (`C0` – `C3`).
  - `cpu ▲▼ gpu` divider with secondary GPU activity graph.
  - System uptime display (`up HH:MM:SS`) and load averages.
- **Memory Panel (`²mem`)**:
  - Detailed physical and swap memory metrics: Total, Used, Available, Cache, and Swap with color-coded stacked meters.
- **Disks Panel (`disks`)**:
  - Real filesystem mount points, total storage, and used/free percentages using `systeminformation` and native `fs.statfsSync`.
- **Network Panel (`³net`)**:
  - Dual mirrored network traffic graph (download/RX on top in purple/cyan, center divider, upload/TX below in magenta).
  - Real-time download/upload speeds (KB/s, MiB/s) and total data transferred.
- **Process Table (`⁴proc`)**:
  - Live process listing with `PID`, `Program`, `Command`, `Threads`, `User`, `MemB`, and `Cpu%`.
  - Colored activity indicators (`▪`, `▄`, `█`) based on CPU usage.
  - Live row selection cursor with arrow keys (`↑` / `↓`).
  - Process inspection dialog (`Enter`) displaying detailed metadata.
  - Guarded process termination with confirmation modal (`Space`, `t`, or `Delete`).

---

## Keyboard Controls

| Key | Context | Action |
| --- | --- | --- |
| `↑` / `↓` | Dashboard | Select process row in table |
| `PageUp` / `PageDown` | Dashboard | Jump 5 rows up / down |
| `Enter` | Dashboard | Open detailed Process Inspection modal |
| `Space` / `t` / `Delete` | Dashboard | Open Termination Confirmation dialog |
| `y` / `Enter` | Confirm Dialog | Confirm process termination |
| `n` / `Esc` | Confirm Dialog | Cancel process termination |
| `f` / `/` | Dashboard | Enter real-time process search/filter mode |
| `s` | Dashboard | Cycle sorting key (`CPU` → `MEM` → `PID` → `NAME` → `THREADS`) |
| `r` | Dashboard | Toggle ascending / descending sort order |
| `c` | Dashboard | Clear active filter |
| `q` / `Ctrl + C` | All | Exit the application |
| `Tab` | Auth Screen | Switch between Email and Password fields |
| `Enter` | Auth Screen | Submit credentials |
| `Ctrl + U` | Auth Screen | Switch to **Sign-Up** mode |
| `Ctrl + L` | Auth Screen | Switch to **Login** mode |

---

## Setup & Running

### 1. Prerequisites
- Node.js (v18 or higher)
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Firebase Authentication
1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Email/Password** authentication under *Authentication > Sign-in method*.
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your project keys in `.env`:
   ```env
   FIREBASE_API_KEY=your_api_key_here
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   ```
*(Note: `.env` is ignored by git and will never be committed).*

### 4. Build, Test, and Run
```bash
# Run automated system tests
npm test

# Build TypeScript and start
npm run dev

# Or build explicitly and run:
npm run build
npm start
```
