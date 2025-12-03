import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User, MeResponse } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  hasHubSpotConnection: boolean;
  portalId: string | null;
  hubDomain: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasHubSpotConnection, setHasHubSpotConnection] = useState(false);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [hubDomain, setHubDomain] = useState<string | null>(null);

  const refreshAuth = async () => {
    setIsLoading(true);
    try {
      const meData = await authService.getMe();
      if (meData) {
        setUser(meData.user);
        setHasHubSpotConnection(meData.hasHubSpotConnection);
        setPortalId(meData.portalId || null);
        setHubDomain(meData.hubDomain || null);
      } else {
        setUser(null);
        setHasHubSpotConnection(false);
        setPortalId(null);
        setHubDomain(null);
      }
    } catch (error) {
      console.error('Auth refresh failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is already logged in on mount
    if (authService.isLoggedIn()) {
      refreshAuth();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    setUser(result.user);
    setHasHubSpotConnection(result.hasHubSpotConnection || false);
    setPortalId(result.portalId || null);
  };

  const register = async (email: string, password: string, name?: string) => {
    const result = await authService.register(email, password, name);
    setUser(result.user);
    setHasHubSpotConnection(false);
    setPortalId(null);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setHasHubSpotConnection(false);
    setPortalId(null);
    setHubDomain(null);
  };

  const value: AuthContextType = {
    user,
    isLoggedIn: !!user,
    isLoading,
    hasHubSpotConnection,
    portalId,
    hubDomain,
    login,
    register,
    logout,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
