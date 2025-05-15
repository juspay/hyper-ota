import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactJson from "@uiw/react-json-view";
import axios from "../api/axios";
import ReleaseHistory from "./release/ReleaseHistory";

interface ReleaseConfig {
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

const Release: React.FC = () => {
  const { org, app } = useParams<{ org: string; app: string }>();
  const [loading, setLoading] = useState(true);
  const [releaseData, setReleaseData] = useState<ReleaseConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const fetchReleaseData = async (version?: number) => {
    try {
      setLoading(true);
      let url = `/release/v2/${org}/${app}`;
      if (version) {
        url += `?version=${version}`;
      }
      const { data } = await axios.get(url);
      setReleaseData(data);
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to fetch release data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleaseData(selectedVersion || undefined);
  }, [org, app, selectedVersion]);

  const handleSelectRelease = (version: number) => {
    setSelectedVersion(version);
    setShowHistory(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-xl font-semibold text-red-500 mb-4">Error</h4>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => fetchReleaseData(selectedVersion || undefined)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!releaseData) {
    return null;
  }

  console.log("showHistory", showHistory);
  console.log("org", org);
  console.log("app", app);

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Release Details</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              {showHistory ? "Hide History" : "Show Release History"}
            </button>
          </div>

          {showHistory && org && app && (
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-4">Release History</h3>
              <ReleaseHistory
                organisation={org}
                application={app}
                onSelectRelease={handleSelectRelease}
              />
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            <span className="font-semibold">Package:</span>
            <span>{releaseData.package.name}</span>
            <div className="h-4 w-px bg-gray-300"></div>
            <span className="font-semibold">Version:</span>
            <span>{releaseData.package.version}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Config Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">Version: </span>
                  <span>{releaseData.config.version}</span>
                </div>
                <div>
                  <span className="font-semibold">Release Timeout: </span>
                  <span>{releaseData.config.release_config_timeout}ms</span>
                </div>
                <div>
                  <span className="font-semibold">Package Timeout: </span>
                  <span>{releaseData.config.package_timeout}ms</span>
                </div>

                <hr className="my-4" />

                <div>
                  <h4 className="text-md font-semibold mb-2">Tenant Info</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">Assets Domain: </span>
                      <span>
                        {
                          releaseData.config.properties.tenant_info
                            .assets_domain
                        }
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold">Client ID: </span>
                      <span>
                        {releaseData.config.properties.tenant_info
                          .default_client_id || "Not Set"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Package Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Package Details</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-semibold">Index File: </span>
                  <span className="break-all">{releaseData.package.index}</span>
                </div>

                <hr className="my-4" />

                <div>
                  <h4 className="text-md font-semibold mb-2">Manifest</h4>
                  <div className="bg-white rounded p-4">
                    <ReactJson
                      value={releaseData.package.properties.manifest || {}}
                      displayDataTypes={false}
                      displayObjectSize={false}
                      enableClipboard={true}
                      collapsed={2}
                    />
                  </div>
                </div>

                <hr className="my-4" />

                <div>
                  <h4 className="text-md font-semibold mb-2">Manifest Hash</h4>
                  <div className="bg-white rounded p-4">
                    <ReactJson
                      value={releaseData.package.properties.manifest_hash || {}}
                      displayDataTypes={false}
                      displayObjectSize={false}
                      enableClipboard={true}
                      collapsed={2}
                    />
                  </div>
                </div>

                {releaseData.package.splits.length > 0 && (
                  <>
                    <hr className="my-4" />
                    <div>
                      <h4 className="text-md font-semibold mb-2">
                        Split Files
                      </h4>
                      <div className="space-y-1">
                        {releaseData.package.splits.map((split, index) => (
                          <div key={index} className="break-all">
                            {split}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Release;
