import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import ReactJson from "@uiw/react-json-view";
import axios from "../api/axios";
import ReleaseHistory from "./release/ReleaseHistory";
import { Package, Settings, Calendar, Eye, EyeOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { vscodeTheme } from '@uiw/react-json-view/vscode';


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

  const fetchReleaseData = useCallback(async (version?: number) => {
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
  }, [org, app]);

  useEffect(() => {
    fetchReleaseData(selectedVersion || undefined);
  }, [fetchReleaseData, selectedVersion]);

  const handleSelectRelease = (version: number) => {
    setSelectedVersion(version);
    setShowHistory(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex justify-center items-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 flex items-center justify-center mx-auto mb-6">
            <Loader2 size={32} className="text-white animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Loading Release Details</h3>
          <p className="text-white/60">Fetching release information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex justify-center items-center p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 max-w-md w-full shadow-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <h4 className="text-xl font-semibold text-white mb-4">Error Loading Release</h4>
            <p className="text-white/70 mb-6">{error}</p>
            <button
              onClick={() => fetchReleaseData(selectedVersion || undefined)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              <RefreshCw size={18} className="mr-2" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!releaseData) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <Package size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Release Details</h1>
                  <p className="text-white/60">{org} / {app}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`inline-flex items-center px-4 sm:px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg ${
                showHistory 
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20" 
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-purple-500/20"
              }`}
            >
              {showHistory ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
              <span className="hidden sm:inline">{showHistory ? "Hide History" : "Show Release History"}</span>
              <span className="sm:hidden">{showHistory ? "Hide" : "History"}</span>
            </button>
          </div>
        </div>

        {/* Release History */}
        {showHistory && org && app && (
          <div className="mb-6 sm:mb-8">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                <Calendar size={20} className="mr-2" />
                Release History
              </h3>
              <div className="overflow-hidden">
                <ReleaseHistory
                  organisation={org}
                  application={app}
                  onSelectRelease={handleSelectRelease}
                />
              </div>
            </div>
          </div>
        )}

        {/* Package Info Header */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4 sm:space-x-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <Package size={24} className="text-white sm:w-7 sm:h-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white break-words">{releaseData.package.name}</h2>
                <p className="text-white/60">Version {releaseData.package.version}</p>
              </div>
            </div>
            <div>
              <div className="px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-semibold border border-green-500/30 text-sm sm:text-base">
                Active Release
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Configuration Section */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
              <Settings size={20} className="mr-2" />
              Configuration
            </h3>
            <div className="overflow-hidden rounded-xl">
              <ReactJson
                value={releaseData.config}
                style={{
                  ...vscodeTheme,
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  fontSize: '13px',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
                collapsed={2}
                indentWidth={2}
                shortenTextAfterLength={50}
                // quotesOnKeys={false}
                // sortKeys={false}
              />
            </div>
          </div>

          {/* Package Section */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
              <Package size={20} className="mr-2" />
              Package Details
            </h3>
            
            {/* Package Properties */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                
                <div className="overflow-hidden rounded-xl">
                  <ReactJson
                    value={releaseData.package}
                    style={{
                      ...vscodeTheme,
                      backgroundColor: 'rgba(17, 24, 39, 0.8)',
                      fontSize: '13px',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      maxHeight: '400px',
                      overflow: 'auto'
                    }}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    enableClipboard={true}
                    collapsed={2}
                    indentWidth={2}
                    shortenTextAfterLength={50}
                    // quotesOnKeys={false}
                    // sortKeys={false}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Additional Package Information */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 shadow-xl">
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Additional Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Index</h4>
              <p className="text-white font-mono text-sm break-all">{releaseData.package.index}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Splits Count</h4>
              <p className="text-white text-lg font-semibold">{releaseData.package.splits.length}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 sm:col-span-2 lg:col-span-1">
              <h4 className="text-sm font-semibold text-white/80 mb-2">Timeout (Config)</h4>
              <p className="text-white text-lg font-semibold">{releaseData.config.release_config_timeout}ms</p>
            </div>
          </div>

          {/* Splits Information */}
          {releaseData.package.splits.length > 0 && (
            <div className="mt-6">
              <h4 className="text-base sm:text-lg font-semibold text-white mb-3">Splits</h4>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="space-y-2">
                  {releaseData.package.splits.map((split, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
                      <span className="text-white/60 text-sm">Split {index + 1}</span>
                      <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">{split}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Release;
