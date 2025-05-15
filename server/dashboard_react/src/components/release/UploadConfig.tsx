import { useState } from "react";
import { Upload, Save, X } from "lucide-react";
import { Application, Organisation } from "../../types";
import axios from "../../api/axios";

interface UploadConfigProps {
  application: Application;
  organization: Organisation;
  packageVersion: number;
  onClose: () => void;
  onBack: () => void;
  onSuccess: (versionInfo: { version: number; config_version: string }) => void;
}

export default function UploadConfig({
  application,
  organization,
  packageVersion,
  onClose,
  onBack,
  onSuccess,
}: UploadConfigProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [isValidJson, setIsValidJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Please enter JSON data");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setJsonInput(value);
    validateJson(value);
  };

  const validateJson = (value: string) => {
    try {
      if (!value) {
        setIsValidJson(false);
        setErrorMessage("Please enter JSON data");
        return false;
      }
      const parsed = JSON.parse(value);

      // Validate required config fields
      if (
        !parsed.config?.version ||
        typeof parsed.config?.release_config_timeout !== "number" ||
        typeof parsed.config?.package_timeout !== "number"
      ) {
        setIsValidJson(false);
        setErrorMessage("Missing required configuration fields in JSON");
        return false;
      }

      setIsValidJson(true);
      setErrorMessage("");
      return true;
    } catch (error) {
      console.error(error);
      setIsValidJson(false);
      setErrorMessage("Invalid JSON format");
      return false;
    }
  };

  const handleSubmitConfig = async () => {
    if (!isValidJson || !jsonInput) return;

    try {
      setIsSubmitting(true);
      setUploadError("");

      const configData = JSON.parse(jsonInput);

      const headers = {
        "x-organisation": organization.name,
        "x-application": application.application,
      };

      const response = await axios.post(
        "/organisations/applications/config/create_json_v1",
        configData,
        { headers }
      );

      // Call onSuccess with the version info
      onSuccess({
        version: response.data.version,
        config_version: response.data.config_version,
      });
    } catch (error: any) {
      console.error(error);
      setUploadError(
        error.response?.data?.message ||
          "Error uploading configuration. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setErrorMessage("JSON file size should be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          setJsonInput(content);
          validateJson(content);
        } catch (error) {
          console.error(error);
          setIsValidJson(false);
          setErrorMessage("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 border w-3/4 max-w-6xl shadow-lg rounded-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Step 2: Upload Configuration for {application?.application}
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

        {/* Package Version Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center text-blue-700">
            <span className="font-medium">Package Version: </span>
            <span className="ml-2">{packageVersion}</span>
          </div>
          <p className="mt-1 text-sm text-blue-600">
            This configuration will be associated with package version{" "}
            {packageVersion}.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Configuration JSON
            </label>
            <div className="relative">
              <input
                type="file"
                id="config-json-upload"
                accept=".json"
                onChange={handleJsonFileUpload}
                className="hidden"
              />
              <label
                htmlFor="config-json-upload"
                className="inline-flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <Upload size={16} className="mr-2" />
                Upload Configuration JSON
              </label>
            </div>
          </div>

          {/* JSON Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Configuration JSON
              </label>
            </div>
            <div className="relative">
              <textarea
                value={jsonInput}
                onChange={handleJsonChange}
                className={`w-full h-96 p-4 font-mono text-sm border rounded-lg resize-none ${
                  isValidJson
                    ? "border-gray-300 focus:ring-2 focus:ring-purple-500"
                    : "border-red-300 focus:ring-2 focus:ring-red-500"
                }`}
                placeholder='Enter configuration data, e.g. {"config": {"version": "1.0", "release_config_timeout": 1000, "package_timeout": 1000, ...}}'
              />
              {errorMessage && (
                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              )}
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between space-x-4 pt-4 border-t border-gray-200">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Back to Package
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
                onClick={handleSubmitConfig}
                disabled={!isValidJson || !jsonInput || isSubmitting}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                  ${
                    isValidJson && jsonInput && !isSubmitting
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                <Save size={16} className="mr-2" />
                {isSubmitting ? "Uploading..." : "Upload Config & Continue"}
              </button>
            </div>
          </div>

          {/* JSON Example - Collapsible */}
          <div className="mt-4 bg-gray-50 rounded-lg">
            <details>
              <summary className="px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                Configuration JSON Format Example
              </summary>
              <pre className="p-4 text-xs text-gray-600 overflow-x-auto">
                {`{
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "package_timeout": 1000,
    "properties": {
      "tenant_info": {
        "assets_domain": "https://assets.example.com",
        "default_client_id": "client123"
      }
    }
  },
  "tenant_info": {
    "assets_domain": "https://assets.example.com",
    "default_client_id": "client123"
  },
  "properties": {}
}`}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
