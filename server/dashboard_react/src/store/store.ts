import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import toastReducer from "./toastSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    toast: toastReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
