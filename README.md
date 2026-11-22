# Binaire - Terminal System Monitor (btop clone)

A high-performance, terminal-based system tasks and sensor monitor inspired by **btop**, developed for the Binaire Private Limited developer assessment.

Built exclusively for the terminal (CLI / Powershell / Command Prompt) using Node.js, TypeScript, React Ink, `systeminformation`, `ps-list`, `pidusage`, and Firebase Authentication.

---

## Architecture & Design Principles

- **Object-Oriented Logic**: Core business logic and data providers (`SensorService`, `ProcessService`, `AuthService`, `HistoryBuffer`) are encapsulated in TypeScript classes using strict OOP design.
- **Separation of Concerns**: Per the requirements, no single library covers UI, process data, and sensors together:
  - **Sensors**: `systeminformation`
  - **Processes**: `ps-list` + `pidusage` (with fallback to PowerShell for Windows 11 compatibility)
  - **Authentication**: `firebase` (Email/Password SDK)
  - **UI / Terminal Layout**: `ink` (React for CLI)
- **Safe Degradation**: All services handle missing sensor or hardware metrics gracefully by returning `null` rather than crashing. Missing data renders as `N/A`.
- **Keyboard Interactivity**: Complete keyboard-driven navigation across authentication and the monitor dashboard.
- **Responsive Terminal**: Dynamic calculation of terminal columns and rows (`useStdout`) to automatically adapt layout without vertical overflow.

---

## Features

- **Authentication Screen**:
  - Firebase Email/Password Sign-Up and Login modes.
  - Masked password input, real-time error handling with friendly error messages.
  - `Tab` to switch fields, `Enter` to submit, `Ctrl+U` to switch to Sign-Up, `Ctrl+L` to switch to Login.
- **CPU Panel (`¹cpu`)**:
  - Live multi-tiered braille/block graph with gradient shading (green base, yellow mid-range, peach/red peaks).
  - CPU model, frequency, overall CPU usage percentage, and core temperatures.
  - Per-core load bars (`C0` – `C3`).
  - `cpu ▲▼ gpu` divider with secondary GPU activity graph.
  - System uptime display (`up HH:MM:SS`) and load averages.
- **Memory Panel (`²mem`)**:
  - Detailed memory metrics: Total, Used, Available, Cache, and Committed with color-coded stacked meters.
  - GPU shared memory and Virtual Page file statistics.
- **Disks Panel (`disks`)**:
  - Filesystem mount points, total storage, used/free percentages, and real-time I/O activity.
- **Network Panel (`³net`)**:
  - Dual mirrored network traffic graph (download/RX on top in purple/cyan, center divider, upload/TX below in magenta).
  - Real-time download/upload speeds (KB/s, MiB/s) and total data transferred.
- **Process Table (`⁴proc`)**:
  - Live process listing with `PID`, `Program`, `Command`, `Threads`, `User`, `MemB`, and `Cpu%`.
  - Colored activity indicators (`▪`, `▄`, `█`) based on CPU usage.
  - Live row selection cursor with arrow keys (`↑` / `↓`).
  - Process termination (`Space`, `t`, or `Delete` key) using native task kill.

---

## Keyboard Controls

| Key | Action |
| --- | --- |
| `↑` / `↓` | Navigate / select processes in the process table |
| `Space` / `t` / `Delete` | Terminate (kill) the selected process |
| `Tab` | Switch between Email and Password fields (Auth screen) |
| `Enter` | Submit credentials (Auth screen) |
| `Ctrl + U` | Switch to **Sign-Up** mode (Auth screen) |
| `Ctrl + L` | Switch to **Login** mode (Auth screen) |
| `q` / `Ctrl + C` | Exit the application |

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

### 4. Build and Run
```bash
# Build TypeScript and start
npm run dev

# Or build explicitly and run:
npm run build
npm start
```
