import { useDispatch } from "react-redux";
import { addToast, ToastType } from "../store/toastSlice";

export const useToast = () => {
  const dispatch = useDispatch();

  const showToast = (
    message: string,
    type: ToastType = "info",
    title?: string
  ) => {
    dispatch(addToast({ message, type, title }));
  };

  return {
    showToast,
    showError: (message: string, title?: string) =>
      showToast(message, "error", title),
    showSuccess: (message: string, title?: string) =>
      showToast(message, "success", title),
    showWarning: (message: string, title?: string) =>
      showToast(message, "warning", title),
    showInfo: (message: string, title?: string) =>
      showToast(message, "info", title),
  };
};

export default useToast;
