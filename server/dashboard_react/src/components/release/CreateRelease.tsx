import { useState } from "react";
import { Save, X, Package, Settings } from "lucide-react";
import { Application, Organisation } from "../../types";
import axios from "../../api/axios";

interface CreateReleaseProps {
  application: Application;
  organization: Organisation;
  versionInfo: {
    packageVersion: number;
    configVersion: string;
  };
  onClose: () => void;
  onBack: () => void;
  onSuccess: (releaseInfo: any) => void;
}

export default function CreateRelease({
  application,
  organization,
  versionInfo,
  onClose,
  onBack,
  onSuccess,
}: CreateReleaseProps) {
  const [metadata, setMetadata] = useState("");
  const [isValidJson, setIsValidJson] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [useLatestVersion, setUseLatestVersion] = useState(false);

  const handleMetadataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMetadata(value);

    if (value) {
      try {
        JSON.parse(value);
        setIsValidJson(true);
        setErrorMessage("");
      } catch {
        setIsValidJson(false);
        setErrorMessage("Invalid JSON format for metadata");
      }
    } else {
      // Empty metadata is valid (will be converted to {})
      setIsValidJson(true);
      setErrorMessage("");
    }
  };

  const handleUseLatestVersionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUseLatestVersion(e.target.checked);
  };

  const handleCreateRelease = async () => {
    try {
      setIsSubmitting(true);
      setError("");

      const headers = {
        "x-organisation": organization.name,
        "x-application": application.application,
      };

      // Prepare release data
      const releaseData: any = {};

      // Add metadata if provided
      if (metadata) {
        releaseData.metadata = JSON.parse(metadata);
      }

      // Add version_id if not using latest version
      if (!useLatestVersion) {
        releaseData.version_id = versionInfo.packageVersion.toString();
      }

      const response = await axios.post(
        "/organisations/applications/release/create",
        releaseData,
        { headers }
      );

      onSuccess(response.data);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to create release. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-0 w-11/12 max-w-4xl min-h-[calc(100vh-2rem)]">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-white/10 px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                  <Package size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Step 3: Create Release
                  </h2>
                  <p className="text-white/70">{application?.application}</p>
                </div>
                <span className="px-4 py-2 bg-purple-500/20 text-purple-200 rounded-xl font-semibold border border-purple-400/30">
                  {organization.name}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white/90 transition-colors duration-200"
              >
                <span className="sr-only">Close</span>
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {/* Version Information */}
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-xl backdrop-blur-sm">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center mr-3">
                  <Settings size={16} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-blue-200">
                  Version Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                  <span className="text-blue-300/80 text-sm font-medium">
                    Package Version
                  </span>
                  <p className="text-blue-100 font-bold text-lg">
                    {versionInfo.packageVersion}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                  <span className="text-blue-300/80 text-sm font-medium">
                    Config Version
                  </span>
                  <p className="text-blue-100 font-bold text-lg">
                    {versionInfo.configVersion}
                  </p>
                </div>
              </div>
            </div>

            {/* Version Option */}
            <div className="mb-8 p-6 bg-white/5 rounded-xl border border-white/10">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLatestVersion}
                  onChange={handleUseLatestVersionChange}
                  className="mt-1 h-5 w-5 text-purple-600 focus:ring-purple-500 focus:ring-2 border-white/30 rounded bg-white/10 transition-all duration-200"
                />
                <div>
                  <span className="text-white font-medium">
                    Use latest version instead of {versionInfo.packageVersion}
                  </span>
                  <p className="mt-1 text-white/60 text-sm">
                    Check this if you want to automatically use the latest
                    available version.
                  </p>
                </div>
              </label>
            </div>

            {/* Release Metadata */}
            <div className="mb-8">
              <label className="block text-white font-semibold mb-3">
                Release Metadata (Optional)
              </label>
              <div className="relative">
                <textarea
                  value={metadata}
                  onChange={handleMetadataChange}
                  placeholder='Optional metadata as JSON, e.g. {"notes": "Bug fixes", "owner": "Jane Doe"}'
                  className={`w-full h-40 p-4 font-mono text-sm rounded-xl resize-none transition-all duration-200 bg-white/10 backdrop-blur-sm border text-white placeholder-white/40 ${
                    isValidJson
                      ? "border-white/20 focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/20"
                      : "border-red-400/50 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                  }`}
                />
                {errorMessage && (
                  <p className="mt-2 text-red-400 text-sm flex items-center">
                    <span className="w-4 h-4 bg-red-500 rounded-full mr-2 flex-shrink-0"></span>
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="mb-8 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 backdrop-blur-sm">
                <div className="flex items-center">
                  <span className="w-5 h-5 bg-red-500 rounded-full mr-3 flex-shrink-0"></span>
                  {error}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white/5 border-t border-white/10 px-8 py-6">
            <div className="flex justify-between space-x-4">
              <button
                onClick={onBack}
                className="px-6 py-3 text-white/80 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
                disabled={isSubmitting}
              >
                Back to Configuration
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-white/80 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRelease}
                  disabled={!isValidJson || isSubmitting}
                  className={`inline-flex items-center px-8 py-3 font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    isValidJson && !isSubmitting
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/20"
                      : "bg-white/10 text-white/40 cursor-not-allowed border border-white/10"
                  }`}
                >
                  <Save size={18} className="mr-2" />
                  {isSubmitting ? "Creating..." : "Create Release"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
