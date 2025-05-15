import { AxiosError } from "axios";
import { store } from "../store/store";
import { addToast } from "../store/toastSlice";

/**
 * Handles API errors and creates toast notifications
 * @param error The error object returned by axios
 * @param defaultMessage Optional default message to display if error details can't be extracted
 */
export const handleApiError = (
  error: unknown,
  defaultMessage = "An unexpected error occurred"
): void => {
  if (error instanceof Error) {
    const axiosError = error as AxiosError;

    // Get status code if available
    const statusCode = axiosError.response?.status;
    const statusText = axiosError.response?.statusText;

    // Try to get the error message from the response
    let errorMessage = defaultMessage;
    const errorTitle = statusCode ? `Error ${statusCode}` : "Error";

    try {
      // Try to extract error message from response data
      const responseData = axiosError.response?.data as any;

      if (responseData) {
        if (typeof responseData === "string") {
          errorMessage = responseData;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (statusText) {
          errorMessage = statusText;
        }
      }
    } catch (e) {
      // If we can't parse the error data, use the default message
      console.error("Error parsing API error response:", e);
    }

    // Dispatch the toast notification
    store.dispatch(
      addToast({
        type: "error",
        title: errorTitle,
        message: errorMessage,
      })
    );

    // Log the full error to console for debugging
    console.error("API Error:", {
      status: statusCode,
      message: errorMessage,
      originalError: error,
    });
  } else {
    // For non-Error objects, just show a generic message
    store.dispatch(
      addToast({
        type: "error",
        title: "Error",
        message: defaultMessage,
      })
    );

    console.error("Unknown error type:", error);
  }
};
