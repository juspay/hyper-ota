import axios from "axios";
import { handleApiError } from "../utils/errorHandler";

const axiosInstance = axios.create({
  baseURL: "/", // Base URL for all requests
  timeout: 10000, // 10 seconds timeout
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens on unauthorized
      localStorage.removeItem("userToken");
      sessionStorage.removeItem("userToken");
      window.location.href = "/dashboard";
    }

    // Handle all API errors with our error handler
    handleApiError(error);

    return Promise.reject(error);
  }
);

export default axiosInstance;
