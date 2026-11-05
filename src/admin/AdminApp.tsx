import React, { useState, useEffect } from 'react';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

interface AdminAppProps {
  onBackToWebsite: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ onBackToWebsite }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const token =
      localStorage.getItem('browinegirl_admin_token') ||
      sessionStorage.getItem('browinegirl_admin_token');
    return Boolean(token);
  });

  const [adminUser, setAdminUser] = useState<string>(() => {
    if (typeof window === 'undefined') return 'preethipreethu712@gmail.com';
    const stored =
      localStorage.getItem('browinegirl_admin_user') ||
      sessionStorage.getItem('browinegirl_admin_user');
    if (!stored || stored === 'admin@browinegirlcakes.com') {
      return 'preethipreethu712@gmail.com';
    }
    return stored;
  });

  const handleLoginSuccess = (email: string) => {
    setAdminUser(email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('browinegirl_admin_token');
    localStorage.removeItem('browinegirl_admin_user');
    sessionStorage.removeItem('browinegirl_admin_token');
    sessionStorage.removeItem('browinegirl_admin_user');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onBackToWebsite={onBackToWebsite}
      />
    );
  }

  return (
    <AdminDashboard
      adminEmail={adminUser}
      onLogout={handleLogout}
      onViewWebsite={onBackToWebsite}
    />
  );
};
