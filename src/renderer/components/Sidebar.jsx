import React from 'react';

function Sidebar({ currentPage, onPageChange, user, isAdminLoggedIn, onProfileClick }) {
    const navItems = [
        { id: 'home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', title: 'Home' },
        { id: 'config', icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z', title: 'Settings' },
        { id: 'console', icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z', title: 'Console' },
        { id: 'admin', icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', title: 'Admin' }
    ].filter(item => item.id !== 'admin' || isAdminLoggedIn);

    return (
        <div className="sidebar">
            <div className="sidebar-logo">
                <img src="./assets/App-icon.png" alt="Logo" className="logo-image" />
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                        onClick={() => onPageChange(item.id)}
                        title={item.title}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d={item.icon} />
                        </svg>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button
                    className="nav-item"
                    title={user ? user.name : 'Profile'}
                    onClick={onProfileClick}
                >
                    {user ? (
                        <img
                            src={user.avatar}
                            alt="Avatar"
                            style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #333' }}
                        />
                    ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}

export default Sidebar;
