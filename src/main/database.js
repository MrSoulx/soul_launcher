require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// === CONFIGURATION ===
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Unified response handler to keep things modular and clean.
 * It logs the action and handles errors in a humanized way.
 */
async function handleQuery(actionName, queryPromise) {
    const { data, error } = await queryPromise;

    if (error) {
        console.error(`[DB-ERROR] ${actionName}:`, error.message);
        throw new Error(`Error: ${error.message}`);
    }

    return data;
}

// === MODPACKS ===

async function getVisibleModpacks() {
    return handleQuery('List visible modpacks',
        supabase
            .from('modpacks')
            .select(`
                *,
                minecraft_versions (version),
                modloader_types (name),
                modloader_versions (version)
            `)
            .eq('is_visible', true)
            .order('created_at', { ascending: false })
    );
}

/**
 * Fetches all modpacks (including hidden ones) for the admin panel.
 */
async function getAllModpacks() {
    return handleQuery('List all modpacks (Admin)',
        supabase
            .from('modpacks')
            .select(`
                *,
                minecraft_versions (version),
                modloader_types (name),
                modloader_versions (version)
            `)
            .order('created_at', { ascending: false })
    );
}

/**
 * Fetches a single modpack by ID with its full details.
 */
async function getModpackById(id) {
    const data = await handleQuery(`Fetch modpack ID ${id}`,
        supabase
            .from('modpacks')
            .select(`
                *,
                minecraft_versions (version),
                modloader_types (name),
                modloader_versions (version)
            `)
            .eq('id', id)
    );
    return data && data.length > 0 ? data[0] : null;
}

async function createModpack(modpackData) {
    const data = await handleQuery('Create new modpack',
        supabase
            .from('modpacks')
            .insert([modpackData])
            .select()
    );
    return data[0];
}

/**
 * Updates an existing modpack.
 */
async function updateModpack(id, updates) {
    const data = await handleQuery(`Update modpack ID ${id}`,
        supabase
            .from('modpacks')
            .update(updates)
            .eq('id', id)
            .select()
    );
    return data[0];
}

/**
 * Removes a modpack from the database.
 */
async function deleteModpack(id) {
    await handleQuery(`Delete modpack ID ${id}`,
        supabase
            .from('modpacks')
            .delete()
            .eq('id', id)
    );
    return { success: true };
}

// === VERSIONS & TYPES ===

/**
 * Gets all available Minecraft versions.
 */
async function getMinecraftVersions() {
    return handleQuery('Fetch Minecraft versions',
        supabase
            .from('minecraft_versions')
            .select('*')
            .order('version', { ascending: false })
    );
}

/**
 * Gets modloader types (Forge, Fabric, Quilt).
 */
async function getModloaderTypes() {
    return handleQuery('Fetch modloader types',
        supabase
            .from('modloader_types')
            .select('*')
    );
}

/**
 * Gets modloader versions, optionally filtered by type and MC version.
 */
async function getModloaderVersions(typeId = null, mcVersionId = null) {
    let query = supabase.from('modloader_versions').select('*');

    if (typeId) query = query.eq('type_id', typeId);
    if (mcVersionId) query = query.eq('mc_version_id', mcVersionId);

    return handleQuery(`Filter modloader versions (Type: ${typeId}, MC: ${mcVersionId})`,
        query.order('version', { ascending: false })
    );
}

// === USERS (ADMIN) ===

/**
 * Validates admin credentials directly against the database.
 */
async function validateAdmin(username, password) {
    console.log(`[DB] Validating admin: ${username}...`);
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error) {
        console.error(`[DB-ERROR] Admin validation failed:`, error.message);
        return { success: false, error: 'Invalid credentials or connection error' };
    }

    return { success: true, user: data };
}

// === EXPORTS ===

module.exports = {
    supabase,
    getModpacks: getVisibleModpacks,
    getAllModpacks,
    getModpackById,
    createModpack,
    updateModpack,
    deleteModpack,
    // Versions
    getMinecraftVersions,
    getModloaderTypes,
    getModloaderVersions,
    // Users
    validateAdmin
};
