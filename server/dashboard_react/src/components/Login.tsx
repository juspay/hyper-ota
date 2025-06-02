import React from "react"; // Removed unused useState, useEffect
import { User } from "../types";
import { AuthLayout } from './layouts/AuthLayout';
import { LoginForm } from './auth/LoginForm';

// Props expected by the original Login page, to be passed to LoginForm
interface LoginPageProps {
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUser: (user: User) => void;
}

export const Login: React.FC<LoginPageProps> = ({ setIsAuthenticated, setUser }) => {
  return (
    <AuthLayout>
      <LoginForm setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
    </AuthLayout>
  );
};
