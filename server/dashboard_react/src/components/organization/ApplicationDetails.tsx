import { Application, Organisation } from "../../types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReleaseWorkflow from "../release/ReleaseWorkflow";
import UserManagement from "./UserManagement";
import { AppWindow, Plus } from "lucide-react";
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
    splits: string[];
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-700">Applications</h3>
          <button
            onClick={onCreateApp}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus size={16} className="mr-1" />
            Add Application
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {organization.applications.map((app) => (
          <button
            key={app.id}
            onClick={() => onAppSelect(app)}
            className={`w-full px-6 py-4 flex items-center hover:bg-gray-50 transition-colors ${
              application?.id === app.id ? "bg-indigo-50" : ""
            }`}
          >
            <AppWindow size={20} className="mr-3 text-gray-400" />
            <div className="flex-1 text-left">
              <h4 className="font-medium text-gray-900">{app.application}</h4>
              {/* <p className="text-sm text-gray-500">
                {app.versions?.length || 0} versions
              </p> */}
            </div>
          </button>
        ))}
        {organization.applications.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>No applications found</p>
            <button
              onClick={onCreateApp}
              className="mt-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Create your first application
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderApplicationDetails = () => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-700">
          {application.application}
        </h3>
        <button
          onClick={() => onAppSelect(null)}
          className="text-gray-400 hover:text-gray-500"
        >
          Back to list
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-600">Versions</span>
          <span className="font-medium">
            {application.versions?.length || 0}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-600">Status</span>
          <span className="font-medium text-green-600">Active</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <span className="text-gray-600">Last Updated</span>
          <span className="font-medium">Today</span>
        </div>

        {/* Release Status Section */}
        <div className="py-2 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">Current Release</span>
            {loadingRelease ? (
              <div className="animate-pulse bg-gray-200 h-5 w-20 rounded"></div>
            ) : releaseInfo ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Active
                </span>
                <span className="font-medium">
                  v{releaseInfo.package.version}
                </span>
              </div>
            ) : (
              <span className="text-gray-500">No release found</span>
            )}
          </div>
          {releaseInfo && (
            <>
              <div className="mt-1 text-sm text-gray-500">
                <div>Config version: {releaseInfo.config.version}</div>
                <div>
                  Release timeout: {releaseInfo.config.release_config_timeout}ms
                </div>
                <div>
                  Package timeout: {releaseInfo.config.package_timeout}ms
                </div>
                <div className="mt-2">
                  <div className="font-medium text-gray-600">
                    Assets Domain:
                  </div>
                  <div className="break-all">
                    {releaseInfo.config.properties.tenant_info.assets_domain}
                  </div>
                </div>
                {releaseInfo.package.splits.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-600">
                      Split Files: {releaseInfo.package.splits.length}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <details className="text-sm">
                  <summary className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium">
                    View Complete Configuration
                  </summary>
                  <div className="mt-2 bg-gray-50 rounded-md p-4 overflow-auto max-h-96">
                    <pre className="text-xs">
                      {JSON.stringify(releaseInfo, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={() =>
            navigate(
              `/dashboard/release/${organization.name}/${application.application}`
            )
          }
          className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md font-medium hover:bg-indigo-200 transition-colors"
        >
          View Release Details
        </button>
        <button
          onClick={handleRelease}
          className="mx-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md font-medium hover:bg-indigo-200 transition-colors"
        >
          Create Release
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {organization.name}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "applications"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
          onClick={() => onTabChange("applications")}
        >
          Applications
        </button>
        <button
          className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
          onClick={() => onTabChange("users")}
        >
          Users
        </button>
      </div>

      {/* Content */}
      {activeTab === "applications" ? (
        isReleaseModalOpen ? (
          <ReleaseWorkflow
            application={application}
            organization={organization}
            onClose={handleCloseRelease}
            onComplete={async () => {
              // Refetch to ensure we have the latest data
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
  );
}
