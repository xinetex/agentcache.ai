import React from 'react';

const StatDial = ({ value, max = 100, label, sublabel, color = 'var(--hud-accent)' }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="8"
                        fill="transparent"
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="64"
                        cy="64"
                        r={radius}
                        stroke={color}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                    />
                </svg>

                {/* Center Value */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-['Rajdhani'] font-bold text-white">
                        {value}%
                    </span>
                </div>
            </div>

            {/* Labels */}
            <div className="text-center mt-2">
                <div className="text-sm font-bold text-white tracking-wide">{label}</div>
                {sublabel && <div className="text-xs text-[var(--hud-text-dim)]">{sublabel}</div>}
            </div>
        </div>
    );
};

export default StatDial;
