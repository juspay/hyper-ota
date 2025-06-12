// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Login } from "./components/Login";
import Home from "./components/Home";
import { Signup } from "./components/Signup";
import Release from "./components/Release";
import Analytics from "./components/Analytics";
import axios from "./api/axios";
import Toast from "./components/Toast";

// Types
interface User {
  id: string;
  name: string;
  email: string;
  organisations: Organisation[];
}

interface Organisation {
  id: string;
  name: string;
  applications: Application[];
}

interface Application {
  id: string;
  application: string;
  versions: string[];
}

// Response types
type HomeResponse =
  | { type: "CREATE_ORGANISATION"; name: string }
  | { type: "CREATE_APPLICATION"; organisation: string; name: string }
  | { type: "INVITE_USER"; organisation: string; email: string; role: string };

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  console.log("rendering app");

  // Consolidate authentication check into a single useEffect
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token =
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");

      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data: userData } = await axios.get("/user");
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Authentication check failed:", error);
        // Clear invalid token
        localStorage.removeItem("userToken");
        sessionStorage.removeItem("userToken");
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []); // Empty dependency array - only run once on mount

  const handleHomeResponse = async (response: HomeResponse) => {
    try {
      let endpoint: string;
      let payload: any;
      const headers: Record<string, string> = {};

      if (response.type === "CREATE_ORGANISATION") {
        endpoint = "/organisations/create";
        payload = { name: response.name };
      } else if (response.type === "CREATE_APPLICATION") {
        endpoint = "/organisations/applications/create";
        payload = {
          organisation: response.organisation,
          application: response.name,
        };
        headers["x-organisation"] = response.organisation;
      } else if (response.type === "INVITE_USER") {
        endpoint = "/organisations/user/create";
        payload = {
          user: response.email,
          access: response.role,
        };
        headers["x-organisation"] = response.organisation;
      }

      await axios.post(endpoint, payload, { headers });

      // Refresh organizations list using the new organizations endpoint
      const { data: organisations } = await axios.get<Organisation[]>(
        "/organisations"
      );

      // Update user state with the new organizations data
      setUser((prev) => (prev ? { ...prev, organisations } : null));
    } catch (error) {
      console.error("API request failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  console.log("user", user);
  console.log("isAuthenticated", isAuthenticated);

  return (
    <Router>
      {/* Toast component for notifications */}
      <Toast />

      <Routes>
        <Route
          path="/dashboard/login"
          element={
            user && isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login
                setIsAuthenticated={setIsAuthenticated}
                setUser={setUser}
              />
            )
          }
        />
        <Route path="/dashboard/signup" element={<Signup></Signup>} />
        <Route
          path="/dashboard"
          element={
            isAuthenticated && user ? (
              <Home
                user={user}
                onResponse={handleHomeResponse}
                setIsAuthenticated={setIsAuthenticated}
              />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          }
        />
        <Route path="/dashboard/release/:org/:app" element={<Release />} />
        <Route 
          path="/dashboard/analytics/:org/:app" 
          element={
            isAuthenticated && user ? (
              <Analytics 
                user={user}
                setIsAuthenticated={setIsAuthenticated}
              />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          } 
        />
        <Route 
          path="/dashboard/analytics/:org/:app/:release" 
          element={
            isAuthenticated && user ? (
              <Analytics 
                user={user}
                setIsAuthenticated={setIsAuthenticated}
              />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          } 
        />
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/dashboard/login"}
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
