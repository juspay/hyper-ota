import { useState } from "react";
import { Search, Plus, Mail, User, Users } from "lucide-react";
import { Organisation } from "../../types";

interface UserManagementProps {
  organization: Organisation;
  onInviteUser: (email: string, role: string) => void;
}

export default function UserManagement({
  organization,
  onInviteUser,
}: UserManagementProps) {
  const [activeTab, setActiveTab] = useState<"members" | "invite">("members");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "READ" | "WRITE">(
    "READ"
  );

  const handleInviteUser = () => {
    if (inviteEmail.trim()) {
      onInviteUser(inviteEmail.trim(), selectedRole);
      setInviteEmail("");
      setActiveTab("members");
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {activeTab === "members" ? "Organisation Members" : "Invite Users"}
        </h2>
        <span className="text-sm text-gray-500 ml-2">
          ({organization.name})
        </span>
      </div>

      {/* Members Tab Content */}
      {activeTab === "members" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="relative flex-grow">
                <Search
                  size={16}
                  className="absolute left-3 top-2.5 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
              <button
                className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                onClick={() => setActiveTab("invite")}
              >
                <Plus size={16} className="mr-1" />
                Invite User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organization.users &&
                  (userSearchQuery.length > 0
                    ? organization.users.filter(
                        (u) =>
                          u.username
                            .toLowerCase()
                            .includes(userSearchQuery.toLowerCase()) ||
                          u.email
                            .toLowerCase()
                            .includes(userSearchQuery.toLowerCase())
                      )
                    : organization.users
                  ).map((orgUser) => (
                    <tr key={orgUser.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                            {orgUser?.username?.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {orgUser.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {orgUser.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            orgUser?.role?.includes("admin")
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {orgUser.role}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {(!organization.users || organization.users.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No users found in this organization
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Users Tab Content */}
      {activeTab === "invite" && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium mb-6 text-gray-700">
            Invite Users to {organization.name}
          </h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  id="email"
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-12 py-2 sm:text-sm border-gray-300 rounded-md"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <div className="flex space-x-4 mt-1">
                <button
                  type="button"
                  className={`flex items-center px-4 py-2 border rounded-md ${
                    selectedRole === "READ"
                      ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                      : "border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setSelectedRole("READ")}
                >
                  <User size={16} className="mr-2" />
                  Member
                </button>
                <button
                  type="button"
                  className={`flex items-center px-4 py-2 border rounded-md ${
                    selectedRole === "ADMIN"
                      ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                      : "border-gray-300 text-gray-700"
                  }`}
                  onClick={() => setSelectedRole("ADMIN")}
                >
                  <Users size={16} className="mr-2" />
                  Admin
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {selectedRole === "ADMIN"
                  ? "Admins can manage applications, invite users, and modify organization settings."
                  : "Members can view and use applications but cannot modify organization settings."}
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleInviteUser}
                disabled={inviteEmail.trim() === ""}
                className={`px-4 py-2 rounded-md font-medium ${
                  inviteEmail.trim() !== ""
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                Send Invitation
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className="ml-4 px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
