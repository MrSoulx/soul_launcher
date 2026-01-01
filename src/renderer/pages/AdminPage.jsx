import React, { useState, useEffect } from 'react';
import ModpackFormModal from '../components/ModpackFormModal';

function AdminPage({ onLogout }) {
    const [modpacks, setModpacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingModpack, setEditingModpack] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState({ show: false, title: '', message: '', onConfirm: null });

    useEffect(() => {
        loadModpacks();
    }, []);

    const loadModpacks = async () => {
        try {
            setLoading(true);
            const data = await window.electronAPI.getAllModpacks();
            setModpacks(data);
        } catch (error) {
            console.error('Error loading modpacks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingModpack(null);
        setShowModal(true);
    };

    const handleEdit = (modpack) => {
        setEditingModpack(modpack);
        setShowModal(true);
    };

    const handleSave = async (modpackData) => {
        setConfirmConfig({
            show: true,
            title: editingModpack ? 'Save Changes?' : 'Create Modpack?',
            message: editingModpack
                ? `Are you sure you want to save the changes made to "${modpackData.name}"?`
                : `Do you want to create the new modpack "${modpackData.name}" in the catalog?`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, show: false }));
                try {
                    if (editingModpack) {
                        await window.electronAPI.updateModpack(editingModpack.id, modpackData);
                    } else {
                        await window.electronAPI.createModpack(modpackData);
                    }
                    loadModpacks();
                    setShowModal(false);
                } catch (error) {
                    console.error('Error saving modpack:', error);
                    alert('Error saving modpack');
                }
            }
        });
    };

    const handleDelete = async (id) => {
        const modpack = modpacks.find(m => m.id === id);
        setConfirmConfig({
            show: true,
            title: 'Delete Modpack?',
            message: `Are you sure you want to permanently delete the modpack "${modpack?.name || 'this modpack'}" from the catalog? This action cannot be undone.`,
            onConfirm: async () => {
                setConfirmConfig(prev => ({ ...prev, show: false }));
                try {
                    await window.electronAPI.deleteModpack(id);
                    loadModpacks();
                } catch (error) {
                    console.error('Error deleting modpack:', error);
                    alert('Error deleting modpack');
                }
            }
        });
    };

    const toggleVisibility = async (id, currentVisibility) => {
        try {
            await window.electronAPI.updateModpack(id, { is_visible: !currentVisibility });
            loadModpacks();
        } catch (error) {
            console.error('Error updating modpack:', error);
        }
    };

    return (
        <div className="page active">
            <div className="admin-header">
                <h1>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                    Administrative Panel
                </h1>
                <div className="admin-actions">
                    <button className="btn btn-danger" onClick={onLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                        </svg>
                        LOGOUT
                    </button>
                    <button className="btn btn-primary" onClick={handleCreate}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        NEW MODPACK
                    </button>
                </div>
            </div>

            <div className="admin-content">
                <div className="section-header">
                    <h2>Modpack Management</h2>
                    <span className="total-count">Total: {modpacks.length}</span>
                </div>

                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <div className="modpack-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Version</th>
                                    <th>Modloader</th>
                                    <th>Visible</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {modpacks.map(modpack => (
                                    <tr key={modpack.id}>
                                        <td>
                                            <div className="modpack-name">
                                                <img
                                                    src={modpack.image_url || './assets/default_pack.png'}
                                                    alt={modpack.name}
                                                    className="modpack-thumb"
                                                />
                                                <div>
                                                    <strong>{modpack.name}</strong>
                                                    <p className="modpack-desc">{modpack.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{modpack.minecraft_versions?.version || 'N/A'}</td>
                                        <td>
                                            <span className="modloader-badge">
                                                {modpack.modloader_types?.name} ({modpack.modloader_versions?.version})
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`visibility-btn ${modpack.is_visible ? 'visible' : ''}`}
                                                onClick={() => toggleVisibility(modpack.id, modpack.is_visible)}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                    {modpack.is_visible ? (
                                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                                    ) : (
                                                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                                                    )}
                                                </svg>
                                            </button>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn btn-edit" onClick={handleEdit(modpack)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                    </svg>
                                                    EDIT
                                                </button>
                                                <button className="btn btn-delete" onClick={() => handleDelete(modpack.id)}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <ModpackFormModal
                    modpack={editingModpack}
                    onClose={() => setShowModal(false)}
                    onSave={handleSave}
                />
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
                                className={`btn ${confirmConfig.title.includes('Delete') ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => confirmConfig.onConfirm?.()}
                            >
                                CONFIRM
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPage;
