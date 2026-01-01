// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
import React, { useState, useEffect } from 'react';

function HomePage() {
    const [activeTab, setActiveTab] = useState('installed');
    const [installedModpacks, setInstalledModpacks] = useState([]);
    const [availableModpacks, setAvailableModpacks] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedModpack, setSelectedModpack] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [installingId, setInstallingId] = useState(null);
    const [launchingId, setLaunchingId] = useState(null);
    const [progress, setProgress] = useState({ type: '', data: '' });
    const [modalOrigin, setModalOrigin] = useState('catalog'); // 'catalog' or 'library'
    const [confirmConfig, setConfirmConfig] = useState({ show: false, title: '', message: '', onConfirm: null });

    // Key Modal States
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [enteredKey, setEnteredKey] = useState('');
    const [keyError, setKeyError] = useState('');
    const [pendingInstallMp, setPendingInstallMp] = useState(null);

    // Modal Tab States
    const [modalTab, setModalTab] = useState('description'); // 'description' or 'mods'
    const [modlist, setModlist] = useState([]);
    const [loadingMods, setLoadingMods] = useState(false);

    useEffect(() => {
        if (!window.electronAPI) {
            console.error('electronAPI is not available. Ensure the preload script is loaded correctly.');
            return;
        }
        loadModpacks();
        loadInstalledModpacks();

        // Listen for launcher progress
        const removeListener = window.electronAPI?.onLauncherProgress?.((p) => {
            setProgress(p);
        });

        return () => {
            if (typeof removeListener === 'function') {
                removeListener();
            }
        };
    }, []);

    const loadInstalledModpacks = () => {
        const installed = JSON.parse(localStorage.getItem('installedModpacks') || '[]');
        setInstalledModpacks(installed);
    };

    const loadModpacks = async () => {
        try {
            const modpacks = await window.electronAPI.getModpacks();
            setAvailableModpacks(modpacks);
        } catch (error) {
            console.error('Error loading modpacks:', error);
        }
    };

    const filteredModpacks = availableModpacks.filter(modpack =>
        modpack.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleModpackClick = async (modpack, origin = 'catalog') => {
        setModalOrigin(origin);
        setSelectedModpack(modpack);
        setModalTab('description');
        setModlist([]);
        setShowModal(true);

        // Pre-download Java in background to prevent UI freeze during launch
        if (modpack.minecraft_version) {
            try {
                console.log(`[HOMEPAGE] Pre-downloading Java for ${modpack.minecraft_version}`);
                await window.electronAPI.prepareJava(modpack.minecraft_version);
                console.log(`[HOMEPAGE] Java ready for ${modpack.minecraft_version}`);
            } catch (error) {
                console.error('[HOMEPAGE] Java pre-download failed:', error);
                // Non-critical - will download during launch if needed
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedModpack(null);
    };

    const isInstalled = (modpackId) => {
        return installedModpacks.some(mp => mp.id === modpackId);
    };

    const needsUpdate = (modpack) => {
        const installed = installedModpacks.find(mp => mp.id === modpack.id);
        if (!installed) return false;
        return installed.download_url !== modpack.download_url;
    };

    const fetchMods = async () => {
        if (!selectedModpack) return;
        setLoadingMods(true);
        try {
            const result = await window.electronAPI.getModList({
                id: selectedModpack.id,
                name: selectedModpack.name
            });
            if (result.success) {
                setModlist(result.mods || []);
            }
        } catch (error) {
            console.error('Error fetching mods:', error);
        } finally {
            setLoadingMods(false);
        }
    };

    const handleInstall = async (modpackToInstall) => {
        const mp = modpackToInstall || selectedModpack;
        if (!mp) return;

        // CHECK FOR DOWNLOAD KEY
        // If it has a key and it's not a dummy value
        const hasKey = mp.download_key &&
            mp.download_key.trim() !== '' &&
            mp.download_key.toUpperCase() !== 'NULL' &&
            mp.download_key.toUpperCase() !== 'EMPTY';

        if (hasKey && !showKeyModal) {
            setPendingInstallMp(mp);
            setShowKeyModal(true);
            setEnteredKey('');
            setKeyError('');
            return;
        }

        setInstallingId(mp.id);
        if (window.addLog) {
            window.addLog(`Starting ${needsUpdate(mp) ? 'update' : 'installation'} of ${mp.name}...`, 'info', '>');
        }

        try {
            const result = await window.electronAPI.installModpack({
                id: mp.id,
                name: mp.name,
                zipUrl: mp.download_url
            });

            if (result.success) {
                // Update installed list (replace if already exists)
                let newInstalled;
                const existingIndex = installedModpacks.findIndex(m => m.id === mp.id);

                if (existingIndex !== -1) {
                    newInstalled = [...installedModpacks];
                    newInstalled[existingIndex] = mp;
                } else {
                    newInstalled = [...installedModpacks, mp];
                }

                setInstalledModpacks(newInstalled);
                localStorage.setItem('installedModpacks', JSON.stringify(newInstalled));

                if (window.addLog) {
                    window.addLog(`${mp.name} ${existingIndex !== -1 ? 'updated' : 'installed'} successfully.`, 'success', '✓');
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            if (window.addLog) {
                window.addLog(`Error installing ${mp.name}: ${error.message}`, 'error', '✕');
            }
        } finally {
            setInstallingId(null);
            handleCloseModal();
        }
    };

    const handleKeySubmit = (e) => {
        e.preventDefault();
        if (enteredKey.trim() === pendingInstallMp.download_key) {
            const mp = pendingInstallMp;
            setShowKeyModal(false);
            setPendingInstallMp(null);
            handleInstall(mp); // Re-trigger install
        } else {
            setKeyError('The entered key is incorrect.');
        }
    };

    const handlePlay = async (modpack) => {
        const mp = modpack || selectedModpack;
        if (!mp) return;

        setLaunchingId(mp.id);
        if (window.addLog) {
            window.addLog(`Preparing launch for ${mp.name}...`, 'info', '>');
        }

        try {
            console.log('[FRONTEND] ========== PLAY DEBUG ==========');
            console.log('[FRONTEND] Selected modpack:', mp);
            console.log('[FRONTEND] Minecraft version:', mp.minecraft_versions?.version);
            console.log('[FRONTEND] Modloader type:', mp.modloader_types?.name);
            console.log('[FRONTEND] Modloader version:', mp.modloader_versions?.version);

            // Get Account settings
            const accountType = localStorage.getItem('accountType') || 'premium';
            const noPremiumUsername = localStorage.getItem('noPremiumUsername');

            // VALIDATION
            if (accountType === 'no-premium') {
                if (!noPremiumUsername || noPremiumUsername.trim() === '') {
                    alert('You must enter a username in the settings to play in No-Premium mode.');
                    setLaunchingId(null);
                    return;
                }
            } else {
                // Premium validation
                const session = await window.electronAPI.checkSession();
                if (!session.success) {
                    alert('You must login with a Microsoft account in settings to play in Premium mode.');
                    setLaunchingId(null);
                    return;
                }
            }

            // Get RAM setting from localStorage
            const savedRam = localStorage.getItem('ramAmount');
            const ramAmount = savedRam ? parseInt(savedRam) : 4; // Default 4GB

            const launchOptions = {
                version: mp.minecraft_versions?.version,
                instanceId: mp.id,
                instanceName: mp.name,
                name: accountType === 'no-premium' ? noPremiumUsername : null,
                modloader: {
                    type: mp.modloader_types?.name?.toLowerCase(),
                    version: mp.modloader_versions?.version
                },
                memory: {
                    max: `${ramAmount}G`,
                    min: '2G'
                }
            };

            console.log('[FRONTEND] Launch options:', JSON.stringify(launchOptions, null, 2));

            const result = await window.electronAPI.launchGame(launchOptions);

            if (!result.success) {
                throw new Error(result.error);
            }
        } catch (error) {
            if (window.addLog) {
                window.addLog(`Error launching: ${error.message}`, 'error', '✕');
            }
        } finally {
            setLaunchingId(null);
            // Don't close modal automatically - let user close it manually
            // This prevents UI freeze caused by race condition with async launch
        }
    };

    const handleUninstall = async () => {
        if (!selectedModpack) return;

        setConfirmConfig({
            show: true,
            title: 'Confirm Uninstallation?',
            message: `Are you sure you want to delete "${selectedModpack.name}"? This action will permanently delete all its files.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, show: false }));
                if (window.addLog) {
                    window.addLog(`Uninstalling ${selectedModpack.name}...`, 'warning', '!');
                    window.addLog(`Deleting local files...`, 'info');
                }

                try {
                    const result = await window.electronAPI.uninstallModpack({
                        id: selectedModpack.id,
                        name: selectedModpack.name
                    });

                    if (result.success) {
                        const newInstalled = installedModpacks.filter(mp => mp.id !== selectedModpack.id);
                        setInstalledModpacks(newInstalled);
                        localStorage.setItem('installedModpacks', JSON.stringify(newInstalled));

                        if (window.addLog) {
                            window.addLog(`${selectedModpack.name} has been successfully uninstalled.`, 'info');
                        }
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    if (window.addLog) {
                        window.addLog(`Error deleting files: ${error.message}`, 'error', '✕');
                    }
                }

                handleCloseModal();
            }
        });
    };

    const handleRepair = async () => {
        if (!selectedModpack) return;

        setConfirmConfig({
            show: true,
            title: 'Repair Modpack?',
            message: `Are you sure you want to repair "${selectedModpack.name}"? All local files will be deleted and redownloaded to ensure a clean installation.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, show: false }));
                if (window.addLog) {
                    window.addLog(`Starting repair of ${selectedModpack.name}...`, 'warning', '!');
                    window.addLog(`Deleting instance files for deep cleanup...`, 'info');
                }

                try {
                    // Use uninstall logic but don't close modal, then re-install
                    const result = await window.electronAPI.uninstallModpack({
                        id: selectedModpack.id,
                        name: selectedModpack.name
                    });

                    if (result.success) {
                        // Update local state briefly
                        const newInstalled = installedModpacks.filter(mp => mp.id !== selectedModpack.id);
                        setInstalledModpacks(newInstalled);

                        // Trigger fresh install
                        await handleInstall();
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    if (window.addLog) {
                        window.addLog(`Error during repair: ${error.message}`, 'error', '✕');
                    }
                }
            }
        });
    };

    const handleScreenshots = async () => {
        if (!selectedModpack) return;

        try {
            const result = await window.electronAPI.openScreenshots(selectedModpack.name);
            if (result.success) {
                if (window.addLog) {
                    window.addLog(`Screenshots folder opened: ${selectedModpack.name}`, 'success', '✓');
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            if (window.addLog) {
                window.addLog(`Error opening screenshots: ${error.message}`, 'error', '✕');
            }
        }
    };

    return (
        <div className="page active">
            <div className="page-header">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'installed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('installed')}
                    >
                        Library
                    </button>
                    <button
                        className={`tab ${activeTab === 'available' ? 'active' : ''}`}
                        onClick={() => setActiveTab('available')}
                    >
                        Modpacks
                    </button>
                </div>
                <button className="refresh-btn" onClick={loadModpacks} title="Refresh">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                    </svg>
                </button>
                <div className="search-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search modpack..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="tab-content">
                {activeTab === 'installed' ? (
                    <div className="tab-pane active">
                        {installedModpacks.length === 0 ? (
                            <div className="empty-state">
                                <p>You don't have any modpacks installed yet</p>
                            </div>
                        ) : (
                            <div className="modpacks-grid">
                                {installedModpacks.map(modpack => {
                                    const latest = availableModpacks.find(am => am.id === modpack.id);
                                    const hasUpdate = latest && latest.download_url !== modpack.download_url;

                                    return (
                                        <div
                                            key={modpack.id}
                                            className={`modpack-card installed ${hasUpdate ? 'has-update' : ''}`}
                                            onClick={() => handleModpackClick(latest || modpack, 'library')}
                                        >
                                            <div className="installed-badge">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                </svg>
                                                {hasUpdate ? 'Update Available' : 'Installed'}
                                            </div>
                                            <img src={modpack.image_url || './assets/default_pack.png'} alt={modpack.name} />
                                            <div className="modpack-card-content">
                                                <h3>{modpack.name}</h3>
                                                <p>{modpack.description}</p>
                                                <div className="modpack-info">
                                                    <span>MC {modpack.minecraft_versions?.version || '...'}</span>
                                                    <span>{modpack.modloader_types?.name || 'Vanilla'}</span>
                                                </div>
                                            </div>
                                            <div className="modpack-hover-overlay">
                                                <button className="btn btn-select" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleModpackClick(latest || modpack, 'library');
                                                }}>
                                                    DETAILS
                                                </button>

                                                {hasUpdate ? (
                                                    <button
                                                        className="btn btn-warning"
                                                        disabled={installingId === modpack.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInstall(latest);
                                                        }}
                                                    >
                                                        {installingId === modpack.id ? 'UPDATING...' : 'UPDATE'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn btn-play"
                                                        disabled={launchingId === modpack.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlay(modpack);
                                                        }}
                                                    >
                                                        {launchingId === modpack.id ? 'LAUNCHING...' : 'PLAY'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="tab-pane active">
                        <div className="modpacks-grid">
                            {filteredModpacks.map(modpack => {
                                const isMpInstalled = isInstalled(modpack.id);
                                return (
                                    <div key={modpack.id} className="modpack-card" onClick={() => handleModpackClick(modpack, 'catalog')}>
                                        <img src={modpack.image_url || './assets/default_pack.png'} alt={modpack.name} />
                                        {(modpack.download_key && modpack.download_key.trim() !== '' && modpack.download_key.toUpperCase() !== 'NULL' && modpack.download_key.toUpperCase() !== 'EMPTY') && (
                                            <div className="installed-badge" style={{ background: '#667eea', color: '#fff' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
                                                    <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                                                </svg>
                                                Requires Key
                                            </div>
                                        )}
                                        <div className="modpack-card-content">
                                            <h3>{modpack.name}</h3>
                                            <p>{modpack.description}</p>
                                            <div className="modpack-info">
                                                <span>MC {modpack.minecraft_versions?.version || '...'}</span>
                                                <span>{modpack.modloader_types?.name || 'Vanilla'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modpack Detail Modal */}
            {showModal && selectedModpack && (
                <div className="modal modpack-modal" onClick={handleCloseModal}>
                    <div className="modal-content modpack-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={handleCloseModal}>✕</button>

                        {/* Header with background image */}
                        <div
                            className="modpack-modal-header"
                            style={{ backgroundImage: `url(${selectedModpack.image_url || './assets/default_pack.png'})` }}
                        >
                            <div className="modpack-modal-header-overlay">
                                <h2>{selectedModpack.name}</h2>
                                <span className="version-badge">{selectedModpack.minecraft_versions?.version}</span>
                            </div>
                        </div>

                        {/* Sidebar with info */}
                        <div className="modpack-modal-body">
                            <div className="modpack-modal-sidebar">
                                <div className="info-item">
                                    <label>Minecraft</label>
                                    <span>{selectedModpack.minecraft_versions?.version}</span>
                                </div>
                                <div className="info-item">
                                    <label>{selectedModpack.modloader_types?.name}</label>
                                    <span>{selectedModpack.modloader_versions?.version}</span>
                                </div>
                                <div className="info-item">
                                    <label>Mods</label>
                                    <span>{modlist.length > 0 ? modlist.length : (isInstalled(selectedModpack.id) ? '...' : '0')}</span>
                                </div>

                                {modalOrigin === 'catalog' ? (
                                    <>
                                        {isInstalled(selectedModpack.id) ? (
                                            <button
                                                className="btn btn-primary btn-block"
                                                onClick={() => handleInstall()}
                                                disabled={installingId !== null}
                                            >
                                                {installingId === selectedModpack.id ? 'INSTALLING...' : (needsUpdate(selectedModpack) ? 'UPDATE' : 'REINSTALL')}
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-primary btn-block"
                                                onClick={() => handleInstall()}
                                                disabled={installingId !== null}
                                            >
                                                {installingId === selectedModpack.id ? 'INSTALLING...' : 'INSTALL'}
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Library Mode: Always show full panel */}
                                        <button
                                            className="btn btn-primary btn-block"
                                            onClick={() => needsUpdate(selectedModpack) ? handleInstall() : handlePlay()}
                                            disabled={installingId !== null || launchingId !== null}
                                        >
                                            {installingId === selectedModpack.id ? 'UPDATING...' :
                                                launchingId === selectedModpack.id ? 'LAUNCHING...' :
                                                    (needsUpdate(selectedModpack) ? 'UPDATE' : 'PLAY')}
                                        </button>

                                        <div className="modpack-actions">
                                            <button className="action-btn" onClick={handleRepair} disabled={installingId !== null}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                                                </svg>
                                                REPAIR
                                            </button>
                                            <button className="action-btn" onClick={handleScreenshots}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                                                </svg>
                                                SCREENSHOTS
                                            </button>
                                        </div>

                                        <button className="btn btn-danger btn-block" onClick={handleUninstall} disabled={installingId !== null}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                            </svg>
                                            UNINSTALL
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="modpack-modal-content-area">
                                <div className="tabs">
                                    <button
                                        className={`tab ${modalTab === 'description' ? 'active' : ''}`}
                                        onClick={() => setModalTab('description')}
                                    >
                                        Description
                                    </button>
                                    <button
                                        className={`tab ${modalTab === 'mods' ? 'active' : ''}`}
                                        onClick={() => {
                                            setModalTab('mods');
                                            fetchMods();
                                        }}
                                    >
                                        Mods {modlist.length > 0 ? `(${modlist.length})` : ''}
                                    </button>
                                </div>

                                {modalTab === 'description' ? (
                                    <div className="modpack-description">
                                        <p>{selectedModpack.description}</p>
                                    </div>
                                ) : (
                                    <div className="modpack-mods-list">
                                        {loadingMods ? (
                                            <div className="loading-spinner-container">
                                                <div className="spinner"></div>
                                                <p>Reading mods folder...</p>
                                            </div>
                                        ) : modlist.length === 0 ? (
                                            <div className="empty-state">
                                                <p>No mods found or the modpack is not installed.</p>
                                            </div>
                                        ) : (
                                            <div className="mods-grid-mini">
                                                {modlist.map((mod, i) => (
                                                    <div key={i} className="mod-item-mini">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
                                                        </svg>
                                                        <span>{mod}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal */}
            {confirmConfig.show && (
                <div className="modal confirm-modal" onClick={() => setConfirmConfig(prev => ({ ...prev, show: false }))}>
                    <div className="modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-modal-header">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#ff6b6b">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            <h3>{confirmConfig.title}</h3>
                        </div>
                        <div className="confirm-modal-body">
                            <p>{confirmConfig.message}</p>
                        </div>
                        <div className="confirm-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setConfirmConfig(prev => ({ ...prev, show: false }))}>
                                CANCEL
                            </button>
                            <button
                                className={`btn ${confirmConfig.title.includes('Delete') || confirmConfig.title.includes('Confirm Uninstallation') ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => confirmConfig.onConfirm?.()}
                            >
                                CONFIRM
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Key Entry Modal */}
            {showKeyModal && (
                <div className="modal confirm-modal" onClick={() => setShowKeyModal(false)}>
                    <div className="modal-content confirm-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-modal-header">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="#667eea">
                                <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                            </svg>
                            <h3>License Key</h3>
                        </div>
                        <div className="confirm-modal-body">
                            <p>This modpack requires a license key to be installed.</p>
                            <form onSubmit={handleKeySubmit}>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        className="username-input"
                                        placeholder="Enter key here..."
                                        value={enteredKey}
                                        onChange={(e) => setEnteredKey(e.target.value)}
                                        required
                                        autoFocus
                                        style={{ width: '100%', marginTop: '10px', background: '#111', border: '1px solid #333' }}
                                    />
                                    {keyError && <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '8px' }}>{keyError}</p>}
                                </div>
                                <div className="confirm-modal-footer" style={{ marginTop: '20px' }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowKeyModal(false)}>
                                        CANCEL
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        VERIFY
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HomePage;
