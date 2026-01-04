# CLAUDE.md - ActivityWatch Development Guide

This document provides essential information for AI assistants working with the ActivityWatch codebase.

## Project Overview

ActivityWatch is an open-source, privacy-focused automated time tracker. It records user activity (active applications, window titles, browser tabs, AFK status) while keeping all data stored locally on the user's machine.

**Key Goals:**
- Enable collection of valuable lifedata without compromising privacy
- User owns and controls all their data
- Cross-platform support (Windows, macOS, Linux, Android)
- Extensible architecture for custom watchers

## Architecture

ActivityWatch uses a modular architecture with these core components:

```
aw-qt (System Tray Manager)
├── aw-server / aw-server-rust (REST API + Data Storage)
│   └── aw-webui (Web Dashboard)
├── aw-watcher-window (Active Window Tracking)
├── aw-watcher-afk (AFK Detection)
├── aw-notify (Desktop Notifications)
└── aw-sync (Data Synchronization)
```

### Component Descriptions

| Component | Language | Description |
|-----------|----------|-------------|
| `aw-core` | Python | Core library with data models and schemas |
| `aw-client` | Python | Client library for watchers to communicate with server |
| `aw-server` | Python | REST API server (current default) |
| `aw-server-rust` | Rust | REST API server (future default) |
| `aw-qt` | Python/Qt | System tray application that manages all components |
| `aw-watcher-afk` | Python | Tracks keyboard/mouse activity for AFK detection |
| `aw-watcher-window` | Python | Tracks active application and window title |
| `aw-watcher-input` | Python | (Optional) Detailed input tracking |
| `aw-notify` | Python | (Optional) Desktop notifications |

### REST API

The server exposes these API endpoints at `http://localhost:5600/api/0/`:
- **Buckets API:** Create, retrieve, delete data buckets
- **Events API:** Read/write timestamped events within buckets
- **Heartbeat API:** Watchers send heartbeat signals to update current activity state
- **Query API:** Query language for filtering, merging, and transforming events

## Repository Structure

This is a **meta-repository** using git submodules to bundle all core components:

```
activitywatch/
├── aw-core/          # Core library (submodule)
├── aw-client/        # Client library (submodule)
├── aw-server/        # Python server (submodule)
├── aw-server-rust/   # Rust server (submodule)
├── aw-qt/            # System tray app (submodule)
├── aw-watcher-afk/   # AFK watcher (submodule)
├── aw-watcher-window/# Window watcher (submodule)
├── aw-watcher-input/ # Input watcher (submodule, optional)
├── aw-notify/        # Notifications (submodule, optional)
├── scripts/          # Build and CI scripts
│   ├── ci/           # CI-specific scripts
│   ├── package/      # Packaging scripts (zip, dmg, deb, AppImage)
│   └── tests/        # Integration test scripts
├── Makefile          # Main build orchestration
├── pyproject.toml    # Poetry configuration
├── aw.spec           # PyInstaller specification
└── .github/workflows/ # GitHub Actions CI/CD
```

## Development Setup

### Prerequisites

Required tools (versions in `.tool-versions`):
- Python 3.9+
- Poetry 1.5.1+
- Node.js 16+ (for aw-webui)
- Rust nightly (for aw-server-rust, optional)

### Initial Setup

```bash
# Clone with submodules
git clone --recursive https://github.com/ActivityWatch/activitywatch.git
cd activitywatch

# Or initialize submodules after cloning
git submodule update --init --recursive

# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate  # or `venv/Scripts/activate` on Windows
poetry install

# Build all components
make build
```

### Build Options

```bash
# Standard build (includes Rust server and WebUI)
make build

# Skip Rust server (Python-only)
make build SKIP_SERVER_RUST=true

# Skip WebUI build
make build SKIP_WEBUI=true

# Include extras (aw-notify, aw-watcher-input)
make build AW_EXTRAS=true
```

## Testing

```bash
# Run unit tests for all submodules
make test

# Run integration tests (requires server running)
make test-integration

# Lint all submodules
make lint

# Type checking
make typecheck
```

### Integration Tests

Integration tests are in `scripts/tests/integration_tests.py` and test the server API by:
1. Starting the server with `--testing` flag
2. Running pytest against `aw-server/tests/`
3. Verifying no ERROR indicators in logs

## Packaging

```bash
# Create distributable packages
make package

# Platform-specific outputs:
# Linux: .zip, .AppImage, .deb
# macOS: .zip, .dmg (with notarization if keys available)
# Windows: .zip, .exe installer (requires Inno Setup)
```

### PyInstaller

The `aw.spec` file defines how PyInstaller bundles the application:
- Bundles all watchers and server into single distribution
- Platform-specific handling for macOS app bundle
- Includes aw-server-rust binary if available

## Code Conventions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

Types: feat, fix, chore, ci, docs, style, refactor, perf, test

Examples:
- feat: added ability to sort by duration
- fix: fixes incorrect week number (#407)
- docs: improved query documentation
```

### Code Style

- Python: Standard Python conventions, type hints encouraged
- Use the linting and typechecking targets (`make lint`, `make typecheck`)

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `build.yml` | push/PR to master, tags | Full build, test, package on all platforms |
| `test.yml` | manual | Upgrade integration tests between versions |
| `codeql.yml` | push/PR, weekly | Security analysis for Python/JavaScript |
| `diagram.yml` | - | Generates architecture diagram |

### Build Matrix

- **OS:** Ubuntu 22.04, Windows latest, macOS 13
- **Python:** 3.9
- **Node:** 20
- Builds include both debug and release modes (release on tags/master)

## Key Files

| File | Purpose |
|------|---------|
| `Makefile` | Main build orchestration for all submodules |
| `pyproject.toml` | Poetry dependencies and project metadata |
| `aw.spec` | PyInstaller bundling configuration |
| `.gitmodules` | Submodule URL definitions |
| `.tool-versions` | asdf tool version specifications |
| `gptme.toml` | AI context files configuration |

## Common Tasks

### Adding a New Watcher

1. Create new submodule or standalone repo
2. Implement using `aw-client` library
3. Send heartbeats to appropriate bucket
4. Add to `Makefile` SUBMODULES if bundling

### Modifying the Server API

1. Changes in `aw-server` (Python) or `aw-server-rust`
2. Update `aw-core` schemas if data model changes
3. Update client libraries (`aw-client`, `aw-client-js`, `aw-client-rust`)
4. Run integration tests to verify compatibility

### Working with Submodules

```bash
# Update all submodules to latest
make update

# Checkout specific branch in submodule
cd aw-server && git checkout feature-branch

# After making changes in submodule
cd aw-server && git add . && git commit -m "..."
cd .. && git add aw-server && git commit -m "chore: update aw-server submodule"
```

## Debugging

### Server Logs

Default log location: `~/.local/share/activitywatch/logs/` (Linux/macOS) or `%LOCALAPPDATA%\activitywatch\logs\` (Windows)

### Testing Mode

Run server with `--testing` flag to use separate database and avoid affecting production data.

### Common Issues

- **Qt not found:** Install Qt5 development packages
- **Rust build fails:** Ensure Rust nightly is installed, or use `SKIP_SERVER_RUST=true`
- **WebUI build fails:** Check Node.js version, clear npm cache

## External Resources

- **Documentation:** https://docs.activitywatch.net
- **Forum:** https://forum.activitywatch.net
- **Discord:** https://discord.gg/vDskV9q
- **GitHub Discussions:** https://github.com/ActivityWatch/activitywatch/discussions
