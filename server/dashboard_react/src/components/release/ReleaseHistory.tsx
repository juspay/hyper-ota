import React, { useEffect, useState } from "react";
import axios from "../../api/axios";
import { Calendar, User, Package, Eye, AlertCircle, Loader2 } from "lucide-react";

interface ReleaseHistoryEntry {
  id: string;
  package_version: number;
  config_version: string;
  created_at: string;
  created_by: string;
  metadata: Record<string, any>;
}

interface ReleaseHistoryProps {
  organisation: string;
  application: string;
  onSelectRelease?: (version: number) => void;
}

const ReleaseHistory: React.FC<ReleaseHistoryProps> = ({
  organisation,
  application,
  onSelectRelease,
}) => {
  const [releases, setReleases] = useState<ReleaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReleaseHistory = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          `/organisations/applications/release/history`,
          {
            headers: {
              "x-organisation": organisation,
              "x-application": application,
            },
          }
        );
        setReleases(data.releases);
        setError(null);
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to load release history"
        );
        setReleases([]);
      } finally {
        setLoading(false);
      }
    };

    if (organisation && application) {
      fetchReleaseHistory();
    }
  }, [organisation, application]);

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
          <p className="text-white/60">Loading release history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center">
          <AlertCircle size={20} className="mr-3" />
          <div>
            <strong className="font-semibold">Error: </strong>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Package size={32} className="text-white/40" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Release History</h3>
        <p className="text-white/60 max-w-md mx-auto">
          No releases found for this application. Create your first release to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {releases.map((release, index) => (
        <div
          key={release.id}
          className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-300 cursor-pointer group shadow-lg"
          onClick={() => onSelectRelease && onSelectRelease(release.package_version)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Version Badge */}
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                  index === 0 
                    ? "bg-gradient-to-r from-green-400 to-emerald-500" 
                    : "bg-gradient-to-r from-cyan-400 to-blue-500"
                }`}>
                  <Package size={24} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-lg font-bold text-white">v{release.package_version}</h4>
                    {index === 0 && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/30">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm">Config v{release.config_version}</p>
                </div>
              </div>
            </div>

            {/* Release Info */}
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="flex items-center text-white/60 text-sm mb-1">
                  <User size={14} className="mr-1" />
                  <span>{release.created_by}</span>
                </div>
                <div className="flex items-center text-white/60 text-sm">
                  <Calendar size={14} className="mr-1" />
                  <span>{formatDate(release.created_at)}</span>
                </div>
              </div>

              {/* View Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectRelease) {
                    onSelectRelease(release.package_version);
                  }
                }}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReleaseHistory;
