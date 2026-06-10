//This file is inspected and is fine for now, not certified tho, cause might need to come back again
import { create } from "zustand";
import { axiosInstance } from "../lib/axios.ts";
import toast from "react-hot-toast";
import { useProjectStore } from "./useProjectStore.ts";

interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  profilePic?: string;
}

interface AuthData {
  email: string;
  password: string;
  fullName?: string;
}

interface AuthState {
  authUser: AuthUser | null;
  isSigningUp: boolean;
  isLoggingIn: boolean;
  isCheckingAuth: boolean;

  checkAuth: () => Promise<void>;
  signup: (data: AuthData) => Promise<void>;
  login: (data: AuthData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthData>) => Promise<void>;
}

const getErrorMessage = (error: any, fallbackMessage: string): string => {
  return error?.response?.data?.message || fallbackMessage;
};

const debugAuth = (...args: any[]) => {
  if (import.meta.env.MODE !== "production") {
    console.debug("[auth-store]", ...args);
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isCheckingAuth: true,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get<AuthUser>("/auth/check");

      set({ authUser: res.data });
      debugAuth("checkAuth success", { userId: res.data?._id });

      const lastProjectId = localStorage.getItem("forge:lastProjectId");
      if (lastProjectId) {
        useProjectStore.getState().loadProject(lastProjectId);
      }
    } catch (error: any) {
      debugAuth("checkAuth failed", error?.message);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post<AuthUser>(
        "/auth/signup",
        data
      );

      set({ authUser: res.data });
      toast.success("Account created successfully");
      debugAuth("signup success", { userId: res.data?._id });
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Signup failed"));
      debugAuth("signup failed", error?.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post<AuthUser>(
        "/auth/login",
        data
      );

      set({ authUser: res.data });
      toast.success("Logged in successfully");
      debugAuth("login success", { userId: res.data?._id });
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Login failed"));
      debugAuth("login failed", error?.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");

      set({ authUser: null });

      useProjectStore.getState().clearProject();
      localStorage.removeItem("forge:lastProjectId");

      toast.success("Logged out successfully");
      debugAuth("logout success");
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Logout failed"));
      debugAuth("logout failed", error?.message);
    }
  },

  updateUser: async (data) => {
    try {
      const res = await axiosInstance.put<AuthUser & { message?: string }>(
        "/auth/update",
        data
      );

      set({ authUser: res.data });

      toast.success(res.data?.message || "Settings updated");
      debugAuth("updateUser success", { userId: res.data?._id });
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Update failed"));
      debugAuth("updateUser failed", error?.message);
      throw error;
    }
  },
}));