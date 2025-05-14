import { Application, Organisation } from "../../types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReleaseWorkflow from "../release/ReleaseWorkflow";
import UserManagement from "./UserManagement";
import { AppWindow, Plus, ArrowLeft, Activity, Clock, Globe, Package, ChevronDown, ChevronUp, Rocket, Eye } from "lucide-react";
import axios from "../../api/axios";

interface ReleaseInfo {
  config: {
    version: string;
    release_config_timeout: number;
    package_timeout: number;
    properties: {
      tenant_info: {
        assets_domain: string;
        default_client_id: string;
      };
    };
  };
  package: {
    name: string;
    version: string;
    properties: {
      manifest: Record<string, any>;
      manifest_hash: Record<string, any>;
    };
    index: string;
    important: Array<{
      url: string;
      file_path: string;
    }>;
    lazy: Array<{
      url: string;
      file_path: string;
    }>;
  };
}

interface ApplicationDetailsProps {
  application: Application | null;
  organization: Organisation;
  activeTab: "applications" | "users";
  onTabChange: (tab: "applications" | "users") => void;
  onInviteUser: (email: string, role: string) => void;
  onAppSelect: (app: Application) => void;
  onCreateApp: () => void;
}

export default function ApplicationDetails({
  application,
  organization,
  activeTab,
  onTabChange,
  onInviteUser,
  onAppSelect,
  onCreateApp,
}: ApplicationDetailsProps) {
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsReleaseModalOpen(false);
  }, [activeTab]);

  const handleRelease = () => {
    setIsReleaseModalOpen(true);
  };

  const handleCloseRelease = () => {
    setIsReleaseModalOpen(false);
  };

  const fetchReleaseInfo = async () => {
    if (!application) return;

    setLoadingRelease(true);
    try {
      const { data } = await axios.get(
        `/release/v2/${organization.name}/${application.application}`
      );
      setReleaseInfo(data);
    } catch (error) {
      console.error("Failed to fetch release info:", error);
    } finally {
      setLoadingRelease(false);
    }
  };

  useEffect(() => {
    fetchReleaseInfo();
  }, [application, organization.name]);

  const renderApplicationList = () => (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white mb-1">Applications</h3>
            <p className="text-white/60 text-sm">Manage your application deployments</p>
          </div>
          <button
            onClick={onCreateApp}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
          >
            <Plus size={18} className="mr-2" />
            Add Application
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {organization.applications.length > 0 ? (
          <div className="space-y-3">
            {organization.applications.map((app) => (
              <button
                key={app.id}
                onClick={() => onAppSelect(app)}
                className={`w-full p-6 rounded-xl transition-all duration-300 border ${
                  application?.id === app.id 
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/30 shadow-lg shadow-blue-500/10" 
                    : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                    application?.id === app.id 
                      ? "bg-gradient-to-r from-blue-400 to-purple-500" 
                      : "bg-white/10"
                  }`}>
                    <AppWindow size={24} className="text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-white text-lg">{app.application}</h4>
                    <p className="text-white/60 text-sm mt-1">
                      {app.versions?.length || 0} version{app.versions?.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-white/40">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AppWindow size={32} className="text-white/40" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Applications Yet</h3>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Create your first application to start deploying over-the-air updates
            </p>
            <button
              onClick={onCreateApp}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              Create First Application
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderApplicationDetails = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => onAppSelect(null)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 mr-4"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                <AppWindow size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{application.application}</h3>
                <p className="text-white/60">Application Details</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
              <Activity size={14} className="inline mr-1" />
              Active
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl flex items-center justify-center mr-4">
              <Package size={24} className="text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Versions</h4>
              <p className="text-2xl font-bold text-white">{application.versions?.length || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mr-4">
              <Clock size={24} className="text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Last Updated</h4>
              <p className="text-white/80 font-medium">Today</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-400 rounded-xl flex items-center justify-center mr-4">
              <Globe size={24} className="text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold">Status</h4>
              <p className="text-green-400 font-medium">Deployed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Release Information */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-xl font-semibold text-white">Current Release</h4>
            <p className="text-white/60">Active deployment information</p>
          </div>
          {loadingRelease ? (
            <div className="animate-pulse bg-white/20 h-8 w-24 rounded-lg"></div>
          ) : releaseInfo ? (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                Live
              </div>
              <span className="text-xl font-bold text-white">v{releaseInfo.package.version}</span>
            </div>
          ) : (
            <span className="text-white/50">No release found</span>
          )}
        </div>

        {releaseInfo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h5 className="text-white font-medium mb-2">Configuration</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Config Version:</span>
                    <span className="text-white font-mono">{releaseInfo.config.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Release Timeout:</span>
                    <span className="text-white font-mono">{releaseInfo.config.release_config_timeout}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Package Timeout:</span>
                    <span className="text-white font-mono">{releaseInfo.config.package_timeout}ms</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h5 className="text-white font-medium mb-2">Package Info</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Package Name:</span>
                    <span className="text-white font-mono">{releaseInfo.package.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Important Files:</span>
                    <span className="text-white font-mono">{releaseInfo.package.important.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Lazy Files:</span>
                    <span className="text-white font-mono">{releaseInfo.package.lazy.length}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-white/60">Assets Domain:</span>
                    <div className="text-white font-mono text-xs mt-1 break-all bg-white/5 p-2 rounded border border-white/10">
                      {releaseInfo.config.properties.tenant_info.assets_domain}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Expandable Config Details */}
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => setShowConfigDetails(!showConfigDetails)}
                className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-200"
              >
                <span className="text-white font-medium">Complete Configuration</span>
                {showConfigDetails ? <ChevronUp size={20} className="text-white/60" /> : <ChevronDown size={20} className="text-white/60" />}
              </button>
              {showConfigDetails && (
                <div className="mt-4 bg-black/20 rounded-xl p-4 border border-white/10 overflow-auto max-h-96">
                  <pre className="text-xs text-white/80">
                    {JSON.stringify(releaseInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package size={28} className="text-white/40" />
            </div>
            <p className="text-white/60">No release information available</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() =>
            navigate(
              `/dashboard/release/${organization.name}/${application.application}`
            )
          }
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-300 border border-white/20 flex items-center"
        >
          <Eye size={18} className="mr-2" />
          View Release Details
        </button>
        {/* <button
          onClick={() => {
            // Navigate to analytics, let the Analytics component handle release selection
            navigate(
              `/dashboard/analytics/${organization.name}/${application.application}`
            );
          }}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/20 flex items-center"
        >
          <BarChart3 size={18} className="mr-2" />
          View Analytics
        </button> */}
        <button
          onClick={handleRelease}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
        >
          <Rocket size={18} className="mr-2" />
          Create Release
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Organization Header */}
      <div className="mb-8">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center mr-3">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{organization.name}</h2>
            <p className="text-white/60">Organization Management</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mb-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-1 flex">
          <button
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === "applications"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            onClick={() => onTabChange("applications")}
          >
            Applications
          </button>
          <button
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
              activeTab === "users"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            onClick={() => onTabChange("users")}
          >
            Users
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === "applications" ? (
          isReleaseModalOpen ? (
            <ReleaseWorkflow
              application={application}
              organization={organization}
              onClose={handleCloseRelease}
              onComplete={async () => {
                await fetchReleaseInfo();
                handleCloseRelease();
              }}
            />
          ) : application ? (
            renderApplicationDetails()
          ) : (
            renderApplicationList()
          )
        ) : (
          <UserManagement
            organization={organization}
            onInviteUser={onInviteUser}
          />
        )}
      </div>
    </div>
  );
}
