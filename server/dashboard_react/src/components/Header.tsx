import { User, LogOut } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  userName: string;
  userEmail: string;
  onLogout?: () => void;
}

export default function Header({ userName, userEmail, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-indigo-800 text-white py-4 px-6 shadow-md">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hyper OTA</h1>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 bg-indigo-700 py-1 px-3 rounded-md hover:bg-indigo-600 transition-colors"
          >
            <User size={18} />
            <span className="text-sm font-medium">{userName}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
              <div className="py-1">
                <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                  Signed in as <span className="font-medium">{userEmail}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut size={16} className="mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
