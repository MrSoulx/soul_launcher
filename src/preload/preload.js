// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication
    loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
    checkSession: () => ipcRenderer.invoke('check-session'),
    logout: () => ipcRenderer.invoke('logout'),

    // Window controls
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),

    // Database - Modpacks
    getModpacks: () => ipcRenderer.invoke('db-get-modpacks'),
    getAllModpacks: () => ipcRenderer.invoke('db-get-all-modpacks'),
    createModpack: (modpack) => ipcRenderer.invoke('db-create-modpack', modpack),
    updateModpack: (id, updates) => ipcRenderer.invoke('db-update-modpack', id, updates),
    deleteModpack: (id) => ipcRenderer.invoke('db-delete-modpack', id),

    // Database - Users
    getUsers: () => ipcRenderer.invoke('db-get-users'),
    validateAdmin: (username, password) => ipcRenderer.invoke('db-validate-admin', { username, password }),

    // Database - Versions
    getMinecraftVersions: () => ipcRenderer.invoke('db-get-minecraft-versions'),
    getModloaderTypes: () => ipcRenderer.invoke('db-get-modloader-types'),
    getModloaderVersions: (typeId, mcVersionId) => ipcRenderer.invoke('db-get-modloader-versions', typeId, mcVersionId),

    // Launcher Logic
    installModpack: (data) => ipcRenderer.invoke('install-modpack', data),
    uninstallModpack: (data) => ipcRenderer.invoke('uninstall-modpack', data),
    getModList: (data) => ipcRenderer.invoke('get-mod-list', data),
    launchGame: (options) => ipcRenderer.invoke('launch-game', options),
    prepareJava: (mcVersion) => ipcRenderer.invoke('prepare-java', mcVersion),
    openScreenshots: (instanceName) => ipcRenderer.invoke('open-screenshots', { instanceName }),
    generateReport: () => ipcRenderer.invoke('generate-report'),
    getSystemRam: () => ipcRenderer.invoke('get-system-ram'),
    onLauncherProgress: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('launcher-progress', subscription);
        return () => ipcRenderer.removeListener('launcher-progress', subscription);
    }
});
