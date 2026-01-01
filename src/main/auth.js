const fs = require('fs');
// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
const { app, shell } = require('electron');

/**
 * Authentication Module - Working code from Electron-Launcher
 * Uses msmc v3.1.1 which works perfectly with Electron
 */

let cachedUserProfile = null;
let isChecking = false; // Prevent concurrent session checks

// Session cache to prevent excessive API calls
let cachedSession = null;
let cacheExpiry = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function init(config) {
    this.SESSION_FILE = config.sessionFile;
    this.APP_DATA_DIR = config.appDataDir;
}

async function loginMicrosoft() {
    console.log('[AUTH] Starting Microsoft login process...');

    try {
        console.log('[AUTH] Loading msmc module...');
        const msmc = require('msmc');
        console.log('[AUTH] msmc module loaded successfully');

        // msmc v3.x uses fastLaunch() function
        console.log('[AUTH] Launching Microsoft authentication...');
        const result = await msmc.fastLaunch("electron");
        console.log('[AUTH] Authentication completed, result type:', result.type);

        // Check for errors
        if (msmc.errorCheck(result)) {
            console.error('[AUTH] result has error:', result);
            throw new Error(result.reason || 'Authentication failed');
        }

        // STRICT OWNERSHIP CHECK
        if (!result.profile || !result.profile._msmc || !result.profile._msmc.mcToken) {
            throw new Error("No se encontró una licencia de Minecraft válida en esta cuenta.");
        }

        if (result.profile._msmc.demo) {
            throw new Error("Esta cuenta es DEMO. Debes comprar Minecraft Java Edition para jugar.");
        }

        console.log('[AUTH] Converting to MCLC format...');
        const mclcModule = msmc.getMCLC();
        const mcProfile = mclcModule.getAuth(result);
        console.log('[AUTH] Profile converted:', mcProfile.name);

        // Convert to MCLC-compatible profile format
        cachedUserProfile = {
            access_token: mcProfile.access_token,
            client_token: mcProfile.client_token,
            uuid: mcProfile.uuid,
            name: mcProfile.name,
            user_properties: mcProfile.user_properties
        };

        // Save session for persistence
        try {
            ensureDirectory(this.APP_DATA_DIR);
            console.log('[AUTH] Saving session to:', this.SESSION_FILE);
            fs.writeFileSync(this.SESSION_FILE, JSON.stringify(result.profile));
            console.log('[AUTH] Session saved successfully');
        } catch (e) {
            console.error('[AUTH] Failed to save session:', e);
        }

        console.log('[AUTH] Login successful for:', mcProfile.name);

        // Construct avatar URL
        const avatarUrl = `https://minotar.net/helm/${mcProfile.uuid}/100.png`;

        return {
            success: true,
            name: mcProfile.name,
            uuid: mcProfile.uuid,
            avatar: avatarUrl
        };

    } catch (e) {
        console.error("[AUTH] Microsoft Login Error:", e);
        console.error("[AUTH] Error stack:", e.stack);
        const msg = e.message || String(e);
        return { success: false, error: msg };
    }
}

async function checkPremiumSession() {
    // Return cached session if still valid
    const now = Date.now();
    if (cachedSession && now < cacheExpiry) {
        console.log('[SESSION] Returning cached session (valid for', Math.floor((cacheExpiry - now) / 1000), 'more seconds)');
        return cachedSession;
    }

    if (isChecking) return { success: false }; // Prevent concurrent checks

    console.log('[SESSION] Checking for session file at:', this.SESSION_FILE);
    if (!fs.existsSync(this.SESSION_FILE)) {
        console.log('[SESSION] No session file found at:', this.SESSION_FILE);
        return { success: false };
    }

    isChecking = true;
    try {
        const savedProfile = JSON.parse(fs.readFileSync(this.SESSION_FILE, 'utf8'));
        const msmc = require('msmc');

        console.log('[SESSION] Checking saved session...');

        // Refresh the session
        let refreshResult;
        try {
            refreshResult = await msmc.refresh(savedProfile);
        } catch (refreshError) {
            // Handle cases where Microsoft returns HTML instead of JSON
            console.error('[SESSION] Refresh request failed:', refreshError.message);

            // Clear cache on error
            cachedSession = null;
            cacheExpiry = 0;

            // If it's a JSON parse error, Microsoft is likely returning an error page
            if (refreshError.message.includes('JSON') || refreshError.message.includes('DOCTYPE')) {
                console.error('[SESSION] Microsoft API returned HTML instead of JSON - session likely expired or rate limited');
                throw new Error('Session expired - please login again');
            }

            throw refreshError;
        }

        // Check for errors
        if (msmc.errorCheck(refreshResult)) {
            console.error('[SESSION] Session refresh failed object:', refreshResult);
            console.error('[SESSION] Session refresh failed reason:', refreshResult.reason);

            // Clear cache on error
            cachedSession = null;
            cacheExpiry = 0;

            // Check if it's a rate limit error (429)
            const isRateLimited = refreshResult.data &&
                refreshResult.data.status === 429;

            if (isRateLimited) {
                console.warn('[SESSION] Rate limited (429) - keeping session file');
                throw new Error('Rate limited - please wait a moment and try again');
            }

            throw new Error('Session expired');
        }

        // STRICT OWNERSHIP CHECK
        if (!refreshResult.profile || !refreshResult.profile._msmc || !refreshResult.profile._msmc.mcToken) {
            throw new Error("No se encontró una licencia de Minecraft válida en esta cuenta.");
        }
        if (refreshResult.profile._msmc.demo) {
            throw new Error("Esta cuenta es DEMO. Debes comprar Minecraft Java Edition para jugar.");
        }

        console.log('[SESSION] Session refreshed successfully');
        // Token logging removed for security
        console.log('[SESSION] Session restored for:', refreshResult.profile.name);

        // Convert to MCLC format
        const mclcModule = msmc.getMCLC();
        const mcProfile = mclcModule.getAuth(refreshResult);

        // Update cached profile
        cachedUserProfile = {
            access_token: mcProfile.access_token,
            client_token: mcProfile.client_token,
            uuid: mcProfile.uuid,
            name: mcProfile.name,
            user_properties: mcProfile.user_properties
        };

        // Update saved session
        fs.writeFileSync(this.SESSION_FILE, JSON.stringify(refreshResult.profile));

        // Construct avatar URL
        const avatarUrl = `https://minotar.net/helm/${mcProfile.uuid}/100.png`;

        // Cache the successful result
        const result = {
            success: true,
            name: mcProfile.name,
            uuid: mcProfile.uuid,
            avatar: avatarUrl
        };

        cachedSession = result;
        cacheExpiry = Date.now() + CACHE_DURATION;
        console.log('[SESSION] Session cached for', CACHE_DURATION / 1000, 'seconds');

        return result;
    } catch (e) {
        console.error('[SESSION] Session check failed:', e);

        // Clear cache on error
        cachedSession = null;
        cacheExpiry = 0;

        // Only delete session file if it's truly expired, not if rate limited
        const isRateLimited = e.message && (
            e.message.includes('429') ||
            e.message.includes('Too Many Requests') ||
            e.message.includes('rate limit') ||
            e.message.includes('Rate limited')
        );

        if (isRateLimited) {
            console.warn('[SESSION] Rate limited by Microsoft - keeping session file, will retry later');
            // Don't delete the session file - it might still be valid
            return { success: false, error: 'Rate limited - please wait a moment and try again' };
        }

        // Only delete session file if it's actually expired or invalid
        if (fs.existsSync(this.SESSION_FILE)) {
            console.log('[SESSION] Deleting invalid/expired session file');
            fs.unlinkSync(this.SESSION_FILE);
        }

        return { success: false, error: e.message };
    } finally {
        isChecking = false;
    }
}

async function logoutMicrosoft() {
    cachedUserProfile = null;
    try {
        if (fs.existsSync(this.SESSION_FILE)) {
            fs.unlinkSync(this.SESSION_FILE);
        }
    } catch (e) { }
    return { success: true };
}

function getUserProfile() {
    return cachedUserProfile;
}

function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

module.exports = {
    init,
    loginMicrosoft,
    checkPremiumSession,
    logoutMicrosoft,
    getUserProfile
};
