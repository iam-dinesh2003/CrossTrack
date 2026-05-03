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
    const role = localStorage.getItem('crosstrack_role') || 'ROLE_USER';
    if (token && email) {
      setUser({ token, email, displayName: name || email, role });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem('crosstrack_token', data.token);
    localStorage.setItem('crosstrack_email', data.email);
    localStorage.setItem('crosstrack_name', data.displayName);
    localStorage.setItem('crosstrack_role', data.role || 'ROLE_USER');
    setUser(data);
    return data;
  };

  const register = async (email, password, displayName) => {
    const data = await authService.register(email, password, displayName);
    localStorage.setItem('crosstrack_token', data.token);
    localStorage.setItem('crosstrack_email', data.email);
    localStorage.setItem('crosstrack_name', data.displayName);
    localStorage.setItem('crosstrack_role', data.role || 'ROLE_USER');
    setUser(data);
    return data;
  };

  const loginWithData = (data) => {
    localStorage.setItem('crosstrack_token', data.token);
    localStorage.setItem('crosstrack_email', data.email);
    localStorage.setItem('crosstrack_name', data.displayName);
    localStorage.setItem('crosstrack_role', data.role || 'ROLE_USER');
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('crosstrack_token');
    localStorage.removeItem('crosstrack_email');
    localStorage.removeItem('crosstrack_name');
    localStorage.removeItem('crosstrack_role');
    setUser(null);
  };

  const isAdmin = user?.role === 'ROLE_ADMIN';

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithData, register, logout, isAuthenticated: !!user, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
