import { useState } from "react";
import { Save, X } from "lucide-react";
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
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 border w-3/4 max-w-6xl shadow-lg rounded-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Step 3: Create Release for {application?.application}
            </h2>
            <span className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full">
              {organization.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Close</span>
            <X size={24} />
          </button>
        </div>

        {/* Version Information */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center text-blue-700 mb-2">
            <span className="font-medium">Package Version: </span>
            <span className="ml-2">{versionInfo.packageVersion}</span>
          </div>
          <div className="flex items-center text-blue-700">
            <span className="font-medium">Config Version: </span>
            <span className="ml-2">{versionInfo.configVersion}</span>
          </div>
        </div>

        {/* Version Option */}
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useLatestVersion}
              onChange={handleUseLatestVersionChange}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-gray-700">
              Use latest version instead of {versionInfo.packageVersion}
            </span>
          </label>
          <p className="mt-1 text-sm text-gray-500">
            Check this if you want to automatically use the latest available
            version.
          </p>
        </div>

        {/* Release Metadata */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Release Metadata (Optional)
          </label>
          <textarea
            value={metadata}
            onChange={handleMetadataChange}
            placeholder='Optional metadata as JSON, e.g. {"notes": "Bug fixes", "owner": "Jane Doe"}'
            className={`w-full h-36 p-4 font-mono text-sm border rounded-lg resize-none ${
              isValidJson
                ? "border-gray-300 focus:ring-2 focus:ring-purple-500"
                : "border-red-300 focus:ring-2 focus:ring-red-500"
            }`}
          />
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between space-x-4 pt-4 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Back to Configuration
          </button>

          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRelease}
              disabled={!isValidJson || isSubmitting}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                ${
                  isValidJson && !isSubmitting
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <Save size={16} className="mr-2" />
              {isSubmitting ? "Creating..." : "Create Release"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
