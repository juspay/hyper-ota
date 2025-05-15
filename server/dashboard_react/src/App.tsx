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
import axios from "./api/axios";
import Toast from "./components/Toast";
// import CreateRelease from "./components/release/create_release";

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

  useEffect(() => {
    const token =
      localStorage.getItem("userToken") || sessionStorage.getItem("userToken");

    if (!token) {
      setIsAuthenticated(false);
      return;
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Check if user is logged in
    const checkAuthStatus = async () => {
      const token =
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");

      if (!token) {
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
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // const handleLogout = () => {
  //   localStorage.removeItem('userToken');
  //   sessionStorage.removeItem('userToken');
  //   setIsAuthenticated(false);
  //   setUser(null);
  // };

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
            user ? (
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
        <Route
          path="/dashboard"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/dashboard/login"}
              replace
            />
          }
        />
        <Route path="/dashboard/release/:org/:app" element={<Release />} />
      </Routes>
    </Router>
  );
};

export default App;
