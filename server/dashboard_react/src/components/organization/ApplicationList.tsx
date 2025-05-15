import { AppWindow, Plus, ChevronRight } from "lucide-react";
import { Application, Organisation } from "../../types";

interface ApplicationListProps {
  organization: Organisation;
  selectedApp: Application | null;
  onAppSelect: (app: Application) => void;
  onCreateApp: () => void;
  onUserManagement: () => void;
  showUserManagement: boolean;
}

export default function ApplicationList({
  organization,
  selectedApp,
  onAppSelect,
  onCreateApp,
  onUserManagement,
  showUserManagement,
}: ApplicationListProps) {
  return (
    <div className="w-64 bg-indigo-600 text-white border-r border-indigo-500 flex flex-col">
      <div className="p-4 border-b border-indigo-500 flex items-center justify-between">
        <h2 className="font-medium">{organization.name}</h2>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-indigo-500">
        <button
          className={`flex-1 py-2 text-center text-sm font-medium ${
            !showUserManagement ? "bg-indigo-700" : ""
          }`}
          onClick={() => onUserManagement()}
        >
          Applications
        </button>
        <button
          className={`flex-1 py-2 text-center text-sm font-medium ${
            showUserManagement ? "bg-indigo-700" : ""
          }`}
          onClick={onUserManagement}
        >
          Users
        </button>
      </div>

      {/* Applications List */}
      {!showUserManagement && (
        <>
          <div className="flex-1 overflow-y-auto">
            {organization.applications.map((app) => (
              <button
                key={app.id}
                onClick={() => onAppSelect(app)}
                className={`w-full text-left p-3 flex items-center hover:bg-indigo-500 transition-colors ${
                  selectedApp?.id === app.id ? "bg-indigo-700" : ""
                }`}
              >
                <AppWindow size={18} className="mr-2 opacity-80" />
                <span className="truncate">{app.application}</span>
                {selectedApp?.id === app.id && (
                  <ChevronRight size={16} className="ml-auto" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={onCreateApp}
            className="p-3 flex items-center hover:bg-indigo-500 transition-colors border-t border-indigo-500"
          >
            <Plus size={18} className="mr-2" />
            <span>Add application</span>
          </button>
        </>
      )}
    </div>
  );
}
