import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

export interface ProjectFile {
  name: string;
  language: string;
  content: string;
}

export interface Project {
  _id: string;
  description: string;
  files: ProjectFile[];
  activeFile: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectState {
  currentProject: Project | null;
  isLoading: boolean;

  loadProject: (id: string) => Promise<void>;
  clearProject: () => void;
  updateFile: (projectId: string, fileName: string, content: string) => Promise<void>;
  addFile: (projectId: string, file: ProjectFile) => Promise<void>;
  setActiveFile: (projectId: string, fileName: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  isLoading: false,

  loadProject: async (id: string) => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get<Project>(`/project/${id}`);
      set({ currentProject: res.data });
      localStorage.setItem("forge:lastProjectId", id);
    } catch {
      set({ currentProject: null });
    } finally {
      set({ isLoading: false });
    }
  },

  clearProject: () => {
    set({ currentProject: null });
  },

  updateFile: async (projectId: string, fileName: string, content: string) => {
    const project = get().currentProject;
    if (!project) return;

    const updatedFiles = project.files.map((f) =>
      f.name === fileName ? { ...f, content } : f
    );
    set({ currentProject: { ...project, files: updatedFiles } });

    try {
      await axiosInstance.put(`/project/${projectId}`, { files: updatedFiles });
    } catch {
      // optimistic update — silently fail, will re-sync on next load
    }
  },

  addFile: async (projectId: string, file: ProjectFile) => {
    const project = get().currentProject;
    if (!project) return;

    // Update existing file if name matches, otherwise append
    const exists = project.files.find(f => f.name === file.name);
    const updatedFiles = exists
      ? project.files.map(f => f.name === file.name ? { ...f, ...file } : f)
      : [...project.files, file];

    const newActiveFile = exists ? project.activeFile : file.name;
    set({ currentProject: { ...project, files: updatedFiles, activeFile: newActiveFile } });

    try {
      await axiosInstance.put(`/project/${projectId}`, {
        files: updatedFiles,
        activeFile: file.name,
      });
    } catch {
      // silently fail
    }
  },

  setActiveFile: async (projectId: string, fileName: string) => {
    const project = get().currentProject;
    if (!project) return;
    set({ currentProject: { ...project, activeFile: fileName } });
    try {
      await axiosInstance.put(`/project/${projectId}`, { activeFile: fileName });
    } catch {
      // silently fail
    }
  },
}));
