# Python Setup Guide for Cloudless.gr Development

## Python Installation Status
❌ **Python is not currently installed or accessible in your system.**

## Quick Setup Instructions

### Option 1: Install Python from Microsoft Store (Recommended for Windows)
1. Open Microsoft Store
2. Search for "Python 3.12" or "Python 3.11"
3. Click "Get" to install
4. Restart VS Code after installation

### Option 2: Install from Python.org
1. Visit [python.org/downloads/windows/](https://www.python.org/downloads/windows/)
2. Download Python 3.9+ (recommended: 3.11 or 3.12)
3. During installation, **check "Add Python to PATH"**
4. Choose "Add Python to environment variables"
5. Restart VS Code after installation

### Option 3: Use Python via Windows Subsystem for Linux (WSL)
1. Install WSL2 from Microsoft Store
2. Install Ubuntu or your preferred Linux distribution
3. Install Python in WSL: `sudo apt update && sudo apt install python3 python3-pip python3-venv`

## After Python Installation

### 1. Verify Installation
Open a new terminal in VS Code and run:
```powershell
python --version
# or
py --version
```

### 2. Setup Virtual Environment
Run the VS Code task: **"Python: Setup Shared Environment"**
- Press `Ctrl+Shift+P`
- Type "Tasks: Run Task"
- Select "Python: Setup Shared Environment"

### 3. Activate Environment
Run the VS Code task: **"Python: Activate Virtual Environment"**

## VS Code Python Configuration

The following settings have been configured for optimal Python development:

### Python Interpreter Path
- **Primary**: `${workspaceFolder}/shared_venv/Scripts/python.exe`
- **Fallback**: System Python installation

### Virtual Environment Detection
- Automatically detects virtual environments in:
  - `shared_venv/` (project-specific)
  - `venv/`
  - `.venv/`

### Python Extensions Required
- **ms-python.python** - Core Python support
- **ms-python.debugpy** - Python debugging

## Troubleshooting

### Issue: "Python not found"
**Solution**: Ensure Python is installed and added to PATH. Restart VS Code.

### Issue: "Virtual environment not found"
**Solution**: Run "Python: Setup Shared Environment" task first.

### Issue: "Permission denied" when creating virtual environment
**Solution**: Run VS Code as Administrator or check folder permissions.

### Issue: Module import errors
**Solution**: Ensure PYTHONPATH includes project root directory.

## Docker Alternative

If you prefer not to install Python locally, you can use the Docker development environment:

```powershell
npm run docker:dev
```

This provides a complete Python environment within the Docker container.

## Next Steps

1. Install Python using one of the methods above
2. Restart VS Code
3. Run "Python: Setup Shared Environment" task
4. Start developing with Python support!

## Available Python Tasks

After setup, you'll have access to these VS Code tasks:
- **Python: Setup Shared Environment** - Creates virtual environment
- **Python: Activate Virtual Environment** - Activates the environment
- **Python: Install Python (Windows)** - Opens Python download page
- **Test: Python Platform** - Runs Python tests

## File Structure

```
shared_venv/                 # Python virtual environment
├── Scripts/                 # Windows executables
│   ├── python.exe          # Python interpreter
│   ├── pip.exe             # Package installer
│   └── activate.ps1        # Activation script
├── Lib/                    # Python libraries
└── pyvenv.cfg              # Environment configuration

requirements.txt            # Python dependencies
setup_shared_venv.py        # Environment setup script
tests/test_platform.py      # Python tests
```
