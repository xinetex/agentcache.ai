import React from 'react';

const CyberCard = ({ title, children, className = '', icon: Icon, action = null }) => {
    return (
        <div className={`relative group bg-[var(--hud-panel-bg)] border border-[var(--hud-border)] rounded-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,243,255,0.1)] hover:border-[var(--hud-accent)] ${className}`}>

            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--hud-accent)] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[var(--hud-accent)] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[var(--hud-accent)] opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--hud-accent)] opacity-50 group-hover:opacity-100 transition-opacity"></div>

            {/* Header */}
            {(title || Icon) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--hud-border)] bg-[rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-3">
                        {Icon && <Icon size={18} className="text-[var(--hud-accent)]" />}
                        <h3 className="font-['Rajdhani'] font-bold text-lg tracking-wider text-white uppercase">
                            <span className="text-[var(--hud-accent)] mr-2">::</span>
                            {title}
                        </h3>
                    </div>
                    {action && (
                        <div className="text-sm">
                            {action}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};

export default CyberCard;
