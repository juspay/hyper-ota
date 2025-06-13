import { useState, useEffect, useRef } from "react";
import { Loader, AlertCircle, User as UserIcon, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { User } from "../../types"; // Adjusted path
import axios from "../../api/axios"; // Adjusted path
import { IconEyeClosed } from "../icons/IconEyeClosed"; // Adjusted path
import { IconEyeOpen } from "../icons/IconEyeOpen"; // Adjusted path
import logoImage from '../../assets/hyperota-cube-logo.png';

interface LoginFormProps {
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUser: (user: User) => void;
}

interface LoginFormData {
  name: string;
  password: string;
}

interface ErrorState {
  isError: boolean;
  message: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ setIsAuthenticated, setUser }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    name: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState>({
    isError: false,
    message: "",
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError({ isError: false, message: "" });

    try {
      const { data } = await axios.post("/users/login", formData);
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("userToken", data.user_token.access_token);
      storage.setItem("userData", JSON.stringify(data));

      setIsAuthenticated(true);
      setUser(data);
      navigate("/dashboard", {
        replace: true,
      });
    } catch (err: any) {
      console.error("Login error:", err);
      setError({
        isError: true,
        message:
          err.response?.data?.message ||
          "Authentication failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError({ isError: false, message: "" });

    try {
      // Get the OAuth URL from the backend
      const { data } = await axios.get("/users/oauth/url");
      
      // Store the current location and callback handler
      localStorage.setItem("oauthRedirect", window.location.pathname);
      localStorage.setItem("rememberMe", rememberMe.toString());
      
      // Modify the auth URL to use the correct frontend redirect URI
      const currentOrigin = window.location.origin; // e.g., http://localhost:5173
      const correctedAuthUrl = data.auth_url.replace(
        /redirect_uri=[^&]+/, 
        `redirect_uri=${encodeURIComponent(currentOrigin + '/dashboard/login')}`
      );
      
      console.log("Original auth URL:", data.auth_url);
      console.log("Corrected auth URL:", correctedAuthUrl);
      
      // Redirect to Google OAuth
      window.location.href = correctedAuthUrl;
    } catch (err: any) {
      console.error("Google OAuth error:", err);
      setError({
        isError: true,
        message: "Failed to initiate Google login. Please try again.",
      });
      setIsGoogleLoading(false);
    }
  };

  // Add a ref to track if we've processed the code
  const processedCode = useRef(false);

  // Handle OAuth callback when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    // Only process the code if we haven't already
    if (code && !processedCode.current) {
      processedCode.current = true;
      handleOAuthCallback(code, state);
    }
  }, []);

  const handleOAuthCallback = async (code: string, state: string | null) => {
    setIsLoading(true);
    setError({ isError: false, message: "" });

    try {
      // Check if this is a signup or login action
      const oauthAction = localStorage.getItem("oauthAction") || "login";
      
      // Determine the correct endpoint based on the action
      const endpoint = oauthAction === "signup" 
        ? "/users/oauth/signup" 
        : "/users/oauth/login";
      
      console.log(`Processing OAuth ${oauthAction} with endpoint: ${endpoint}`);

      const { data } = await axios.post(endpoint, {
        code,
        state,
      });

      const rememberMeStored = localStorage.getItem("rememberMe") === "true";
      const storage = rememberMeStored ? localStorage : sessionStorage;
      
      storage.setItem("userToken", data.user_token.access_token);
      storage.setItem("userData", JSON.stringify(data));

      // Clean up OAuth params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Clean up stored values
      localStorage.removeItem("oauthRedirect");
      localStorage.removeItem("rememberMe");
      localStorage.removeItem("oauthAction");

      setIsAuthenticated(true);
      setUser(data);
      navigate("/dashboard", {
        replace: true,
      });
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      const action = localStorage.getItem("oauthAction") || "login";
      setError({
        isError: true,
        message: `Google ${action} failed. Please try again.`,
      });
      // Clean up URL params on error
      window.history.replaceState({}, document.title, window.location.pathname);
      // Clean up stored values on error
      localStorage.removeItem("oauthAction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center mb-6">
        {/* Enhanced Logo with Animated Glow Effect - Isolated Container */}
        <div className="relative flex items-center justify-center mb-3 h-20 w-20 sm:h-24 sm:w-24" style={{ isolation: 'isolate' }}> {/* Added size to parent for absolute children */}
          {/* Outer glow - largest and most diffuse with breathing animation */}
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 blur-xl animate-glow-breathe opacity-60"
            style={{ animationDelay: '0s' }} // Explicit delay for clarity
          ></div>
          
          {/* Middle glow - medium size with offset breathing */}
          <div 
            className="absolute inset-0 w-[90%] h-[90%] m-auto rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 blur-lg animate-glow-breathe opacity-80"
            style={{ animationDelay: '0.5s' }}
          ></div>
          
          {/* Inner glow - tighter around logo with subtle pulse */}
          <div 
            className="absolute inset-0 w-[80%] h-[80%] m-auto rounded-full bg-blue-400 blur-md animate-glow-breathe opacity-40"
            style={{ animationDelay: '1s' }}
          ></div>
          
          {/* Logo with subtle float animation */}
          <img 
            src={logoImage} 
            alt="HyperOTA Logo" 
            className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-lg relative z-20 animate-logo-float"
          />
          
          {/* Rotating sparkle effect */}
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm animate-sparkle-rotate opacity-30"
          ></div>
        </div>
        
        {/* HyperOTA Text - Protected from glow effects */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center relative z-30" style={{ isolation: 'isolate', mixBlendMode: 'normal' }}>HyperOTA</h2>
      </div>

      {error.isError && (
        <div
          className="mb-4 bg-red-900/60 border border-red-700 text-red-300 px-4 py-3 rounded-md relative flex items-center"
          role="alert"
        >
          <AlertCircle size={20} className="mr-2 flex-shrink-0 text-red-400" />
          <span className="text-sm">{error.message}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-medium text-slate-400 mb-1"
          >
            Username
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserIcon className="h-4 w-4 text-slate-500" />
            </div>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="username"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="appearance-none block w-full pl-9 pr-3 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter your username"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-400 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="appearance-none block w-full pl-9 pr-10 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <IconEyeOpen size={18} /> : <IconEyeClosed size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-3.5 w-3.5 text-blue-500 focus:ring-blue-600 border-slate-600 rounded bg-slate-700"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block text-slate-400"
            >
              Remember me
            </label>
          </div>
          <a
            href="#"
            className="font-medium text-blue-500 hover:text-blue-400"
          >
            Forgot your password?
          </a>
        </div>

        <div>
          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader size={20} className="animate-spin mr-2" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 text-xs">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 bg-neutral-900 text-slate-500"> 
              Or continue with
            </span>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isGoogleLoading}
            className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <Loader size={18} className="animate-spin mr-2" />
                Connecting to Google...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        Don't have an account?{' '}
        <a
          href="/dashboard/signup"
          className="font-medium text-blue-500 hover:text-blue-400"
        >
          Request access
        </a>
      </div>
    </>
  );
};
