import { FolderIcon, Plus, ChevronRight, Trash2 } from "lucide-react";
import { Organisation, Application } from "../../types";
import { useState } from "react";
// Note: You need to create the AuthContext if it doesn't exist
// For now, we'll mock this functionality
// import { useAuth } from "../../contexts/AuthContext";
// import { toast } from "react-hot-toast";
import axios from "../../api/axios";

interface OrganizationListProps {
  organizations: Organisation[];
  selectedOrg: Organisation | null;
  selectedApp: Application | null;
  onOrgSelect: (org: Organisation) => void;
  onAppSelect: (app: Application | null) => void;
  onCreateOrg: () => void;
  onCreateApp: () => void;
  refreshOrgs?: () => void;
  onOrganizationsUpdated?: (orgs: Organisation[]) => void;
}

export default function OrganizationList({
  organizations,
  selectedOrg,
  onOrgSelect,
  onCreateOrg,
  refreshOrgs,
  onOrganizationsUpdated,
}: OrganizationListProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleOrgClick = (org: Organisation) => {
    onOrgSelect(org);
  };

  // New function to refresh organizations directly using the API
  const refreshOrganizations = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const { data } = await axios.get<Organisation[]>("/organisations");

      // If callback is provided, update parent component state
      if (onOrganizationsUpdated) {
        onOrganizationsUpdated(data);
      } else if (refreshOrgs) {
        // Fall back to the provided refreshOrgs function
        refreshOrgs();
      }
    } catch (error: any) {
      console.error("Failed to refresh organizations:", error);
      alert(error.response?.data?.Error || "Failed to refresh organizations");
    } finally {
      setIsRefreshing(false);
    }
  };

  const deleteOrganization = async (orgName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the org when clicking delete

    if (
      !window.confirm(
        `Are you sure you want to delete ${orgName}? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(orgName);

    try {
      await axios.delete(`/organisations/${orgName}`, {
        headers: {
          "x-organisation": orgName,
        },
      });

      alert("Organization deleted successfully");

      // Use the new function to refresh organizations
      await refreshOrganizations();

      // If the deleted org was selected, clear the selection
      if (selectedOrg?.name === orgName) {
        onOrgSelect(null as unknown as Organisation);
      }
    } catch (error: any) {
      // Replace with your notification system
      alert(error.response?.data?.Error || "Failed to delete organization");
      console.error("Delete organization error:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  // Function to check if user is admin of an organization
  // For demo purposes, we'll return true to show delete buttons
  // Replace with your actual admin check logic
  const isOrgAdmin = () => {
    // In a real app, you would check user permissions here
    // return user?.accessLevels?.[orgName]?.level >= 3; // Admin level is 3 or higher
    return true; // For demo purposes, show delete button for all orgs
  };

  return (
    <div className="w-64 bg-indigo-700 text-white border-r border-indigo-600 flex flex-col">
      <div className="p-4 border-b border-indigo-600 flex items-center justify-between">
        <h2 className="font-medium">Organisations</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {organizations.map((org) => (
          <div key={org.name} className="border-b border-indigo-600">
            <button
              onClick={() => handleOrgClick(org)}
              className={`w-full text-left p-3 flex items-center hover:bg-indigo-600 transition-colors ${
                selectedOrg?.name === org.name ? "bg-indigo-800" : ""
              }`}
            >
              <FolderIcon size={18} className="mr-2 opacity-80" />
              <span className="truncate flex-1">{org.name}</span>
              {isOrgAdmin() && (
                <Trash2
                  size={16}
                  className={`mr-2 text-red-300 hover:text-red-100 cursor-pointer ${
                    isDeleting === org.name ? "opacity-50" : ""
                  }`}
                  onClick={(e) => deleteOrganization(org.name, e)}
                  // The disabled attribute isn't valid for SVG elements
                  style={{
                    pointerEvents: isDeleting === org.name ? "none" : "auto",
                  }}
                />
              )}
              <ChevronRight size={16} className="ml-auto" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onCreateOrg}
        className="p-3 flex items-center hover:bg-indigo-600 transition-colors border-t border-indigo-600"
      >
        <Plus size={18} className="mr-2" />
        <span>Add organisation</span>
      </button>
    </div>
  );
}
