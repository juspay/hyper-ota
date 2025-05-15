import { useState, useEffect } from "react";
import Header from "./Header";
import OrganizationList from "./organization/OrganizationList";
import CreateOrganization from "./organization/CreateOrganization";
import CreateApplication from "./organization/CreateApplication";
import ApplicationDetails from "./organization/ApplicationDetails";
import { useNavigate } from "react-router-dom";

// Types
interface User {
  id: string;
  name: string;
  email: string;
  organisations: Organisation[];
}

interface OrganisationUser {
  id: string;
  username: string;
  email: string;
  role: string[];
}

interface Organisation {
  id: string;
  name: string;
  applications: Application[];
  users?: OrganisationUser[];
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

interface HomeProps {
  user: User;
  onResponse: (response: HomeResponse) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
}

export default function Home({
  user,
  onResponse,
  setIsAuthenticated,
}: HomeProps) {
  // State management
  const navigate = useNavigate();
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isCreatingApp, setIsCreatingApp] = useState(false);
  const [activeTab, setActiveTab] = useState<"applications" | "users">(
    "applications"
  );
  const [organisations, setOrganisations] = useState<Organisation[]>(
    user.organisations
  );

  // Sync local organisations state with prop changes
  useEffect(() => {
    setOrganisations(user.organisations);
  }, [user.organisations]);

  console.log("isCreatingApp", isCreatingApp);

  // Reset app selection when org changes
  useEffect(() => {
    if (!isCreatingApp) {
      setSelectedApp(null);
      setNewAppName("");
    }
  }, [selectedOrg, isCreatingApp]);

  // Handler functions
  const handleOrgSelect = (org: Organisation) => {
    setSelectedOrg(org);
    setSelectedApp(null);
    setIsCreatingOrg(false);
    setIsCreatingApp(false);
    setActiveTab("applications");
  };

  // Handle updated organizations from the OrganizationList component
  const handleOrganizationsUpdated = (updatedOrgs: Organisation[]) => {
    setOrganisations(updatedOrgs);

    // If the currently selected organization was deleted or changed, update selection
    if (selectedOrg) {
      const updatedOrg = updatedOrgs.find(
        (org) => org.name === selectedOrg.name
      );
      if (updatedOrg) {
        setSelectedOrg(updatedOrg);
      } else {
        setSelectedOrg(null);
      }
    }
  };

  const handleAppSelect = (app: Application | null) => {
    setSelectedApp(app);
    setIsCreatingApp(false);
  };

  const handleCreateOrg = () => {
    if (newOrgName.trim()) {
      onResponse({ type: "CREATE_ORGANISATION", name: newOrgName.trim() });
      setNewOrgName("");
      setIsCreatingOrg(false);
    }
  };

  const handleCreateApp = () => {
    if (selectedOrg && newAppName.trim()) {
      onResponse({
        type: "CREATE_APPLICATION",
        organisation: selectedOrg.name,
        name: newAppName.trim(),
      });
      setNewAppName("");
      setIsCreatingApp(false);
    }
  };

  const handleInviteUser = (email: string, role: string) => {
    if (selectedOrg) {
      onResponse({
        type: "INVITE_USER",
        organisation: selectedOrg.name,
        email,
        role,
      });
    }
  };

  const handleTabChange = (tab: "applications" | "users") => {
    setActiveTab(tab);
    if (tab === "applications") {
      setSelectedApp(null);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("userToken");
      sessionStorage.removeItem("userToken");
      setIsAuthenticated(false);
      navigate("/dashboard/login", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      const token =
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");

      if (!token || !selectedOrg) return;
      try {
        const response = await fetch("/organisation/user/list", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-organisation": selectedOrg.name,
          },
        });

        const data = await response.json();

        // Update the selected organization with the fetched users
        setSelectedOrg((prevOrg) => {
          if (!prevOrg) return prevOrg;
          if (JSON.stringify(prevOrg.users) !== JSON.stringify(data.users)) {
            return {
              ...prevOrg,
              users: data.users || [],
            };
          }
          return prevOrg;
        });
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, [selectedOrg?.name]);

  console.log("isCreatingApp", isCreatingApp);
  console.log("selectedOrg", selectedOrg);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header
        userName={user.name}
        userEmail={user.email}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        <OrganizationList
          organizations={organisations}
          selectedOrg={selectedOrg}
          selectedApp={selectedApp}
          onOrgSelect={handleOrgSelect}
          onAppSelect={handleAppSelect}
          onCreateOrg={() => setIsCreatingOrg(true)}
          onCreateApp={() => setIsCreatingApp(true)}
          onOrganizationsUpdated={handleOrganizationsUpdated}
        />

        <div className="flex-1 overflow-auto p-6">
          {isCreatingOrg && (
            <CreateOrganization
              newOrgName={newOrgName}
              onOrgNameChange={setNewOrgName}
              onCreateOrg={handleCreateOrg}
            />
          )}

          {selectedOrg && !isCreatingOrg && (
            <ApplicationDetails
              application={selectedApp}
              organization={selectedOrg}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onInviteUser={handleInviteUser}
              onAppSelect={handleAppSelect}
              onCreateApp={() => setIsCreatingApp(true)}
            />
          )}

          {!isCreatingOrg && !selectedOrg && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-white p-10 rounded-xl shadow-lg border border-gray-100 max-w-md transition-all hover:shadow-xl">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-3 text-gray-800 tracking-tight">
                    Welcome to Hyper OTA
                  </h2>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    Get started by creatings your first organisation to manage
                    your applications and team.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreatingOrg(true)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transform transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Create Your First Organisation</span>
                  </div>
                </button>
                <p className="mt-4 text-sm text-gray-500">
                  You can add team members and applications once your
                  organisation is created
                </p>
              </div>
            </div>
          )}

          {selectedOrg && isCreatingApp && (
            <CreateApplication
              organization={selectedOrg}
              newAppName={newAppName}
              onAppNameChange={setNewAppName}
              onCreateApp={handleCreateApp}
              setIsCreatingApp={setIsCreatingApp}
            />
          )}
        </div>
      </div>
    </div>
  );
}
