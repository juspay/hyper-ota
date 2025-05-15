import React, { useEffect, useState } from "react";
import axios from "../../api/axios";

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

  console.log("organisation", organisation);

  console.log("releases", releases);

  if (loading) {
    console.log("loading");
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  console.log("error", error);

  if (error) {
    return (
      <div
        className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4"
        role="alert"
      >
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (releases.length === 0) {
    console.log("no releases");
    return (
      <div className="text-center p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500">
          No release history found for this application.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
            >
              Version
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Config Version
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Released By
            </th>
            <th
              scope="col"
              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
            >
              Release Date
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {releases.map((release) => (
            <tr
              key={release.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() =>
                onSelectRelease && onSelectRelease(release.package_version)
              }
            >
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                {release.package_version}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {release.config_version}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {release.created_by}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {formatDate(release.created_at)}
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectRelease) {
                      onSelectRelease(release.package_version);
                    }
                  }}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReleaseHistory;
