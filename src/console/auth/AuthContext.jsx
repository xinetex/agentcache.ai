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

    const login = async (email) => {
        try {
            const res = await fetch('/api/auth/dev-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (!res.ok) throw new Error('Login failed');

            const data = await res.json();
            setToken(data.token);
            setUser(data.user);

            localStorage.setItem('agentcache_token', data.token);
            localStorage.setItem('agentcache_user', JSON.stringify(data.user));
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('agentcache_token');
        localStorage.removeItem('agentcache_user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
