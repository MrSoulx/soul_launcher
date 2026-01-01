// Copyright (c) 2026 MrSoulx (Walter Gomez N.). All rights reserved.
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ConfigPage from './pages/ConfigPage';
import AdminPage from './pages/AdminPage';
import ConsolePage from './pages/ConsolePage';
import AdminLoginModal from './components/AdminLoginModal';
import DiagnosticModal from './components/DiagnosticModal';

function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [logs, setLogs] = useState([
        { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), type: 'info', message: 'Initializing Soul Launcher...', icon: '>' }
    ]);
    const [status, setStatus] = useState('Waiting...');
    const [progress, setProgress] = useState(0);
    const [diagnosticHtml, setDiagnosticHtml] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        // Check for existing session on load
        checkSession();

        // Global IPC listeners for logs
        const removeListener = window.electronAPI?.onLauncherProgress?.((p) => {
            if (p.type === 'status') {
                addLog(p.data, 'info');
                setStatus(p.data);
            } else if (p.type === 'log') {
                addLog(p.data.message, p.data.type || 'info');
                if (p.data.type === 'success' || p.data.type === 'error') {
                    // Reset progress after success or error if it's a "terminal" log
                    if (p.data.type === 'error') setStatus('Process error');
                    setProgress(0);
                }
            } else if (p.type === 'download') {
                setProgress(p.data.percentage || 0);
            }
        });

        // Set global addLog
        window.addLog = addLog;

        return () => {
            if (removeListener) removeListener();
            delete window.addLog;
        };
    }, []);

    const addLog = (message, type = 'info', icon = null) => {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => {
            const newLogs = [...prev, { time, type, message, icon }];
            // Keep last 1000 logs - increased to prevent buffer overflow crashes
            return newLogs.slice(-1000);
        });
    };

    const clearLogs = () => setLogs([]);

    const checkSession = async () => {
        try {
            const result = await window.electronAPI.checkSession();
            if (result.success) {
                setUser(result);
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    };

    const handlePageChange = (page) => {
        if (page === 'admin' && !isAdminLoggedIn) {
            setShowAdminModal(true);
        } else {
            setCurrentPage(page);
        }
    };

    const handleAdminLogin = (success) => {
        if (success) {
            setIsAdminLoggedIn(true);
            setShowAdminModal(false);
            setCurrentPage('admin');
        }
    };

    const handleAdminLogout = () => {
        setIsAdminLoggedIn(false);
        setCurrentPage('home');
    };

    const handleMicrosoftLogin = async () => {
        try {
            const result = await window.electronAPI.loginMicrosoft();
            if (result.success) {
                setUser(result);
            } else {
                alert(result.error || 'Login error');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Error logging in with Microsoft');
        }
    };

    const handleLogout = async () => {
        try {
            await window.electronAPI.logout();
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        setStatus('Running system test...');
        try {
            const result = await window.electronAPI.generateReport();
            if (result.success) {
                setDiagnosticHtml(result.html);
            } else {
                addLog(`Error generating report: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Report generating error:', error);
            addLog('Fatal error generating diagnostic', 'error');
        } finally {
            setIsGeneratingReport(false);
            setStatus('Waiting...');
        }
    };

    const handleProfileClick = () => {
        if (!isAdminLoggedIn) {
            setShowAdminModal(true);
        }
    };

    return (
        <div className="app">
            <TitleBar />

            <div className="main-container">
                <Sidebar
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    user={user}
                    isAdminLoggedIn={isAdminLoggedIn}
                    onProfileClick={handleProfileClick}
                />

                <div className="content">
                    {currentPage === 'home' && <HomePage />}
                    {currentPage === 'config' && (
                        <ConfigPage
                            user={user}
                            onLogin={handleMicrosoftLogin}
                            onLogout={handleLogout}
                        />
                    )}
                    {currentPage === 'console' && (
                        <ConsolePage
                            logs={logs}
                            onClear={clearLogs}
                            isAdmin={isAdminLoggedIn}
                            onRunDiagnostic={handleGenerateReport}
                            isGenerating={isGeneratingReport}
                        />
                    )}
                    {currentPage === 'admin' && isAdminLoggedIn && (
                        <AdminPage onLogout={handleAdminLogout} />
                    )}
                </div>
            </div>

            <Footer status={status} progress={progress} />

            {showAdminModal && (
                <AdminLoginModal
                    onClose={() => setShowAdminModal(false)}
                    onLogin={handleAdminLogin}
                />
            )}

            {diagnosticHtml && (
                <DiagnosticModal
                    html={diagnosticHtml}
                    onClose={() => setDiagnosticHtml(null)}
                />
            )}
        </div>
    );
}

export default App;
