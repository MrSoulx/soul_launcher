import React, { useState, useEffect } from 'react';

function ConfigPage({ user, onLogin, onLogout }) {
    const [aikarFlags, setAikarFlags] = useState(false);
    const [accountType, setAccountType] = useState('premium');
    const [ramAmount, setRamAmount] = useState(4);
    const [maxRam, setMaxRam] = useState(16);
    const [username, setUsername] = useState('');

    useEffect(() => {
        const fetchSystemRam = async () => {
            try {
                const ram = await window.electronAPI.getSystemRam();
                setMaxRam(ram || 16);

                // Load saved settings from localStorage
                const savedRam = localStorage.getItem('ramAmount');
                if (savedRam) {
                    const parsedRam = parseInt(savedRam);
                    setRamAmount(Math.min(parsedRam, ram));
                }

                const savedAccountType = localStorage.getItem('accountType');
                if (savedAccountType) setAccountType(savedAccountType);

                const savedUsername = localStorage.getItem('noPremiumUsername');
                if (savedUsername) setUsername(savedUsername);

                const savedAikarFlags = localStorage.getItem('aikarFlags') === 'true';
                setAikarFlags(savedAikarFlags);
            } catch (error) {
                console.error('Failed to get initialization data:', error);
            }
        };
        fetchSystemRam();
    }, []);

    const handleAikarFlagsChange = (enabled) => {
        setAikarFlags(enabled);
        localStorage.setItem('aikarFlags', enabled.toString());
    };

    const handleRamChange = (value) => {
        setRamAmount(value);
        localStorage.setItem('ramAmount', value.toString());
    };

    const handleAccountTypeChange = (type) => {
        setAccountType(type);
        localStorage.setItem('accountType', type);
    };

    const handleUsernameChange = (value) => {
        setUsername(value);
        localStorage.setItem('noPremiumUsername', value);
    };

    return (
        <div className="page active">
            <div className="page-title">
                <h1>Settings</h1>
            </div>

            <div className="config-section">
                <div className="config-header">
                    <div>
                        <h3>RAM OPTIMIZATION (AIKAR'S FLAGS)</h3>
                        <p className="config-description">
                            Maintains stable FPS and reduces lag spikes when playing on servers.
                        </p>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={aikarFlags}
                            onChange={(e) => handleAikarFlagsChange(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div className="config-section">
                <h3>LAUNCHER / ACCOUNT TYPE</h3>
                <div className="account-types">
                    <div
                        className={`account-card ${accountType === 'no-premium' ? 'active' : ''}`}
                        onClick={() => handleAccountTypeChange('no-premium')}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                            <path d="M15.5 8c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5.67 1.5 1.5 1.5 1.5-.67 1.5-1.5zm-5 0c0-.83-.67-1.5-1.5-1.5S7.5 7.17 7.5 8s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5z" />
                        </svg>
                        <h4>No Premium</h4>
                    </div>
                    <div
                        className={`account-card ${accountType === 'premium' ? 'active' : ''}`}
                        onClick={() => handleAccountTypeChange('premium')}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                        </svg>
                        <h4>Premium</h4>
                    </div>
                </div>
            </div>

            {accountType === 'no-premium' ? (
                <div className="config-section">
                    <h3>USERNAME</h3>
                    <input
                        type="text"
                        className="username-input"
                        placeholder="Steve"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        maxLength={16}
                    />
                    <p className="config-description">
                        This name will appear in-game (maximum 16 characters)
                    </p>
                </div>
            ) : (
                <div className="config-section">
                    <h3>MICROSOFT ACCOUNT</h3>
                    {!user ? (
                        <button className="microsoft-login-btn" onClick={onLogin}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                            </svg>
                            Login
                        </button>
                    ) : (
                        <div className="user-info">
                            <img src={user.avatar} alt="Avatar" className="user-avatar" />
                            <div className="user-details">
                                <span className="user-name">{user.name}</span>
                                <span className="user-uuid">{user.uuid}</span>
                            </div>
                            <button className="logout-btn" onClick={onLogout}>Logout</button>
                        </div>
                    )}
                </div>
            )}

            <div className="config-section">
                <h3>ALLOCATED RAM</h3>
                <div className="ram-slider-container">
                    <input
                        type="range"
                        min="2"
                        max={maxRam}
                        value={ramAmount}
                        step="1"
                        className="ram-slider"
                        onChange={(e) => handleRamChange(parseInt(e.target.value))}
                        style={{
                            background: `linear-gradient(to right, #ff4444 0%, #ff4444 ${((ramAmount - 2) / (maxRam - 2)) * 100}%, #2a2a3e ${((ramAmount - 2) / (maxRam - 2)) * 100}%)`
                        }}
                    />
                    <span className="ram-value">{ramAmount} GB</span>
                </div>
                <p className="config-description">
                    System reserves 2GB. Maximum available: {maxRam}GB
                </p>
            </div>
        </div>
    );
}

export default ConfigPage;
