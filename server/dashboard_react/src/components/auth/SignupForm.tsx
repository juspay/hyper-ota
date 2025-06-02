import { useState } from "react";
import { Loader, AlertCircle, CheckCircle, User as UserIcon, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/axios"; // Adjusted path
import { IconEyeClosed } from "../icons/IconEyeClosed"; // Adjusted path
import { IconEyeOpen } from "../icons/IconEyeOpen"; // Adjusted path
import logoImage from '../../assets/hyperota-cube-logo.png';

interface SignupFormData {
  name: string;
  password: string;
  confirmPassword: string;
}

interface ErrorState {
  isError: boolean;
  message: string;
}

export const SignupForm: React.FC = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorState>({
    isError: false,
    message: "",
  });
  const [success, setSuccess] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError({ isError: true, message: "Passwords do not match" });
      setSuccess(false);
      return;
    }

    setIsLoading(true);
    setError({ isError: false, message: "" });
    setSuccess(false);

    try {
      const payload = {
        name: formData.name,
        password: formData.password,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data } = await axios.post("/users/create", payload);
      console.log(data)
      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard/login"); 
      }, 2000);
    } catch (err: any) {
      console.error("Signup error:", err);
      let errorMessage = "Registration failed. Please try again.";
      if (err.response?.status === 400 && err.response?.data?.Error === "User already Exists") {
        errorMessage = "Username already exists. Please choose another username.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setError({ isError: true, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (password: string): { strength: number; text: string; color: string } => {
    if (!password) return { strength: 0, text: "Enter password", color: "bg-slate-600" };
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^A-Za-z0-9]/)) strength += 1;

    const strengthMap = [
      { text: "Weak", color: "bg-red-500" },
      { text: "Fair", color: "bg-yellow-500" },
      { text: "Good", color: "bg-sky-500" },
      { text: "Strong", color: "bg-green-500" },
    ];
    return { strength, ...strengthMap[Math.min(strength, 3)] };
  };
  const passwordStatus = passwordStrength(formData.password);

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
        
        {/* Title Text - Protected from glow effects */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center relative z-30" style={{ isolation: 'isolate', mixBlendMode: 'normal' }}>Create Account</h2>
      </div>

      {error.isError && (
        <div className="mb-4 bg-red-900/60 border border-red-700 text-red-300 px-4 py-3 rounded-md relative flex items-center" role="alert">
          <AlertCircle size={20} className="mr-2 flex-shrink-0 text-red-400" />
          <span className="text-sm">{error.message}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-900/60 border border-green-700 text-green-300 px-4 py-3 rounded-md relative flex items-center" role="alert">
          <CheckCircle size={20} className="mr-2 flex-shrink-0 text-green-400" />
          <span className="text-sm">Account created successfully! Redirecting to login...</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-slate-400 mb-1">Username</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserIcon className="h-4 w-4 text-slate-500" />
            </div>
            <input id="name" name="name" type="text" autoComplete="username" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="appearance-none block w-full pl-9 pr-3 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Choose a username" />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="appearance-none block w-full pl-9 pr-10 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="••••••••" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none">
              {showPassword ? <IconEyeOpen size={18} /> : <IconEyeClosed size={18} />}
            </button>
          </div>
          {formData.password && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1 text-xs">
                <div className="text-slate-400">Password strength</div>
                <div className={`font-medium ${passwordStatus.strength === 0 ? 'text-slate-500' : passwordStatus.strength === 1 ? 'text-red-400' : passwordStatus.strength === 2 ? 'text-yellow-400' : passwordStatus.strength === 3 ? 'text-sky-400' : 'text-green-400'}`}>
                  {passwordStatus.text}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-1.5 ${passwordStatus.color}`} style={{ width: `${(passwordStatus.strength / 4) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-400 mb-1">Confirm Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="appearance-none block w-full pl-9 pr-10 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="••••••••" />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none">
              {showConfirmPassword ? <IconEyeOpen size={18} /> : <IconEyeClosed size={18} />}
            </button>
          </div>
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
          )}
        </div>
        
        <div>
          <button type="submit" disabled={isLoading || success}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? (<><Loader size={20} className="animate-spin mr-2" />Creating account...</>) : ("Create Account")}
          </button>
        </div>
      </form>

      <div className="mt-6 text-xs">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
          <div className="relative flex justify-center">
            <span className="px-2 bg-neutral-900 text-slate-500">Or continue with</span>
          </div>
        </div>
        <div className="mt-4">
          <button type="button"
            className="w-full inline-flex justify-center py-2.5 px-4 border border-slate-700 rounded-md shadow-sm bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-blue-500">
            Sign up with SSO
          </button>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <a href="/dashboard/login" className="font-medium text-blue-500 hover:text-blue-400">
          Sign In
        </a>
      </div>
    </>
  );
};
