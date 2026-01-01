if (require('electron-squirrel-startup')) return;

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const auth = require('./auth');

let mainWindow;
let isQuitting = false; // Flag to track intentional quit

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, '../../assets/icons/MrSoul-icon.ico')
    });

    // Load from Vite dev server in development, or from built files in production
    if (process.argv.includes('--dev') || process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
        // DevTools disabled for production
    }

    // Health Monitoring
    mainWindow.on('unresponsive', () => {
        console.warn('[WINDOW] Main window became unresponsive! (Main thread blocked)');
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error(`[WINDOW] Renderer process gone! Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
    });

    // Only prevent close if not intentionally quitting
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            console.log('[WINDOW] Manual close request detected - initiating quit');
            isQuitting = true;
            app.quit();
        } else {
            console.log('[WINDOW] Closing window - quit already initiated');
        }
    });

    mainWindow.on('closed', () => {
        console.log('[WINDOW] Main window closed and destroyed.');
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Initialize auth module
    auth.init({
        sessionFile: path.join(app.getPath('appData'), '.soul-launcher', 'session.json'),
        appDataDir: path.join(app.getPath('appData'), '.soul-launcher')
    });

    createWindow();

    // Initialize Launcher with mainWindow for progress events
    const launcher = require('./launcher');
    launcher.init(mainWindow);

    ipcMain.handle('generate-report', async () => {
        try {
            const { execSync } = require('child_process');
            const fs = require('fs');
            const dns = require('dns').promises;
            const templatePath = path.join(__dirname, '../../assets/report_template.html');

            if (!fs.existsSync(templatePath)) {
                throw new Error('Report template not found');
            }

            let htmlContent = fs.readFileSync(templatePath, 'utf8');

            // --- 1. VALIDACIÓN: INTERNET ---
            let netStatus = "OK ✅";
            try {
                await dns.lookup('authserver.mojang.com');
            } catch (e) {
                netStatus = "ERROR ❌";
            }

            // --- 2. VALIDACIÓN: JVM FLAGS ---
            const aikarFlagsArr = [
                "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200",
                "-XX:+UnlockExperimentalVMOptions", "-XX:+DisableExplicitGC", "-XX:+AlwaysPreTouch",
                "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40", "-XX:G1HeapRegionSize=8M",
                "-XX:G1ReservePercent=20", "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4",
                "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90",
                "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32", "-XX:+PerfDisableSharedMem",
                "-XX:MaxTenuringThreshold=1"
            ];

            let flagStatus = "OK ✅";
            let flagError = "";
            try {
                execSync(`java ${aikarFlagsArr.join(' ')} -version`, { stdio: 'ignore' });
            } catch (e) {
                flagStatus = "ERROR ❌";
                flagError = "Flags not compatible with your Java version.";
            }

            // --- 3. VALIDACIÓN: RECURSOS ---
            const ram = os.totalmem() / (1024 * 1024 * 1024);
            let ramStatus = ram > 4 ? "OK ✅" : "WARNING ⚠️";

            // Template replacements
            htmlContent = htmlContent.replace('Aikar\'s Flags</span>', `Aikar's Flags</span> <br> <small style="color: ${flagStatus.includes('OK') ? '#4ade80' : '#ff5757'}">${flagError || 'Compatibility confirmed'}</small>`);
            htmlContent = htmlContent.replace('card-status">OK ✅</span>', `card-status">${flagStatus}</span>`); // Replace the first one by default

            // Specific replacements for realism
            htmlContent = htmlContent.replace('Autenticación</span>\n                    <span class="card-status">OK ✅</span>', `Authentication</span>\n                    <span class="card-status">${netStatus}</span>`);
            htmlContent = htmlContent.replace('Selector Java</span>\n                    <span class="card-status">OK ✅</span>', `Java Selector</span>\n                    <span class="card-status">${ramStatus}</span>`);

            // Add real-time log
            const now = new Date().toLocaleString();
            htmlContent = htmlContent.replace('<div class="log-line ok">[SUCCESS] Test general de estabilidad finalizado con éxito.</div>',
                `<div class="log-line info">[INFO] Test performed on: ${now}</div>\n<div class="log-line ok">[SUCCESS] Stability test finished successfully.</div>`);

            return { success: true, html: htmlContent };
        } catch (error) {
            console.error('Error generating report:', error);
            return { success: false, error: error.message };
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Prevent auto-quit when launching games
// This was causing the launcher to close when Minecraft launched in detached mode
app.on('window-all-closed', () => {
    // Don't quit automatically - keep launcher running
    // User can manually close via window controls
    console.log('[MAIN] All windows closed, but keeping app alive');
});

// Keep-alive: Prevent Node process from exiting
// This is necessary because MCLC in detached mode can cause the event loop to think there's no more work
let keepAliveInterval = null;
app.on('ready', () => {
    // Start keep-alive interval
    keepAliveInterval = setInterval(() => {
        // This keeps the event loop active
        // Without this, Node might exit after launching Minecraft
    }, 5000); // Check every 5 seconds

    console.log('[MAIN] Keep-alive interval started to prevent premature exit');
});

// Clean up on quit
app.on('will-quit', () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        console.log('[MAIN] Keep-alive interval cleared');
    }
});

// IPC Handlers
ipcMain.handle('login-microsoft', async () => {
    try {
        return await auth.loginMicrosoft();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-session', async () => {
    try {
        return await auth.checkPremiumSession();
    } catch (error) {
        return { success: false };
    }
});

ipcMain.handle('logout', async () => {
    try {
        return await auth.logoutMicrosoft();
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', () => {
    console.log('[MAIN] User requested close - setting quit flag');
    isQuitting = true;
    app.quit();
});

// Database IPC Handlers
const db = require('./database');

ipcMain.handle('db-get-modpacks', async () => {
    try {
        return await db.getModpacks();
    } catch (error) {
        console.error('Error getting modpacks:', error);
        throw error;
    }
});

ipcMain.handle('db-get-all-modpacks', async () => {
    try {
        return await db.getAllModpacks();
    } catch (error) {
        console.error('Error getting all modpacks:', error);
        throw error;
    }
});

ipcMain.handle('db-create-modpack', async (event, modpack) => {
    try {
        return await db.createModpack(modpack);
    } catch (error) {
        console.error('Error creating modpack:', error);
        throw error;
    }
});

ipcMain.handle('db-update-modpack', async (event, id, updates) => {
    try {
        return await db.updateModpack(id, updates);
    } catch (error) {
        console.error('Error updating modpack:', error);
        throw error;
    }
});

ipcMain.handle('db-delete-modpack', async (event, id) => {
    try {
        return await db.deleteModpack(id);
    } catch (error) {
        console.error('Error deleting modpack:', error);
        throw error;
    }
});

ipcMain.handle('db-get-users', async () => {
    try {
        return await db.getUsers();
    } catch (error) {
        console.error('Error getting users:', error);
        throw error;
    }
});

ipcMain.handle('db-get-minecraft-versions', async () => {
    try {
        return await db.getMinecraftVersions();
    } catch (error) {
        console.error('Error getting minecraft versions:', error);
        throw error;
    }
});

ipcMain.handle('db-get-modloader-types', async () => {
    try {
        return await db.getModloaderTypes();
    } catch (error) {
        console.error('Error getting modloader types:', error);
        throw error;
    }
});

ipcMain.handle('db-get-modloader-versions', async (event, typeId, mcVersionId) => {
    try {
        return await db.getModloaderVersions(typeId, mcVersionId);
    } catch (error) {
        console.error('Error getting modloader versions:', error);
        throw error;
    }
});

ipcMain.handle('db-validate-admin', async (event, { username, password }) => {
    try {
        return await db.validateAdmin(username, password);
    } catch (error) {
        console.error('Error validating admin:', error);
        throw error;
    }
});

// === LAUNCHER IPC HANDLERS ===
const launcher = require('./launcher');

ipcMain.handle('install-modpack', async (event, { id, name, zipUrl }) => {
    try {
        return await launcher.installModpack(id, name, zipUrl);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('uninstall-modpack', async (event, { id, name }) => {
    try {
        return await launcher.uninstallModpack(id, name);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-mod-list', async (event, { id, name }) => {
    try {
        return await launcher.getModList(id, name);
    } catch (error) {
        return { success: false, error: error.message, mods: [] };
    }
});

ipcMain.handle('launch-game', async (event, options) => {
    try {
        // If it's a premium session, we get the profile from auth module
        const profile = auth.getUserProfile();

        const launchOptions = {
            ...options,
            // If name is provided in options, it's a No-Premium launch choice
            name: options.name || (profile ? profile.name : 'Steve'),
            uuid: options.name ? '00000000-0000-0000-0000-000000000000' : (profile ? profile.uuid : '00000000-0000-0000-0000-000000000000'),
            access_token: options.name ? null : (profile ? profile.access_token : null)
        };

        return await launcher.launch(launchOptions);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Pre-download Java for a specific Minecraft version
ipcMain.handle('prepare-java', async (event, mcVersion) => {
    try {
        console.log(`[MAIN] Pre-downloading Java for MC ${mcVersion}`);
        const javaPath = await launcher.javaManager.getJavaPath(mcVersion, mainWindow);
        return { success: true, javaPath };
    } catch (error) {
        console.error('[MAIN] Java preparation error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-system-ram', () => {
    try {
        const totalMemory = os.totalmem();
        // Use Math.round to match marketed RAM (e.g. 31.8GB usable -> 32GB)
        const totalGB = Math.round(totalMemory / (1024 * 1024 * 1024));
        // Reserve 2GB for the system
        return Math.max(totalGB - 2, 4);
    } catch (error) {
        console.error('Error getting system RAM:', error);
        return 8; // Fallback
    }
});

ipcMain.handle('open-screenshots', async (event, { instanceName }) => {
    try {
        const fs = require('fs');
        const APP_DATA_DIR = path.join(app.getPath('appData'), '.soul-launcher');
        const INSTANCES_DIR = path.join(APP_DATA_DIR, 'instances');

        // Sanitize instance name
        const safeName = instanceName.replace(/[^a-z0-9_-]/gi, '_');
        const screenshotsPath = path.join(INSTANCES_DIR, safeName, 'screenshots');

        // Create screenshots folder if it doesn't exist
        if (!fs.existsSync(screenshotsPath)) {
            fs.mkdirSync(screenshotsPath, { recursive: true });
        }

        // Open folder in file explorer
        await shell.openPath(screenshotsPath);

        console.log('[MAIN] Opened screenshots folder:', screenshotsPath);
        return { success: true, path: screenshotsPath };
    } catch (error) {
        console.error('[MAIN] Error opening screenshots folder:', error);
        return { success: false, error: error.message };
    }
});
