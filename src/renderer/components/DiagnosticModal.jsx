import React from 'react';

function DiagnosticModal({ html, onClose }) {
    if (!html) return null;

    return (
        <div className="diagnostic-overlay">
            <div className="diagnostic-modal">
                <div className="diagnostic-modal-header">
                    <span>Diagnostic Result</span>
                    <button className="diagnostic-close" onClick={onClose}>&times;</button>
                </div>
                <div className="diagnostic-modal-content">
                    <iframe
                        title="Diagnostic Report"
                        srcDoc={html}
                        className="diagnostic-iframe"
                    />
                </div>
            </div>

            <style jsx="true">{`
                .diagnostic-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }

                .diagnostic-modal {
                    width: 90%;
                    max-width: 1000px;
                    height: 85vh;
                    background: #1a1a2e;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 87, 87, 0.3);
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 0 50px rgba(255, 87, 87, 0.1);
                    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    overflow: hidden;
                }

                .diagnostic-modal-header {
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #16162a;
                }

                .diagnostic-modal-header span {
                    font-weight: 700;
                    color: #fff;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .diagnostic-close {
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    opacity: 0.5;
                    transition: opacity 0.2s;
                }

                .diagnostic-close:hover {
                    opacity: 1;
                    color: #ff5757;
                }

                .diagnostic-modal-content {
                    flex: 1;
                    overflow: hidden;
                }

                .diagnostic-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export default DiagnosticModal;
