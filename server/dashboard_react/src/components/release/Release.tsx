import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Package, ArrowLeft, Clock, Globe, Activity, Rocket, ChevronDown, ChevronUp, Eye } from "lucide-react";
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

export default function Release() {
  const { orgName, appName } = useParams();
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfigDetails, setShowConfigDetails] = useState(false);

  useEffect(() => {
    const fetchReleaseInfo = async () => {
      if (!orgName || !appName) return;

      try {
        setLoading(true);
        const { data } = await axios.get(`/release/v2/${orgName}/${appName}`);
        setReleaseInfo(data);
      } catch (error) {
        console.error("Failed to fetch release info:", error);
        setError("Failed to load release information");
      } finally {
        setLoading(false);
      }
    };

    fetchReleaseInfo();
  }, [orgName, appName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/20 rounded w-1/3"></div>
            <div className="h-32 bg-white/20 rounded"></div>
            <div className="h-64 bg-white/20 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center overflow-y-auto">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Error Loading Release</h1>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-y-auto">
      <div className="p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 mr-4"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                <Package size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{appName}</h1>
                <p className="text-white/60">Application Details</p>
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
                  <p className="text-2xl font-bold text-white">0</p>
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

          {/* Current Release */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Current Release</h3>
                  <p className="text-white/60 text-sm">Active deployment information</p>
                </div>
                {releaseInfo ? (
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                      <Activity size={14} className="inline mr-1" />
                      Live
                    </div>
                    <span className="text-xl font-bold text-white">v{releaseInfo.package.version}</span>
                  </div>
                ) : (
                  <span className="text-white/50">No release found</span>
                )}
              </div>
            </div>

            {releaseInfo ? (
              <div className="p-6 space-y-4">
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

                {/* Expandable Config Details with Fixed Scrolling */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => setShowConfigDetails(!showConfigDetails)}
                    className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-200"
                  >
                    <span className="text-white font-medium">Complete Configuration</span>
                    {showConfigDetails ? <ChevronUp size={20} className="text-white/60" /> : <ChevronDown size={20} className="text-white/60" />}
                  </button>
                  {showConfigDetails && (
                    <div className="mt-4">
                      <div className="bg-black/20 rounded-xl border border-white/10 max-h-96 overflow-auto">
                        <div className="p-4">
                          <pre className="text-xs text-white/80 whitespace-pre-wrap break-words">
                            {JSON.stringify(releaseInfo, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package size={28} className="text-white/40" />
                </div>
                <p className="text-white/60">No release information available</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 pb-8">
            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-300 border border-white/20 flex items-center">
              <Eye size={18} className="mr-2" />
              View Release Details
            </button>
            <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center">
              <Rocket size={18} className="mr-2" />
              Create Release
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}