import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/client';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Where each kind of account lands after logging in.
export const homeFor = (user) => (user?.role === 'customer' ? '/menu' : '/admin/dashboard');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // On first load, restore the session from a stored token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (localStorage.getItem('token')) {
        try {
          const { data } = await api.get('/auth/verify');
          if (!cancelled) setUser(data.user);
        } catch {
          localStorage.removeItem('token');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // The axios interceptor fires this when any request comes back 401.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const startSession = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (credentials) => {
    setError('');
    try {
      const { data } = await api.post('/auth/login', credentials);
      return startSession(data);
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
      throw err;
    }
  };

  const register = async (details) => {
    setError('');
    try {
      const { data } = await api.post('/auth/register', details);
      return startSession(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account'));
      throw err;
    }
  };

  const updateProfile = async (changes) => {
    const { data } = await api.put('/auth/profile', changes);
    setUser(data.user);
    return data.user;
  };

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* the token is cleared locally either way */
    }
    localStorage.removeItem('token');
    setUser(null);
    // Lets the cart start empty for whoever logs in next on this browser.
    window.dispatchEvent(new Event('auth:logout'));
  }, []);

  const value = {
    user,
    loading,
    error,
    setError,
    login,
    register,
    updateProfile,
    logout,
    isAdmin: user?.role === 'admin',
    isCustomer: user?.role === 'customer',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
