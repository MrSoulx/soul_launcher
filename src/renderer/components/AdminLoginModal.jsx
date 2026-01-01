// Copyright (c) 2026 MrSoulx, Walter Gomez N. All rights reserved.
import React, { useState } from 'react';

function AdminLoginModal({ onClose, onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const result = await window.electronAPI.validateAdmin(username, password);

            if (result.success) {
                onLogin(true);
            } else {
                setError(result.error || 'Incorrect username or password');
            }
        } catch (err) {
            setError('Error verifying credentials');
            console.error(err);
        }
    };

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                    ADMIN ACCESS
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>USERNAME</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>PASSWORD</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" className="btn btn-primary btn-block">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                        LOGIN
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AdminLoginModal;
