import React from 'react';

function TitleBar() {
    const handleMinimize = () => window.electronAPI.windowMinimize();
    const handleMaximize = () => window.electronAPI.windowMaximize();
    const handleClose = () => window.electronAPI.windowClose();

    return (
        <div className="titlebar">
            <div className="titlebar-drag">
                <img src="./assets/App-icon.png" alt="Logo" className="titlebar-logo-img" />
                <span className="titlebar-title">Soul Launcher</span>
            </div>
            <div className="titlebar-controls">
                <button className="titlebar-button" onClick={handleMinimize}>─</button>
                <button className="titlebar-button" onClick={handleMaximize}>□</button>
                <button className="titlebar-button close" onClick={handleClose}>✕</button>
            </div>
        </div>
    );
}

export default TitleBar;
