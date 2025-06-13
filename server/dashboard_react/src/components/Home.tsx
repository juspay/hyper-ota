import { useState, useEffect } from "react";
import Header from "./Header";
import CreateOrganization from "./organization/CreateOrganization";
import CreateApplication from "./organization/CreateApplication";
import ApplicationDetails from "./organization/ApplicationDetails";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Trash2, Building2, Users, Zap } from "lucide-react";
import smallLogoImage from '../assets/airborne-cube-logo.png';
import axios from "../api/axios"; 

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
  const navigate = useNavigate();
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isCreatingApp, setIsCreatingApp] = useState(false);
  const [activeTab, setActiveTab] = useState<"applications" | "users">("applications");
  const [organisations, setOrganisations] = useState<Organisation[]>(user.organisations || []);
  const [isDeletingOrg, setIsDeletingOrg] = useState<string | null>(null);

  useEffect(() => {
    setOrganisations(user.organisations || []);
    // Update selectedOrg with fresh data if it exists in the updated organizations
    if (selectedOrg) {
      const updatedSelectedOrg = (user.organisations || []).find(org => org.name === selectedOrg.name);
      if (updatedSelectedOrg) {
        setSelectedOrg(updatedSelectedOrg);
      }
    }
  }, [user.organisations]);

  useEffect(() => {
    if (!isCreatingApp) {
      setSelectedApp(null);
      setNewAppName("");
    }
  }, [selectedOrg, isCreatingApp]);

  const handleOrgSelect = (org: Organisation | null) => {
    setSelectedOrg(org);
    setSelectedApp(null);
    setIsCreatingOrg(false);
    setIsCreatingApp(false);
    if (org) setActiveTab("applications");
  };
  
  const handleOrganizationsUpdated = (updatedOrgs: Organisation[]) => {
    setOrganisations(updatedOrgs);
    if (selectedOrg) {
      const stillSelectedOrg = updatedOrgs.find(o => o.name === selectedOrg.name);
      if (!stillSelectedOrg) {
        setSelectedOrg(null);
      } else {
        setSelectedOrg(stillSelectedOrg);
      }
    }
  };

  const handleAppSelect = (app: Application | null) => {
    setSelectedApp(app);
    setIsCreatingApp(false);
  };

  const handleCreateOrgSubmit = () => {
    if (newOrgName.trim()) {
      onResponse({ type: "CREATE_ORGANISATION", name: newOrgName.trim() });
      setNewOrgName("");
      setIsCreatingOrg(false);
    }
  };

  const handleCreateAppSubmit = () => {
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
      navigate("/dashboard/", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };
  
  const deleteOrganization = async (orgName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${orgName}? This action cannot be undone.`)) {
      return;
    }
    setIsDeletingOrg(orgName);
    try {
      await axios.delete(`/organisations/${orgName}`, { headers: { "x-organisation": orgName } });
      alert("Organization deleted successfully");
      const updatedOrgs = organisations.filter(org => org.name !== orgName);
      handleOrganizationsUpdated(updatedOrgs);
      if (selectedOrg?.name === orgName) {
        handleOrgSelect(null);
      }
    } catch (error: any) {
      alert(error.response?.data?.Error || "Failed to delete organization");
      console.error("Delete organization error:", error);
    } finally {
      setIsDeletingOrg(null);
    }
  };

  const isOrgAdmin = () => true;

   useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
      if (!token || !selectedOrg || !selectedOrg.name) {
        if (selectedOrg === null) {
            // setSelectedOrg(prevOrg => prevOrg ? {...prevOrg, users: []} : null); // This line might cause issues if prevOrg is null
        }
        return;
      }
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
        setSelectedOrg(prevOrg => prevOrg ? { ...prevOrg, users: data.users || [] } : null);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    if (selectedOrg) {
        fetchUsers();
    } else { // Clear users if no org is selected
        setSelectedOrg(prevOrg => prevOrg ? {...prevOrg, users: []} : null);
    }
  }, [selectedOrg?.name, selectedOrg === null]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Header
        userName={user.name}
        userEmail={user.email}
        onLogout={handleLogout}
      />
      
      <div className="flex h-[calc(100vh-4rem)] relative z-10">
        {/* Left Sidebar - Organizations */}
        <div className="w-80 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <img src={smallLogoImage} alt="Airborne Logo" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Airborne</h1>
                <p className="text-xs text-white/60">Organization Management</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Organizations</h2>
              <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">{organisations.length}</span>
            </div>
          </div>

          {/* Organizations List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {organisations.map((org) => (
              <div
                key={org.name}
                onClick={() => handleOrgSelect(org)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                  selectedOrg?.name === org.name 
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg shadow-blue-500/10" 
                    : "bg-white/5 hover:bg-white/10 border border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedOrg?.name === org.name 
                        ? "bg-gradient-to-r from-blue-400 to-purple-500" 
                        : "bg-white/10"
                    }`}>
                      <Building2 size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{org.name}</h3>
                      <p className="text-xs text-white/60">{org.applications?.length || 0} apps</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isOrgAdmin() && (
                      <button
                        onClick={(e) => deleteOrganization(org.name, e)}
                        className={`p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${
                          isDeletingOrg === org.name ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={isDeletingOrg === org.name}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <ChevronRight size={16} className={`transition-transform duration-300 ${
                      selectedOrg?.name === org.name ? "text-blue-400 rotate-90" : "text-white/40"
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Organization Button */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => {setIsCreatingOrg(true); setSelectedOrg(null);}}
              className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              <div className="flex items-center justify-center space-x-2">
                <Plus size={18} />
                <span>New Organization</span>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 relative">
          {isCreatingOrg && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="w-full max-w-2xl">
                <CreateOrganization
                  newOrgName={newOrgName}
                  onOrgNameChange={setNewOrgName}
                  onCreateOrg={handleCreateOrgSubmit}
                  onCancel={() => setIsCreatingOrg(false)} 
                />
              </div>
            </div>
          )}

          {selectedOrg && !isCreatingOrg && !isCreatingApp && (
            <div className="h-full p-8">
              <ApplicationDetails
                application={selectedApp}
                organization={selectedOrg}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onInviteUser={handleInviteUser}
                onAppSelect={handleAppSelect}
                onCreateApp={() => setIsCreatingApp(true)}
              />
            </div>
          )}

          {!selectedOrg && !isCreatingOrg && !isCreatingApp && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-2xl">
                {/* Welcome Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 border border-white/20 shadow-2xl">
                  {/* Logo and Title */}
                  <div className="mb-8">
                    <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
                      <img src={smallLogoImage} alt="Airborne Logo" className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      Welcome to Airborne
                    </h1>
                    <p className="text-lg text-white/70 leading-relaxed">
                      {organisations.length === 0 
                        ? "Create and manage your organizations to get started with over-the-air updates for your applications."
                        : "Select an organization from the sidebar to manage your applications and team members, or create a new organization."
                      }
                    </p>
                  </div>

                  {/* Features Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Building2 size={24} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Organizations</h3>
                      <p className="text-sm text-white/60">Manage multiple teams and projects</p>
                    </div>
                    
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Zap size={24} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Applications</h3>
                      <p className="text-sm text-white/60">Deploy updates instantly</p>
                    </div>
                    
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Users size={24} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Team</h3>
                      <p className="text-sm text-white/60">Collaborate with your team</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => { setIsCreatingOrg(true); setSelectedOrg(null); }}
                    className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl shadow-blue-500/20 text-lg"
                  >
                    <div className="flex items-center justify-center space-x-3">
                      <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" /> 
                      <span>
                        {organisations.length === 0 
                          ? "Create Your First Organization" 
                          : "Create New Organization"
                        }
                      </span>
                    </div>
                  </button>
                  
                  <p className="mt-6 text-sm text-white/50">
                    {organisations.length === 0
                      ? "Start managing your applications and invite team members once your organization is set up."
                      : `You currently have ${organisations.length} organization${organisations.length === 1 ? '' : 's'}. Select one from the sidebar or create a new one.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedOrg && isCreatingApp && (
            <div className="h-full flex items-center justify-center p-8">
              <div className="w-full max-w-2xl">
                <CreateApplication
                  organization={selectedOrg}
                  newAppName={newAppName}
                  onAppNameChange={setNewAppName}
                  onCreateApp={handleCreateAppSubmit}
                  setIsCreatingApp={setIsCreatingApp}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
