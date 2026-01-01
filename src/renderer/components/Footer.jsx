import React from 'react';

function Footer({ status, progress }) {
    return (
        <div className="footer">
            <div className="footer-progress-bar" style={{ width: `${progress}%` }}></div>
            <div className="footer-content">
                <span className="footer-status">
                    {status} {progress > 0 && `(${progress}%)`}
                </span>
                <span className="footer-credit">BYMRSOULX</span>
            </div>
        </div>
    );
}

export default Footer;
