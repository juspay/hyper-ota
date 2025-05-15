import { Organisation } from "../../types";

interface CreateApplicationProps {
  organization: Organisation;
  newAppName: string;
  onAppNameChange: (name: string) => void;
  onCreateApp: () => void;
  setIsCreatingApp: (isCreatingApp: boolean) => void;
}

export default function CreateApplication({
  organization,
  newAppName,
  onAppNameChange,
  onCreateApp,
  setIsCreatingApp,
}: CreateApplicationProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="p-6 bg-white rounded-lg shadow-lg max-w-md w-full m-4 relative">
        <h2 className="text-xl font-semibold mb-6">Create Application</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Organisation: {organization.name}
          </label>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="applicationName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Application Name
              </label>
              <input
                id="applicationName"
                type="text"
                value={newAppName}
                onChange={(e) => onAppNameChange(e.target.value)}
                placeholder="Enter application name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md 
                         focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                         placeholder-gray-400"
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsCreatingApp(false)}
                className="px-4 py-2 rounded-md font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={onCreateApp}
                disabled={!newAppName.trim()}
                className={`px-4 py-2 rounded-md font-medium
                          transition-colors duration-200 ease-in-out
                          ${
                            newAppName.trim()
                              ? "bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
              >
                Create Application
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
