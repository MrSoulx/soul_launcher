// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
import React, { useState, useEffect } from 'react';

function ModpackFormModal({ modpack, onClose, onSave }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image_url: '',
        minecraft_version_id: '',
        modloader_type_id: '',
        modloader_version_id: '',
        download_url: '',
        download_key: '',
        is_visible: true
    });

    const [versions, setVersions] = useState({
        minecraft: [],
        modloaderTypes: [],
        modloaderVersions: []
    });

    useEffect(() => {
        loadFormOptions();
        if (modpack) {
            setFormData({
                name: modpack.name || '',
                description: modpack.description || '',
                image_url: modpack.image_url || '',
                minecraft_version_id: modpack.minecraft_version_id || '',
                modloader_type_id: modpack.modloader_type_id || '',
                modloader_version_id: modpack.modloader_version_id || '',
                download_url: modpack.download_url || '',
                download_key: modpack.download_key || '',
                is_visible: modpack.is_visible ?? true
            });
        }
    }, [modpack]);

    const loadFormOptions = async () => {
        try {
            const mcVersions = await window.electronAPI.getMinecraftVersions();
            const modloaderTypes = await window.electronAPI.getModloaderTypes();
            const modloaderVersions = await window.electronAPI.getModloaderVersions();

            setVersions({
                minecraft: mcVersions,
                modloaderTypes: modloaderTypes,
                modloaderVersions: modloaderVersions
            });
        } catch (error) {
            console.error('Error loading form options:', error);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            };

            // Reset modloader version if MC version or loader type changes
            if (name === 'minecraft_version_id' || name === 'modloader_type_id') {
                newData.modloader_version_id = '';
            }

            return newData;
        });
    };

    return (
        <div className="modal admin-modal" onClick={onClose}>
            <div className="modal-content admin-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{modpack ? 'Edit Modpack' : 'New Modpack'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="admin-form">
                    <div className="form-group">
                        <label>Modpack Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. My Awesome Pack"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Describe the modpack..."
                            rows="3"
                            required
                        ></textarea>
                    </div>

                    <div className="form-group">
                        <label>Image URL (Banner)</label>
                        <input
                            type="text"
                            name="image_url"
                            value={formData.image_url}
                            onChange={handleChange}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Minecraft Version</label>
                            <select
                                name="minecraft_version_id"
                                value={formData.minecraft_version_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select...</option>
                                {versions.minecraft.map(v => (
                                    <option key={v.id} value={v.id}>{v.version}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Modloader Type</label>
                            <select
                                name="modloader_type_id"
                                value={formData.modloader_type_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select...</option>
                                {versions.modloaderTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Modloader Version</label>
                        <select
                            name="modloader_version_id"
                            value={formData.modloader_version_id}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select...</option>
                            {versions.modloaderVersions
                                .filter(v =>
                                    String(v.type_id) === String(formData.modloader_type_id) &&
                                    String(v.mc_version_id) === String(formData.minecraft_version_id)
                                )
                                .map(v => (
                                    <option key={v.id} value={v.id}>{v.version}</option>
                                ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Download URL (ZIP)</label>
                        <input
                            type="text"
                            name="download_url"
                            value={formData.download_url}
                            onChange={handleChange}
                            placeholder="https://example.com/modpack.zip"
                            required
                        />
                        {(formData.download_url.includes('mega.nz') || formData.download_url.includes('mediafire.com')) && (
                            <p className="url-warning" style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '4px' }}>
                                ⚠️ Mega or MediaFire links are not direct and will cause installation errors.
                                Use GitHub, Dropbox, or a direct download link.
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Download Key (Optional)</label>
                        <input
                            type="text"
                            name="download_key"
                            value={formData.download_key}
                            onChange={handleChange}
                            placeholder="e.g. ABC-123-XYZ (Leave empty if not required)"
                        />
                    </div>

                    <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="is_visible"
                                checked={formData.is_visible}
                                onChange={handleChange}
                            />
                            Visible in launcher
                        </label>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            CANCEL
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {modpack ? 'SAVE CHANGES' : 'CREATE MODPACK'}
                        </button>
                    </div>
                </form >
            </div >
        </div >
    );
}

export default ModpackFormModal;
