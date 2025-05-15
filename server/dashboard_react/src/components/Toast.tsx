import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { removeToast } from "../store/toastSlice";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";

// Duration for each toast to be displayed (in milliseconds)
const TOAST_DURATION = 5000;

const Toast: React.FC = () => {
  const { toasts } = useSelector((state: RootState) => state.toast);
  const dispatch = useDispatch();

  // Auto-remove toasts after duration
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        dispatch(removeToast(toasts[0].id));
      }, TOAST_DURATION);

      return () => clearTimeout(timer);
    }
  }, [toasts, dispatch]);

  const getAlertClassName = (type: string) => {
    switch (type) {
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "success":
        return "bg-green-100 text-green-800 border-green-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "info":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "error":
        return <XCircle className="w-5 h-5" />;
      case "success":
        return <CheckCircle className="w-5 h-5" />;
      case "warning":
        return <AlertCircle className="w-5 h-5" />;
      case "info":
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-end z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`alert shadow-lg border ${getAlertClassName(
            toast.type
          )} flex`}
          role="alert"
        >
          <div className="flex-1 flex items-center">
            <span className="mr-2">{getIcon(toast.type)}</span>
            <div>
              {toast.title && <h3 className="font-bold">{toast.title}</h3>}
              <div className="text-sm">{toast.message}</div>
            </div>
          </div>
          <button
            onClick={() => dispatch(removeToast(toast.id))}
            className="p-1 hover:bg-gray-200 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
