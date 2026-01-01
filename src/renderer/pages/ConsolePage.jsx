// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
import React, { useState, useEffect, useRef } from 'react';

function ConsolePage({ logs = [], onClear, isAdmin = false, onRunDiagnostic, isGenerating = false }) {
    const consoleRef = useRef(null);

    useEffect(() => {
        // Auto-scroll to bottom when new logs are added
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [logs]);

    const handleClear = () => {
        if (onClear) onClear();
    };

    return (
        <div className="page active console-page">
            <div className="console-header">
                <h1>System Logs</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {isAdmin && (
                        <button
                            className="btn btn-primary"
                            onClick={onRunDiagnostic}
                            disabled={isGenerating}
                        >
                            {isGenerating ? 'Running Test...' : 'Run System Test'}
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={handleClear} disabled={isGenerating}>
                        Clear
                    </button>
                </div>
            </div>

            <div className="console-container" ref={consoleRef}>
                {logs.length === 0 ? (
                    <div className="console-empty">
                        <p>No logs to display</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`console-log console-log-${log.type}`}>
                            <span className="console-time">[{log.time}]</span>
                            {log.icon && <span className="console-icon">{log.icon}</span>}
                            <span className="console-message">{log.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ConsolePage;
