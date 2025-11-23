# FiLine Wall - Tmux Quick Start Guide

## 🚀 Quick Commands

### Start the Server
```bash
# Start in tmux and attach immediately
./start-tmux.sh

# Start in tmux but stay detached (run in background)
./start-tmux.sh detached
```

### Manage the Server
```bash
# Easy management commands
./filine-ctl.sh start      # Start in background
./filine-ctl.sh stop       # Stop the server
./filine-ctl.sh restart    # Restart the server
./filine-ctl.sh attach     # View logs
./filine-ctl.sh status     # Check if running
./filine-ctl.sh logs       # Same as attach
```

---

## 📋 Tmux Basics

### Key Bindings (Inside Tmux)
- **Detach from session**: `Ctrl+B` then `D`
- **Scroll up/down**: `Ctrl+B` then `[` (use arrow keys, press `q` to exit)
- **Kill session**: `Ctrl+C` (stops the server)

### Direct Tmux Commands
```bash
# List all tmux sessions
tmux ls

# Attach to FiLine Wall session
tmux attach -t filine-wall

# Kill the session
tmux kill-session -t filine-wall

# Create new window in session
tmux new-window -t filine-wall

# Split pane horizontally
Ctrl+B then "

# Split pane vertically
Ctrl+B then %
```

---

## 📊 Example Workflow

### 1. Start the Server (Background)
```bash
./filine-ctl.sh start
```
Output:
```
[✓] Session started! Use './filine-ctl.sh attach' to view logs
```

### 2. Check Status
```bash
./filine-ctl.sh status
```
Output:
```
[✓] FiLine Wall is RUNNING

Session info:
  • Name: filine-wall
  • Windows: 1
  • Created: Sat Nov 23 14:30:00 2025

Use './filine-ctl.sh attach' to view logs
```

### 3. View Logs
```bash
./filine-ctl.sh attach
```
You'll see:
```
╔═══════════════════════════════════════════════╗
║                                               ║
║              FiLine Wall v1.0                 ║
║         Spam Call Blocking System             ║
║                                               ║
╚═══════════════════════════════════════════════╝

[INFO] Server starting...
INFO  [HTTP] POST /api/screen-call 200 - 45ms
INFO  [CallScreening] 📞 INCOMING CALL from +15551234567
WARN  [CallScreening] 🚫 BLOCKED - FCC spam database match
```

### 4. Detach (Keep Running)
Press: `Ctrl+B` then `D`

Server continues running in background!

### 5. Stop the Server
```bash
./filine-ctl.sh stop
```

---

## 🎯 Why Use Tmux?

### ✅ Advantages
- **Runs in background** - Server keeps running when you close terminal
- **Persistent sessions** - Survives SSH disconnections
- **Easy access** - Attach/detach anytime to view logs
- **Multiple windows** - Run multiple commands in one session
- **Professional** - Industry standard for server management

### 📱 Perfect for Raspberry Pi
```bash
# Start server
./filine-ctl.sh start

# Close SSH connection
exit

# Later... reconnect and check
ssh pi@raspberry
cd ~/filine-wall
./filine-ctl.sh status
./filine-ctl.sh attach  # View logs
```

Server never stopped! 🎉

---

## 🔧 Advanced Usage

### Monitor Multiple Things

**Window 1**: FiLine Wall Server
```bash
./start-tmux.sh
```

**Window 2**: Database logs (in same session)
```bash
# Attach to session
tmux attach -t filine-wall

# Create new window: Ctrl+B then C
# Switch windows: Ctrl+B then 0, 1, 2...
# In new window, run:
tail -f /var/log/postgresql/postgresql.log
```

**Window 3**: System monitor
```bash
# Create another window: Ctrl+B then C
htop
```

### Split Screen View
```bash
# Attach to session
tmux attach -t filine-wall

# Split horizontally: Ctrl+B then "
# Now you have two panes

# Top pane: FiLine Wall logs (already running)
# Bottom pane: Watch database
tail -f logs/filine.log

# Navigate between panes: Ctrl+B then arrow keys
```

---

## 🐛 Troubleshooting

### Session Already Exists
```bash
./start-tmux.sh
# Options:
#   1) Attach to existing session
#   2) Kill existing session and start new one
#   3) Exit
```

### Can't Find Tmux
```bash
# Install tmux
sudo apt install tmux          # Debian/Ubuntu/Raspberry Pi OS
sudo yum install tmux          # RedHat/CentOS
brew install tmux              # macOS
```

### Port Already in Use
```bash
# Find what's using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or restart FiLine Wall
./filine-ctl.sh restart
```

### View Session but Not Attach
```bash
# List all sessions with details
tmux ls

# View session activity without attaching
tmux capture-pane -t filine-wall -p
```

---

## 📚 Tmux Cheat Sheet

### Session Management
| Command | Description |
|---------|-------------|
| `tmux new -s name` | Create new session |
| `tmux ls` | List sessions |
| `tmux attach -t name` | Attach to session |
| `tmux kill-session -t name` | Kill session |
| `Ctrl+B D` | Detach from session |

### Window Management
| Command | Description |
|---------|-------------|
| `Ctrl+B C` | Create new window |
| `Ctrl+B N` | Next window |
| `Ctrl+B P` | Previous window |
| `Ctrl+B 0-9` | Switch to window number |
| `Ctrl+B ,` | Rename window |
| `Ctrl+B &` | Kill window |

### Pane Management
| Command | Description |
|---------|-------------|
| `Ctrl+B "` | Split horizontally |
| `Ctrl+B %` | Split vertically |
| `Ctrl+B Arrow` | Navigate panes |
| `Ctrl+B X` | Kill pane |
| `Ctrl+B Z` | Zoom pane (fullscreen) |

### Copy Mode (Scrolling)
| Command | Description |
|---------|-------------|
| `Ctrl+B [` | Enter copy mode |
| `Arrow keys` | Navigate |
| `Page Up/Down` | Scroll |
| `Q` | Exit copy mode |
| `Space` | Start selection |
| `Enter` | Copy selection |

---

## 🎉 Summary

**Start server in background:**
```bash
./filine-ctl.sh start
```

**View logs:**
```bash
./filine-ctl.sh attach
```

**Detach (keep running):**
```
Ctrl+B then D
```

**Stop server:**
```bash
./filine-ctl.sh stop
```

That's it! Your FiLine Wall server runs persistently in the background, and you can check on it anytime! 🚀
