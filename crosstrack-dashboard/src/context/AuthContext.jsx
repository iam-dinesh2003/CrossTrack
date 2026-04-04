import { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crosstrack_token');
    const email = localStorage.getItem('crosstrack_email');
    const name = localStorage.getItem('crosstrack_name');
    if (token && email) {
      setUser({ token, email, displayName: name || email });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem('crosstrack_token', data.token);
    localStorage.setItem('crosstrack_email', data.email);
    localStorage.setItem('crosstrack_name', data.displayName);
    setUser(data);
    return data;
  };

  const register = async (email, password, displayName) => {
    const data = await authService.register(email, password, displayName);
    localStorage.setItem('crosstrack_token', data.token);
    localStorage.setItem('crosstrack_email', data.email);
    localStorage.setItem('crosstrack_name', data.displayName);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('crosstrack_token');
    localStorage.removeItem('crosstrack_email');
    localStorage.removeItem('crosstrack_name');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
