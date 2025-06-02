import { User, LogOut } from "lucide-react";
import { useState } from "react";
import smallLogoImage from '../assets/hyperota-cube-logo2.png'; // Assuming this is the correct path

interface HeaderProps {
  userName: string;
  userEmail: string;
  onLogout: () => void; // Made required instead of optional
}

export default function Header({ userName, userEmail, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="bg-gradient-to-r from-slate-900 via-neutral-800 to-slate-900 text-slate-200 py-4 px-6 shadow-lg font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src={smallLogoImage} alt="HyperOTA Logo" className="w-7 h-7" />
          <h1 className="text-xl font-semibold">HyperOTA</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 py-2 px-3 rounded-md transition-colors min-w-[120px]"
          >
            <User size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium truncate">{userName}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5">
              <div className="py-1">
                <div className="px-4 py-3 text-sm text-slate-400 border-b border-slate-700">
                  <p className="truncate">Signed in as</p>
                  <p className="font-medium text-slate-200 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="flex items-center w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                >
                  <LogOut  size={16} className="mr-3" />
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
