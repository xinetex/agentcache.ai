import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage on mount
        const storedToken = localStorage.getItem('agentcache_token');
        const storedUser = localStorage.getItem('agentcache_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const endpoint = password ? '/api/auth/login' : '/api/auth/dev-login';
            const preferredOrganizationId = localStorage.getItem('agentcache_active_organization_id');
            const body = password
                ? { email, password, ...(preferredOrganizationId ? { organizationId: preferredOrganizationId } : {}) }
                : { email };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Login failed');
            }

            const data = await res.json();
            setToken(data.token);
            setUser(data.user);

            localStorage.setItem('agentcache_token', data.token);
            localStorage.setItem('agentcache_user', JSON.stringify(data.user));
            if (data.user.orgId) localStorage.setItem('agentcache_active_organization_id', data.user.orgId);
            return { success: true, user: data.user };
        } catch (err) {
            console.error(err);
            return { success: false, error: err.message || 'Login failed' };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('agentcache_token');
        localStorage.removeItem('agentcache_user');
    };

    const setSession = (session) => {
        if (!session?.token || !session?.user) return;
        setToken(session.token);
        setUser(session.user);
        localStorage.setItem('agentcache_token', session.token);
        localStorage.setItem('agentcache_user', JSON.stringify(session.user));
        if (session.user.orgId) localStorage.setItem('agentcache_active_organization_id', session.user.orgId);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, setSession, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
