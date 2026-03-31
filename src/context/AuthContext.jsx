import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const PRIMARY_TOKEN_KEY = 'agentcache_token';
const LEGACY_TOKEN_KEY = 'auth_token';
const USER_KEY = 'agentcache_user';
const WORKSPACE_KEY = 'agentcache_workspace';

const readStoredToken = () =>
  localStorage.getItem(PRIMARY_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);

const persistSession = ({ token, user, workspace = null }) => {
  if (token) {
    localStorage.setItem(PRIMARY_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_KEY, token);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  if (workspace) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  }
};

const clearSession = () => {
  localStorage.removeItem(PRIMARY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const token = readStoredToken();
    if (token) {
      fetchCurrentUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        persistSession({
          token,
          user: data.user,
          workspace: data.organization ? { user: data.user, organization: data.organization } : null
        });
      } else {
        // Token invalid, clear it
        clearSession();
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, organizationName, sector, businessDescription) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          name: email.split('@')[0],
          organizationName,
          sector,
          businessDescription
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token and set user
      persistSession({ token: data.token, user: data.user });
      setUser(data.user);

      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and set user
      persistSession({ token: data.token, user: data.user });
      setUser(data.user);

      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setError(null);
  };

  const getToken = () => {
    return readStoredToken();
  };

  const isAuthenticated = () => {
    return user !== null;
  };

  const hasRole = (role) => {
    return user && user.role === role;
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    getToken,
    isAuthenticated,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
