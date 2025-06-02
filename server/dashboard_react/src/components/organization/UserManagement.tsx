import { useState } from "react";
import {
  Search,
  Plus,
  Mail,
  Users,
  UserPlus,
  Crown,
  Shield,
  ArrowLeft,
} from "lucide-react";
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

  const getRoleColor = (role: string) => {
    if (role?.toLowerCase().includes("admin")) {
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    }
    return "bg-green-500/20 text-green-400 border-green-500/30";
  };

  const getRoleIcon = (role: string) => {
    if (role?.toLowerCase().includes("admin")) {
      return <Crown size={14} className="mr-1" />;
    }
    return <Shield size={14} className="mr-1" />;
  };

  const filteredUsers =
    organization.users && userSearchQuery.length > 0
      ? organization.users.filter(
          (u) =>
            u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
        )
      : organization.users;

  return (
    <div>
      {/* Members Tab Content */}
      {activeTab === "members" && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
          {/* Header */}
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  Team Members
                </h3>
                <p className="text-white/60 text-sm">
                  Manage organization access and permissions
                </p>
              </div>
              <button
                onClick={() => setActiveTab("invite")}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
              >
                <Plus size={18} className="mr-2" />
                Invite User
              </button>
            </div>

            {/* Search */}
            <div className="mt-6">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50"
                />
                <input
                  type="text"
                  placeholder="Search members..."
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="p-6">
            {filteredUsers && filteredUsers.length > 0 ? (
              <div className="space-y-4">
                {filteredUsers.map((orgUser) => (
                  <div
                    key={orgUser.id}
                    className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mr-4 text-white font-bold text-lg">
                          {orgUser?.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-lg">
                            {orgUser.username || "Unknown User"}
                          </h4>
                          <p className="text-white/60 text-sm">
                            {orgUser.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <div
                          className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center ${getRoleColor(
                            orgUser?.role?.[0] || "Member"
                          )}`}
                        >
                          {getRoleIcon(orgUser?.role?.[0] || "Member")}
                          {orgUser.role || "Member"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users size={32} className="text-white/40" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No Team Members
                </h3>
                <p className="text-white/60 mb-6 max-w-md mx-auto">
                  {userSearchQuery
                    ? "No members found matching your search."
                    : "Invite team members to collaborate on your applications."}
                </p>
                {!userSearchQuery && (
                  <button
                    onClick={() => setActiveTab("invite")}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
                  >
                    Invite First Member
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Users Tab Content */}
      {activeTab === "invite" && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => setActiveTab("members")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 mr-4"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h3 className="text-2xl font-bold text-white">
                Invite Team Member
              </h3>
              <p className="text-white/60">
                Add new members to {organization.name}
              </p>
            </div>
          </div>

          {/* Invite Form */}
          <div className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={20}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50"
                />
                <input
                  type="email"
                  placeholder="user@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Role & Permissions
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  className={`p-6 rounded-xl border transition-all duration-300 text-left ${
                    selectedRole === "READ"
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedRole("READ")}
                >
                  <div className="flex items-center mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        selectedRole === "READ"
                          ? "bg-gradient-to-r from-blue-400 to-purple-500"
                          : "bg-white/10"
                      }`}
                    >
                      <Shield size={20} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-white">Member</h4>
                  </div>
                  <p className="text-white/60 text-sm">
                    Can view and use applications but cannot modify organization
                    settings.
                  </p>
                </button>

                <button
                  type="button"
                  className={`p-6 rounded-xl border transition-all duration-300 text-left ${
                    selectedRole === "ADMIN"
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedRole("ADMIN")}
                >
                  <div className="flex items-center mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        selectedRole === "ADMIN"
                          ? "bg-gradient-to-r from-blue-400 to-purple-500"
                          : "bg-white/10"
                      }`}
                    >
                      <Crown size={20} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-white">Admin</h4>
                  </div>
                  <p className="text-white/60 text-sm">
                    Can manage applications, invite users, and modify organization
                    settings.
                  </p>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={() => setActiveTab("members")}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-300 border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={!inviteEmail.trim()}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
                  inviteEmail.trim()
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white hover:scale-105 shadow-lg shadow-blue-500/20"
                    : "bg-white/5 text-white/40 cursor-not-allowed border border-white/10"
                }`}
              >
                <div className="flex items-center justify-center">
                  <UserPlus size={18} className="mr-2" />
                  Send Invitation
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
