import { useState } from "react";
import { Upload, Save, X, Settings } from "lucide-react";
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
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 w-3/4 max-w-6xl">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                <Settings size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Upload Configuration
                </h2>
                <p className="text-white/70">
                  Step 2: Upload Configuration for {application?.application}
                </p>
              </div>
              <span className="px-4 py-2 text-sm bg-gradient-to-r from-purple-400/20 to-pink-400/20 text-purple-200 rounded-full border border-purple-300/30">
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

          {/* Package Version Info */}
          <div className="mx-8 mb-6 p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-xl backdrop-blur-sm">
            <div className="flex items-center text-blue-200">
              <span className="font-medium">Package Version: </span>
              <span className="ml-2 font-bold">{packageVersion}</span>
            </div>
            <p className="mt-1 text-sm text-blue-300/80">
              This configuration will be associated with package version{" "}
              {packageVersion}.
            </p>
          </div>

          {/* Main Content */}
          <div className="px-8 pb-8 space-y-6">
            {/* File Upload Section */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <label className="block text-sm font-medium text-white/90 mb-3">
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
                  className="inline-flex items-center px-6 py-3 text-sm bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 cursor-pointer transition-all duration-200 text-white/90"
                >
                  <Upload size={16} className="mr-2 text-cyan-400" />
                  Upload Configuration JSON
                </label>
              </div>
            </div>

            {/* JSON Editor */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-white/90">
                  Configuration JSON
                </label>
              </div>
              <div className="relative">
                <textarea
                  value={jsonInput}
                  onChange={handleJsonChange}
                  className={`w-full h-96 p-4 font-mono text-sm rounded-xl resize-none bg-black/30 text-white placeholder-white/50 border transition-all duration-200 ${
                    isValidJson
                      ? "border-white/20 focus:border-purple-400/50 focus:ring-2 focus:ring-purple-400/20"
                      : "border-red-400/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  }`}
                  placeholder='Enter configuration data, e.g. {"config": {"version": "1.0", "release_config_timeout": 1000, "package_timeout": 1000, ...}}'
                />
                {errorMessage && (
                  <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
                )}
                {uploadError && (
                  <p className="mt-2 text-sm text-red-400">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between space-x-4 pt-6 border-t border-white/20">
              <button
                onClick={onBack}
                className="px-6 py-3 text-sm font-medium text-white/90 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                disabled={isSubmitting}
              >
                Back to Package
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-sm font-medium text-white/90 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitConfig}
                  disabled={!isValidJson || !jsonInput || isSubmitting}
                  className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isValidJson && jsonInput && !isSubmitting
                      ? "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25"
                      : "bg-white/5 text-white/40 cursor-not-allowed border border-white/10"
                  }`}
                >
                  <Save size={16} className="mr-2" />
                  {isSubmitting ? "Uploading..." : "Upload Config & Continue"}
                </button>
              </div>
            </div>

            {/* JSON Example - Collapsible */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <details>
                <summary className="px-6 py-4 text-sm font-medium text-white/90 cursor-pointer hover:bg-white/10 transition-colors duration-200 rounded-xl">
                  Configuration JSON Format Example
                </summary>
                <div className="px-6 pb-6">
                  <pre className="p-4 text-xs text-white/70 overflow-x-auto bg-black/30 rounded-lg border border-white/10">
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
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
