import { useState } from "react";
import { Upload, Save, FileUp, X } from "lucide-react";
import { Application, Organisation } from "../../types";
import axios from "../../api/axios";

interface UploadPackageProps {
  application: Application;
  organization: Organisation;
  onClose: () => void;
  onSuccess: (packageVersion: number) => void;
}

export default function UploadPackage({
  application,
  organization,
  onClose,
  onSuccess,
}: UploadPackageProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [isValidJson, setIsValidJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Please enter JSON data");
  const [indexFile, setIndexFile] = useState<File | null>(null);
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

      // Validate required package fields
      if (!parsed.package?.name || !parsed.package?.version) {
        setIsValidJson(false);
        setErrorMessage("Missing required package fields in JSON");
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

  const handleSubmitPackage = async () => {
    if (!isValidJson || !jsonInput) return;

    try {
      setIsSubmitting(true);
      setUploadError("");

      // Parse and extract only the package part
      const packageData = JSON.parse(jsonInput);

      const headers = {
        "x-organisation": organization.name,
        "x-application": application.application,
      };

      let response;

      // If there's an index file, use multipart form
      if (indexFile) {
        const formData = new FormData();
        formData.append("json", JSON.stringify(packageData));
        formData.append("index", indexFile);

        response = await axios.post(
          "/organisations/applications/package/create_package_json_v1_multipart",
          formData,
          { headers }
        );
      } else {
        // Use JSON endpoint if no file is uploaded
        response = await axios.post(
          "/organisations/applications/package/create_package_json_v1",
          packageData,
          { headers }
        );
      }

      // Call onSuccess with the package version returned
      onSuccess(response.data.version);
    } catch (error: any) {
      console.error(error);
      setUploadError(
        error.response?.data?.message ||
          "Error uploading package. Please try again."
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

  const handleIndexFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit
        setUploadError("Index file size should be less than 50MB");
        return;
      }
      setIndexFile(file);
      setUploadError("");
    }
  };

  const removeIndexFile = () => {
    setIndexFile(null);
    setUploadError("");
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 border w-3/4 max-w-6xl shadow-lg rounded-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Step 1: Upload Package for {application?.application}
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

        {/* Main Content */}
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="flex items-center space-x-4">
            {/* JSON File Upload */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Package JSON
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="json-upload"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="json-upload"
                  className="inline-flex items-center w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <Upload size={16} className="mr-2" />
                  Upload Package JSON
                </label>
              </div>
            </div>

            {/* Index File Upload */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Index File (Optional)
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="index-upload"
                  onChange={handleIndexFileUpload}
                  className="hidden"
                />
                {indexFile ? (
                  <div className="flex items-center justify-between w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-md">
                    <span className="truncate">{indexFile.name}</span>
                    <button
                      onClick={removeIndexFile}
                      className="ml-2 text-gray-400 hover:text-gray-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="index-upload"
                    className="inline-flex items-center w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <FileUp size={16} className="mr-2" />
                    Upload Index File
                  </label>
                )}
              </div>
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>
          </div>

          {/* JSON Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Package JSON
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
                placeholder='Enter package data, e.g. {"package": {"name": "my-app", "version": "1.0.0", ...}, "resources": {}}'
              />
              {errorMessage && (
                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPackage}
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
              {isSubmitting ? "Uploading..." : "Upload Package & Continue"}
            </button>
          </div>

          {/* JSON Example - Collapsible */}
          <div className="mt-4 bg-gray-50 rounded-lg">
            <details>
              <summary className="px-4 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                Package JSON Format Example
              </summary>
              <pre className="p-4 text-xs text-gray-600 overflow-x-auto">
                {`{
  "package": {
    "name": "hyperpay",
    "version": "1.0.0",
    "properties": {
      "manifest": {},
      "manifest_hash": {}
    },
    "index": "https://assets.juspay.in/juspay/hyper-os/in.juspay.hyperos/release/2.0rc1/3.6.21/v1-boot_loader.zip",
    "splits": []
  },
  "resources": {}
}`}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
