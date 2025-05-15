import { useState } from "react";
import { Package, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";

interface SignupFormData {
  name: string;
  password: string;
  confirmPassword: string;
}

interface ErrorState {
  isError: boolean;
  message: string;
}

export const Signup = () => {
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
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Form validation
    if (formData.password !== formData.confirmPassword) {
      setError({ isError: true, message: "Passwords do not match" });
      return;
    }

    // if (formData.password.length < 8) {
    //   setError({ isError: true, message: 'Password must be at least 8 characters long' });
    //   return;
    // }

    setIsLoading(true);
    setError({ isError: false, message: "" });

    try {
      const { data } = await axios.post("/users/create", {
        name: formData.name,
        password: formData.password,
      });

      // Set success state
      setSuccess(true);

      // Save token
      sessionStorage.setItem("userToken", data.user_token.access_token);
      sessionStorage.setItem("userData", JSON.stringify(data));

      // Navigate to dashboard after short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "Registration failed. Please try again.";

      if (
        error.response?.status === 400 &&
        error.response?.data?.Error === "User already Exists"
      ) {
        errorMessage =
          "Username already exists. Please choose another username.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setError({
        isError: true,
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (
    password: string
  ): { strength: number; text: string; color: string } => {
    if (!password)
      return { strength: 0, text: "No password", color: "bg-gray-200" };

    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.match(/[A-Z]/)) strength += 1;
    if (password.match(/[0-9]/)) strength += 1;
    if (password.match(/[^A-Za-z0-9]/)) strength += 1;

    const strengthMap = [
      { text: "Weak", color: "bg-red-500" },
      { text: "Fair", color: "bg-yellow-500" },
      { text: "Good", color: "bg-blue-500" },
      { text: "Strong", color: "bg-green-500" },
    ];

    return {
      strength,
      ...strengthMap[Math.min(strength, 3)],
    };
  };

  const passwordStatus = passwordStrength(formData.password);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-blue-600 rounded-full p-3">
            <Package size={28} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create an account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join PackageOTA Manager for your organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error.isError && (
            <div
              className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative flex items-center"
              role="alert"
            >
              <AlertCircle size={16} className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {success && (
            <div
              className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative flex items-center"
              role="alert"
            >
              <CheckCircle size={16} className="mr-2 flex-shrink-0" />
              <span className="text-sm">
                Account created successfully! Redirecting to dashboard...
              </span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <div className="mt-1">
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Choose a username"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-gray-500">
                      Password strength
                    </div>
                    <div className="text-xs font-medium">
                      {passwordStatus.text}
                    </div>
                  </div>
                  <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-1 ${passwordStatus.color}`}
                      style={{
                        width: `${(passwordStatus.strength / 4) * 100}%`,
                      }}
                    />
                  </div>
                  <ul className="mt-2 text-xs text-gray-500 space-y-1">
                    <li className="flex items-center">
                      <span
                        className={`w-4 h-4 mr-1 flex items-center justify-center rounded-full ${
                          formData.password.length >= 8
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {formData.password.length >= 8 ? "✓" : ""}
                      </span>
                      At least 8 characters
                    </li>
                    <li className="flex items-center">
                      <span
                        className={`w-4 h-4 mr-1 flex items-center justify-center rounded-full ${
                          formData.password.match(/[A-Z]/)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {formData.password.match(/[A-Z]/) ? "✓" : ""}
                      </span>
                      At least 1 uppercase letter
                    </li>
                    <li className="flex items-center">
                      <span
                        className={`w-4 h-4 mr-1 flex items-center justify-center rounded-full ${
                          formData.password.match(/[0-9]/)
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {formData.password.match(/[0-9]/) ? "✓" : ""}
                      </span>
                      At least 1 number
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
              {formData.confirmPassword &&
                formData.password !== formData.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    Passwords do not match
                  </p>
                )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || success}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader size={18} className="animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <a
                href="/dashboard/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
