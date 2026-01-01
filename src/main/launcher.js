// Copyright (c) 2026 MrSoulx, Walter Gomez N. All rights reserved.
const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const AdmZip = require('adm-zip');

/**
 * Launcher Logic Module
 * Handles MCLC integration, Modpack installation, and Progress tracking.
 */

/**
 * Safe helper to send IPC messages without crashing if window is destroyed
 */
function safeSendProgress(window, type, data) {
    try {
        if (window && !window.isDestroyed()) {
            window.webContents.send('launcher-progress', { type, data });
        }
    } catch (error) {
        // Silently ignore
    }
}

class JavaManager {
    constructor(commonRoot) {
        this.runtimeRoot = path.join(commonRoot, 'runtimes');
        this.ensureDir(this.runtimeRoot);
    }

    async getJavaPath(mcVersion, window) {
        const version = this.getRequiredJavaVersion(mcVersion);
        const javaDir = path.join(this.runtimeRoot, `java-${version}`);

        // Find java.exe recursively as Adoptium zips have a subfolder
        const existingExe = this.findJavaRecursive(javaDir);
        if (existingExe) {
            console.log(`[JAVA] Java ${version} found at ${existingExe}`);
            safeSendProgress(window, 'log', { message: `Java ${version} detected on the system.`, type: 'info' });
            return existingExe;
        }

        safeSendProgress(window, 'log', { message: `Java ${version} not found. Starting automatic download...`, type: 'info' });
        console.log(`[JAVA] Java ${version} not found. Starting download...`);

        const downloadUrl = await this.getDownloadUrl(version);
        const tempZip = path.join(this.runtimeRoot, `java-${version}.zip`);

        // Download with progress
        const response = await axios({ method: 'get', url: downloadUrl, responseType: 'stream' });
        const totalLength = response.headers['content-length'];
        let downloadedLength = 0;

        const writer = fs.createWriteStream(tempZip);

        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            if (totalLength && window) {
                const percentage = Math.round((downloadedLength / totalLength) * 100);
                safeSendProgress(window, 'download', {
                    percentage,
                    type: 'java',
                    downloaded: (downloadedLength / (1024 * 1024)).toFixed(2),
                    total: (totalLength / (1024 * 1024)).toFixed(2)
                });
            }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Extract (async to prevent UI freeze)
        safeSendProgress(window, 'status', `Extracting Java ${version}...`);
        safeSendProgress(window, 'log', { message: `✓ Java ${version} download complete. Extracting...`, type: 'success' });

        // Use setImmediate to defer heavy extraction and prevent main thread block
        await new Promise((resolve, reject) => {
            setImmediate(() => {
                try {
                    const zip = new AdmZip(tempZip);
                    zip.extractAllTo(javaDir, true);

                    // Cleanup
                    fs.unlinkSync(tempZip);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });

        const exePath = this.findJavaRecursive(javaDir);
        if (exePath) {
            safeSendProgress(window, 'log', { message: `✓ Java ${version} installed successfully.`, type: 'success' });
        }
        return exePath;
    }

    getRequiredJavaVersion(mcVersion) {
        // Sanitize version string (e.g. "1.20.1-fabric" -> "1.20.1")
        const cleanVersion = mcVersion.split(' ')[0].split('-')[0];
        const v = cleanVersion.split('.').map(Number);

        console.log(`[JAVA] Detecting java for MC: ${cleanVersion} (Parsed as: ${v.join('.')})`);

        // MC 1.20.5+ needs Java 21
        if (v[0] === 1 && (v[1] > 20 || (v[1] === 20 && v[2] >= 5))) return 21;
        // MC 1.17 - 1.20.4 needs Java 17
        if (v[0] === 1 && v[1] >= 17) return 17;
        // MC <= 1.16.5 needs Java 8
        return 8;
    }

    async getDownloadUrl(version) {
        const api = `https://api.adoptium.net/v3/assets/feature_releases/${version}/ga?architecture=x64&image_type=jre&os=windows&vendor=eclipse`;
        const response = await axios.get(api);
        return response.data[0].binaries[0].package.link;
    }

    findJavaRecursive(dir) {
        if (!fs.existsSync(dir)) return null;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = this.findJavaRecursive(fullPath);
                if (found) return found;
            } else if (file === 'java.exe' && fullPath.includes('bin')) {
                return fullPath;
            }
        }
        return null;
    }

    ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

class ModloaderManager {
    constructor(commonRoot) {
        this.commonRoot = commonRoot;
        this.versionsDir = path.join(commonRoot, 'versions');
        this.ensureDir(this.versionsDir);
    }

    async prepareModloader(mcVersion, modloader, window) {
        if (!modloader || !modloader.type || modloader.type === 'none' || !modloader.version) return;

        const type = modloader.type.toLowerCase();
        const loaderVersion = modloader.version;
        const versionDir = path.join(this.versionsDir, loaderVersion);
        const expectedJson = path.join(versionDir, `${loaderVersion}.json`);

        if (fs.existsSync(expectedJson)) {
            console.log(`[MODLOADER] ${type} ${loaderVersion} already installed.`);
            return;
        }

        console.log(`[MODLOADER] Downloading ${type} ${loaderVersion}...`);
        if (window) window.webContents.send('launcher-progress', { type: 'status', data: `Installing ${type}...` });

        this.ensureDir(versionDir);

        if (type === 'fabric') {
            await this.installFabric(mcVersion, loaderVersion, expectedJson);
        } else if (type === 'forge') {
            // For Forge, we'll try to find if there's any JSON in the folder that we can rename
            // If the user already has the files but mismatched, our fix in Launcher.js will catch it.
            // But if they don't have it, we'd need a real Forge installer logic (complex).
            // For now, let's assume if it exists in DB, we should at least check for existing local files.
            this.checkExistingForge(versionDir, expectedJson, window);
        }
    }

    async installFabric(mcVersion, loaderVersion, targetJson) {
        const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
        const response = await axios.get(url);
        fs.writeFileSync(targetJson, JSON.stringify(response.data, null, 2));
        console.log(`[MODLOADER] Fabric ${loaderVersion} profile created.`);
    }

    checkExistingForge(versionDir, targetJson, window) {
        if (fs.existsSync(versionDir)) {
            const files = fs.readdirSync(versionDir);
            const altJson = files.find(f => f.endsWith('.json') && f !== path.basename(targetJson));
            if (altJson) {
                fs.copyFileSync(path.join(versionDir, altJson), targetJson);
                console.log(`[MODLOADER] Forge JSON corrected from ${altJson}`);
                safeSendProgress(window, 'log', { message: `Forge configuration file corrected (${altJson}).`, type: 'info' });
                return true;
            } else if (fs.existsSync(targetJson)) {
                return true;
            }
        }
        return false;
    }

    async downloadForgeInstaller(mcVersion, forgeVersion, instanceRoot, window) {
        const forgeFullVersion = `${mcVersion}-${forgeVersion}`;
        const installerName = `forge-${forgeFullVersion}-installer.jar`;
        const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeFullVersion}/${installerName}`;
        const localInstallerPath = path.join(instanceRoot, installerName);

        if (fs.existsSync(localInstallerPath)) {
            return localInstallerPath;
        }

        console.log(`[MODLOADER] Downloading Forge Installer: ${forgeVersion}`);
        safeSendProgress(window, 'log', { message: `Downloading Forge installer ${forgeVersion}...`, type: 'info' });

        try {
            const response = await axios({ method: 'get', url: installerUrl, responseType: 'stream' });
            const writer = fs.createWriteStream(localInstallerPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            return localInstallerPath;
        } catch (e) {
            console.error(`[MODLOADER] Failed to download Forge installer:`, e);
            return null;
        }
    }

    ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

class Launcher {
    constructor() {
        this.launcher = new Client();
        // Common root for assets, libraries, and versions (v1.17+ needs lots of libs)
        this.commonRoot = path.join(process.env.APPDATA, '.soul-launcher', 'minecraft');
        // Instances root for mods/config/saves
        this.instancesPath = path.join(process.env.APPDATA, '.soul-launcher', 'instances');

        this.ensureDir(this.commonRoot);
        this.ensureDir(this.instancesPath);

        this.javaManager = new JavaManager(this.commonRoot);
        this.modloaderManager = new ModloaderManager(this.commonRoot);
    }

    /**
     * Set up listeners for the MCLC client to report progress to the frontend.
     */
    init(window) {
        this.window = window;
        let lastProgressTime = 0;

        this.launcher.on('debug', (e) => {
            // console.log(`[MCLC-DEBUG] ${e}`);
        });

        this.launcher.on('data', (e) => {
            // console.log(`[MCLC-DATA] ${e}`);
        });

        this.launcher.on('progress', (e) => {
            const now = Date.now();
            if (now - lastProgressTime < 250) return; // Throttle to 4fps (very light)
            lastProgressTime = now;

            const percentage = Math.round((e.task / e.total) * 100);
            this.sendProgress('download', {
                task: e.task,
                total: e.total,
                percentage,
                type: e.type
            });
        });

        let lastStatusTime = 0;
        this.launcher.on('download-status', (e) => {
            const now = Date.now();
            if (now - lastStatusTime < 500) return; // Status changes max every 0.5s
            lastStatusTime = now;
            this.sendProgress('status', e);
        });

        this.launcher.on('error', (e) => {
            console.error(`[MCLC-ERROR] ${e}`);
            this.sendProgress('log', { message: e, type: 'error' });
        });

        this.launcher.on('close', (e) => {
            console.log(`[MCLC-CLOSE] Exit code: ${e}`);
            this.sendProgress('log', { message: `Game closed with code: ${e}`, type: 'info' });
        });
    }

    /**
     * Helper to send events to the renderer.
     */
    sendProgress(type, data) {
        try {
            if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.send('launcher-progress', { type, data });
            }
        } catch (error) {
            // Silently ignore if window is destroyed
            console.log('[LAUNCHER] Could not send progress, window may be closed');
        }
    }

    /**
     * Helper to ensure a directory exists.
     */
    ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    /**
     * Sanitizes a string to be used as a safe folder name.
     */
    sanitizeName(name) {
        return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    /**
     * Downloads and installs a modpack ZIP.
     */
    async installModpack(modpackId, modpackName, zipUrl) {
        if (!zipUrl) {
            throw new Error("Modpack does not have a valid download URL.");
        }

        const safeName = this.sanitizeName(modpackName);
        console.log(`[LAUNCHER] Installing modpack: ${modpackName} (${modpackId}) from ${zipUrl}`);
        const instanceDir = path.join(this.instancesPath, safeName);
        const tempZipPath = path.join(this.commonRoot, `temp_${modpackId}.zip`);

        try {
            this.ensureDir(instanceDir);

            // Cleanup existing mods and config folders for a clean update/reinstall
            const modsPath = path.join(instanceDir, 'mods');
            const configPath = path.join(instanceDir, 'config');

            if (fs.existsSync(modsPath)) {
                console.log(`[LAUNCHER] Cleaning existing mods folder...`);
                fs.rmSync(modsPath, { recursive: true, force: true });
            }
            if (fs.existsSync(configPath)) {
                console.log(`[LAUNCHER] Cleaning existing config folder...`);
                fs.rmSync(configPath, { recursive: true, force: true });
            }

            this.sendProgress('status', `Starting ZIP download...`);

            // 1. Download ZIP with progress tracking
            const response = await axios({
                method: 'get',
                url: zipUrl,
                responseType: 'stream'
            });

            const totalLength = response.headers['content-length'];
            let downloadedLength = 0;
            let lastLoggedPercentage = -1; // Track last logged percentage

            // Send initial log message
            this.sendProgress('log', { message: 'Starting modpack download...', type: 'info' });

            const writer = fs.createWriteStream(tempZipPath);

            response.data.on('data', (chunk) => {
                downloadedLength += chunk.length;
                if (totalLength) {
                    const percentage = Math.round((downloadedLength / totalLength) * 100);

                    // Only update progress bar, don't spam logs
                    this.sendProgress('download', {
                        percentage,
                        type: 'modpack',
                        downloaded: (downloadedLength / (1024 * 1024)).toFixed(2),
                        total: (totalLength / (1024 * 1024)).toFixed(2)
                    });

                    // Only log every 10% to avoid spam
                    if (percentage % 10 === 0 && percentage !== lastLoggedPercentage) {
                        const barLength = 20;
                        const filledLength = Math.round((percentage / 100) * barLength);
                        const bar = '='.repeat(filledLength) + ' '.repeat(barLength - filledLength);
                        const downloadedMB = (downloadedLength / (1024 * 1024)).toFixed(2);
                        const totalMB = (totalLength / (1024 * 1024)).toFixed(2);

                        this.sendProgress('log', {
                            message: `Downloading: [${bar}] ${percentage}% (${downloadedMB}/${totalMB} MB)`,
                            type: 'info'
                        });
                        lastLoggedPercentage = percentage;
                    }
                }
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Log completion
            this.sendProgress('log', { message: '✓ Download complete. Extracting files...', type: 'success' });

            // 2. Extract ZIP
            this.sendProgress('status', `Extracting modpack files...`);
            const zip = new AdmZip(tempZipPath);
            zip.extractAllTo(instanceDir, true);

            // 3. Flatten structure if needed (Legacy logic)
            this.flattenInstanceFolder(instanceDir);

            // 4. Move global assets (versions, libraries) if they exist in the ZIP
            this.relocateGlobalAssets(instanceDir);

            // 5. Cleanup
            if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);

            console.log(`[LAUNCHER] Modpack installed at: ${instanceDir}`);
            this.sendProgress('log', { message: `Modpack installed successfully at ${instanceDir}`, type: 'success' });
            return { success: true, path: instanceDir };

        } catch (error) {
            console.error(`[LAUNCHER] Installation error:`, error);
            this.sendProgress('log', { message: `Installation error: ${error.message}`, type: 'error' });
            if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
            return { success: false, error: error.message };
        }
    }

    /**
     * Scans the extracted modpack for global assets (versions, libraries) and moves them.
     */
    relocateGlobalAssets(instanceDir) {
        const foldersToMove = ['versions', 'libraries'];
        foldersToMove.forEach(folderName => {
            const src = path.join(instanceDir, folderName);
            const dest = path.join(this.commonRoot, folderName);

            if (fs.existsSync(src)) {
                console.log(`[LAUNCHER] Found global asset folder: ${folderName}. Moving to common root...`);
                this.ensureDir(dest);

                // Move contents recursively
                const moveContents = (s, d) => {
                    const files = fs.readdirSync(s);
                    files.forEach(file => {
                        const curSrc = path.join(s, file);
                        const curDest = path.join(d, file);
                        if (fs.statSync(curSrc).isDirectory()) {
                            this.ensureDir(curDest);
                            moveContents(curSrc, curDest);
                        } else {
                            if (!fs.existsSync(curDest)) {
                                fs.copyFileSync(curSrc, curDest);
                            }
                        }
                    });
                };

                moveContents(src, dest);
                // Libraries are safer moved (1.17+ packs often have them)
                this.sendProgress('log', { message: `Synchronized global assets (${folderName}).`, type: 'info' });
            }
        });
    }

    /**
     * Flatten instance folder if it contains only one subfolder (Legacy logic from Copia).
     */
    flattenInstanceFolder(instanceDir) {
        try {
            const items = fs.readdirSync(instanceDir).filter(item => !item.startsWith('temp_') && item !== 'instance.json');
            if (items.length === 1) {
                const nestedPath = path.join(instanceDir, items[0]);
                if (fs.statSync(nestedPath).isDirectory()) {
                    console.log(`[LAUNCHER] Flattening nested folder: ${items[0]}`);
                    const nestedItems = fs.readdirSync(nestedPath);
                    nestedItems.forEach(item => {
                        const src = path.join(nestedPath, item);
                        const dest = path.join(instanceDir, item);
                        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
                        fs.renameSync(src, dest);
                    });
                    fs.rmdirSync(nestedPath);
                    this.sendProgress('log', { message: `Folder structure optimized.`, type: 'info' });
                }
            }
        } catch (e) {
            console.error(`[LAUNCHER] Error flattening folder:`, e);
        }
    }

    /**
     * Launches the game using MCLC.
     */
    async launch(options) {
        const {
            name,
            uuid,
            access_token,
            version,
            modloader,
            instanceId,
            instanceName,
            memory = { max: '4G', min: '2G' }
        } = options;

        if (!version) throw new Error("No Minecraft version specified.");

        const safeName = this.sanitizeName(instanceName || instanceId.toString());
        console.log(`[LAUNCHER] ========== LAUNCH DEBUG ==========`);
        console.log(`[LAUNCHER] Launching ${version} for ${name} at ${safeName}`);
        console.log(`[LAUNCHER] Modloader config:`, JSON.stringify(modloader, null, 2));

        const gameDirectory = path.join(this.instancesPath, safeName);

        // Manage Java version
        let javaPath = null;
        try {
            javaPath = await this.javaManager.getJavaPath(version, this.window);
            console.log(`[LAUNCHER] Java path resolved: ${javaPath}`);
        } catch (e) {
            console.error("[JAVA] Error managing java:", e);
            this.sendProgress('log', { message: `Error managing Java: ${e.message}`, type: 'error' });
        }

        // Manage Modloader
        let forgeInstallerPath = null;
        try {
            if (modloader && modloader.type && modloader.type !== 'none' && modloader.version) {
                this.sendProgress('status', `Preparing ${modloader.type} ${modloader.version}...`);
                console.log(`[LAUNCHER] Processing modloader: ${modloader.type} version ${modloader.version}`);

                if (modloader.type.toLowerCase() === 'forge') {
                    // Download Forge installer to instance directory (like legacy launcher)
                    const forgeFullVersion = `${version}-${modloader.version}`;
                    const installerName = `forge-${forgeFullVersion}-installer.jar`;
                    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeFullVersion}/${installerName}`;
                    const localInstallerPath = path.join(gameDirectory, installerName);

                    console.log(`[LAUNCHER] Forge installer path: ${localInstallerPath}`);
                    console.log(`[LAUNCHER] Forge installer exists: ${fs.existsSync(localInstallerPath)}`);

                    if (!fs.existsSync(localInstallerPath)) {
                        console.log(`[LAUNCHER] Downloading Forge installer from: ${installerUrl}`);
                        this.sendProgress('log', { message: `Downloading Forge installer ${modloader.version}...`, type: 'info' });

                        try {
                            const response = await axios({ method: 'get', url: installerUrl, responseType: 'stream' });
                            const writer = fs.createWriteStream(localInstallerPath);
                            response.data.pipe(writer);

                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });

                            console.log(`[LAUNCHER] Forge installer downloaded successfully`);
                        } catch (downloadError) {
                            console.error(`[LAUNCHER] Failed to download Forge installer:`, downloadError);
                            throw new Error(`Could not download Forge installer: ${downloadError.message}`);
                        }
                    } else {
                        console.log(`[LAUNCHER] Using existing Forge installer`);
                    }

                    forgeInstallerPath = localInstallerPath;
                } else {
                    await this.modloaderManager.prepareModloader(version, modloader, this.window);
                }
            } else {
                console.log(`[LAUNCHER] No modloader configured or invalid modloader data`);
            }
        } catch (e) {
            console.error("[MODLOADER] Error managing modloader:", e);
            this.sendProgress('log', { message: `Error managing Modloader: ${e.message}`, type: 'error' });
        }

        const auth = {
            access_token,
            client_token: null,
            uuid,
            name,
            user_properties: '{}'
        };

        const launchOptions = {
            clientPackage: null,
            authorization: auth,
            root: this.commonRoot, // Core Minecraft files (assets, libraries, versions) are here
            javaPath: javaPath,
            version: {
                number: version,
                type: 'release'
            },
            memory: {
                max: memory.max || '4G',
                min: memory.min || '2G'
            },
            overrides: {
                gameDirectory: gameDirectory, // MODS, CONFIGS, SAVES are here (Isolated instance)
                detached: true // FORCE TRUE to prevent main process block
            }
        };

        // Add Aikar's Flags if enabled
        if (options.aikarFlags) {
            console.log('[LAUNCHER] Applying Aikar\'s Flags optimization...');
            launchOptions.customArgs = [
                "-XX:+UseG1GC",
                "-XX:+ParallelRefProcEnabled",
                "-XX:MaxGCPauseMillis=200",
                "-XX:+UnlockExperimentalVMOptions",
                "-XX:+DisableExplicitGC",
                "-XX:+AlwaysPreTouch",
                "-XX:G1NewSizePercent=30",
                "-XX:G1MaxNewSizePercent=40",
                "-XX:G1HeapRegionSize=8M",
                "-XX:G1ReservePercent=20",
                "-XX:G1HeapWastePercent=5",
                "-XX:G1MixedGCCountTarget=4",
                "-XX:InitiatingHeapOccupancyPercent=15",
                "-XX:G1MixedGCLiveThresholdPercent=90",
                "-XX:G1RSetUpdatingPauseTimePercent=5",
                "-XX:SurvivorRatio=32",
                "-XX:+PerfDisableSharedMem",
                "-XX:MaxTenuringThreshold=1"
            ];
        }

        console.log(`[LAUNCHER] ========== DIRECTORY PATHS ==========`);
        console.log(`[LAUNCHER] Instance directory (root): ${gameDirectory}`);
        console.log(`[LAUNCHER] Mods folder: ${path.join(gameDirectory, 'mods')}`);
        console.log(`[LAUNCHER] Mods folder exists: ${fs.existsSync(path.join(gameDirectory, 'mods'))}`);

        // Count mods in folder
        try {
            const modsDir = path.join(gameDirectory, 'mods');
            if (fs.existsSync(modsDir)) {
                const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
                console.log(`[LAUNCHER] Number of mods found: ${modFiles.length}`);
                if (modFiles.length > 0) {
                    console.log(`[LAUNCHER] First 5 mods: ${modFiles.slice(0, 5).join(', ')}`);
                }
            }
        } catch (e) {
            console.error(`[LAUNCHER] Error reading mods folder:`, e);
        }

        // Add Forge installer path if available (like legacy launcher)
        if (forgeInstallerPath) {
            launchOptions.forge = forgeInstallerPath;
            console.log(`[LAUNCHER] Launching with Forge installer: ${forgeInstallerPath}`);
            this.sendProgress('log', { message: `Using Forge ${modloader.version}`, type: 'info' });
        } else if (modloader && modloader.version && modloader.version !== 'none') {
            const type = modloader.type || 'custom';
            launchOptions.version.custom = modloader.version;
            console.log(`[LAUNCHER] Using modloader: ${type} version ${modloader.version}`);
            this.sendProgress('log', { message: `Using modloader: ${type} (${modloader.version})`, type: 'info' });
        } else {
            console.log(`[LAUNCHER] Launching Vanilla Minecraft version ${version}`);
            this.sendProgress('log', { message: `Launching Vanilla Minecraft ${version}`, type: 'info' });
        }

        try {
            this.sendProgress('status', 'Starting game...');
            console.log(`[LAUNCHER] Final launch options:`, JSON.stringify(launchOptions, null, 2));

            // Use process.nextTick to defer the heavy MCLC launch operation
            // This prevents UI freeze while maintaining the process reference
            process.nextTick(() => {
                try {
                    this.launcher.launch(launchOptions);
                    console.log(`[LAUNCHER] MCLC launch process initiated successfully`);
                } catch (launchError) {
                    console.error(`[LAUNCHER] MCLC launch error:`, launchError);
                    this.sendProgress('log', { message: `Error starting Minecraft: ${launchError.message}`, type: 'error' });
                }
            });

            // Return immediately to keep UI responsive
            this.sendProgress('log', { message: '✓ Starting Minecraft...', type: 'success' });
            console.log(`[LAUNCHER] Launch initiated, returning control to UI`);

            return { success: true };
        } catch (error) {
            console.error(`[LAUNCHER] Launch error:`, error);
            this.sendProgress('log', { message: `Error launching the game: ${error.message}`, type: 'error' });
            return { success: false, error: error.message };
        }
    }

    /**
     * Uninstalls a modpack by deleting its instance folder.
     */
    async uninstallModpack(id, name) {
        const safeName = this.sanitizeName(name || id.toString());
        const instanceDir = path.join(this.instancesPath, safeName);

        console.log(`[LAUNCHER] Uninstalling modpack: ${name} (${id}) at ${instanceDir}`);

        try {
            if (fs.existsSync(instanceDir)) {
                // Recursive deletion of the folder
                fs.rmSync(instanceDir, { recursive: true, force: true });
                console.log(`[LAUNCHER] Instance folder deleted: ${instanceDir}`);
            }
            return { success: true };
        } catch (error) {
            console.error(`[LAUNCHER] Uninstallation error:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Scans the instance's mods folder and returns a list of jar files.
     */
    async getModList(id, name) {
        const safeName = this.sanitizeName(name || id.toString());
        const modsDir = path.join(this.instancesPath, safeName, 'mods');

        try {
            if (fs.existsSync(modsDir)) {
                const files = fs.readdirSync(modsDir);
                // Filter only .jar files and map to their names
                const mods = files
                    .filter(file => file.toLowerCase().endsWith('.jar'))
                    .map(file => {
                        // Clean name (remove extension and common suffixes if desired)
                        return file;
                    })
                    .sort((a, b) => a.localeCompare(b));

                return { success: true, mods };
            }
            return { success: true, mods: [] };
        } catch (error) {
            console.error(`[LAUNCHER] Error reading mod list:`, error);
            return { success: false, error: error.message, mods: [] };
        }
    }
}

module.exports = new Launcher();
