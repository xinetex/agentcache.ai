import React, { useState, useEffect } from 'react';
import {
    Users, Shield, Activity, Database, Server,
    Search, Filter, Trash2, Key, UserCheck,
    AlertTriangle, RefreshCw
} from 'lucide-react';
import CyberCard from '../components/CyberCard';

export default function Admin() {
    // State for data
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeSessions: 0,
        systemHealth: 'OPTIMAL',
        dbLatency: '12ms'
    });

    // Real Data Loader
    const fetchData = async () => {
        setLoading(true);

        try {
            // Fetch Stats independently
            fetch('/api/admin/stats')
                .then(res => res.json())
                .then(statsData => {
                    if (statsData && !statsData.error) {
                        setStats({
                            totalUsers: statsData.total_users || 0,
                            activeSessions: statsData.active_sessions || 0,
                            systemHealth: statsData.system_health || 'OPTIMAL',
                            dbLatency: statsData.db_latency || '14ms'
                        });
                    }
                })
                .catch(e => console.error("Stats fetch error:", e));

            // Fetch Users independently
            const usersRes = await fetch('/api/admin/users');
            if (usersRes.ok) {
                const usersData = await usersRes.json();
                if (usersData && usersData.users) {
                    setUsers(usersData.users);
                }
            }
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Vitals */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <CyberCard className="border-l-4 border-l-[var(--hud-accent)]">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">Total Operators</div>
                            <div className="text-2xl font-bold font-mono text-white">{stats.totalUsers}</div>
                        </div>
                        <Users size={16} className="text-[var(--hud-accent)]" />
                    </div>
                </CyberCard>
                <CyberCard className="border-l-4 border-l-green-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">System Health</div>
                            <div className="text-2xl font-bold font-mono text-green-500">{stats.systemHealth}</div>
                        </div>
                        <Activity size={16} className="text-green-500" />
                    </div>
                </CyberCard>
                <CyberCard className="border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">DB Latency</div>
                            <div className="text-2xl font-bold font-mono text-blue-500">{stats.dbLatency}</div>
                        </div>
                        <Database size={16} className="text-blue-500" />
                    </div>
                </CyberCard>
                <CyberCard className="border-l-4 border-l-yellow-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-[var(--hud-text-dim)] font-mono uppercase">Active Nodes</div>
                            <div className="text-2xl font-bold font-mono text-yellow-500">{stats.activeSessions}</div>
                        </div>
                        <Server size={16} className="text-yellow-500" />
                    </div>
                </CyberCard>
            </div>

            {/* User Grid */}
            <CyberCard
                title="OPERATOR REGISTRY"
                icon={Shield}
                className="min-h-[500px]"
            >
                {/* Toolbar */}
                <div className="flex justify-between mb-4 gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-[var(--hud-text-dim)] w-4 h-4" />
                        <input
                            type="text"
                            placeholder="SEARCH OPERATORS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-[var(--hud-border)] rounded pl-9 p-2 text-sm text-white focus:border-[var(--hud-accent)] focus:outline-none font-mono"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 border border-[var(--hud-border)] rounded hover:bg-[var(--hud-accent)] hover:text-black transition-colors">
                            <Filter size={16} />
                        </button>
                        <button onClick={fetchData} className="p-2 border border-[var(--hud-border)] rounded hover:bg-[var(--hud-accent)] hover:text-black transition-colors">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--hud-border)] text-[10px] text-[var(--hud-text-dim)] font-mono uppercase tracking-wider">
                                <th className="p-3">Identity</th>
                                <th className="p-3">Role</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Last Active</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-[var(--hud-text-dim)]">
                                        SCANNING DATABASE...
                                    </td>
                                </tr>
                            ) : filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-[var(--hud-border)]/50 hover:bg-[var(--hud-accent)]/5 transition-colors group">
                                    <td className="p-3">
                                        <div className="font-bold text-white">{user.name}</div>
                                        <div className="text-xs text-[var(--hud-text-dim)]">{user.email}</div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase border ${user.role === 'admin'
                                            ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                                            : 'border-[var(--hud-border)] text-[var(--hud-text-dim)]'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className={`flex items-center gap-2 ${user.status === 'active' ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                                                }`}></span>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-[var(--hud-text-dim)]">{user.lastActive}</td>
                                    <td className="p-3 text-right flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <button title="Impersonate" className="p-1.5 hover:text-[var(--hud-accent)] transition-colors"><Key size={14} /></button>
                                        <button title="Edit" className="p-1.5 hover:text-yellow-400 transition-colors"><UserCheck size={14} /></button>
                                        <button title="Suspend" className="p-1.5 hover:text-red-500 transition-colors"><AlertTriangle size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CyberCard>
        </div>
    );
}
