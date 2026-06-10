import { Request, Response } from "express";
import Project from "../models/project.model";
import { IUser } from "../models/user.model";

interface AuthRequest extends Request {
  user?: IUser;
}

// GET /api/projects
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({ owner: req.user!._id })
      .sort({ updatedAt: -1 })
      .select("description createdAt updatedAt");
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /api/projects
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const { description } = req.body;
    if (!description?.trim()) {
      return res.status(400).json({ error: "description is required" });
    }

    const project = await Project.create({
      description: description.trim(),
      owner: req.user!._id,
      files: [
        {
          name: "README.md",
          language: "markdown",
          content: `# ${description.trim()}\n\nProject created with WireUp.\n`,
        },
      ],
      activeFile: "README.md",
    });

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// GET /api/project/:id
export const getProject = async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user!._id,
    });

    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// PUT /api/project/:id
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const { description, files, activeFile } = req.body;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user!._id,
    });

    if (!project) return res.status(404).json({ error: "Project not found" });

    if (description) project.description = description.trim();
    if (files) project.files = files;
    if (activeFile !== undefined) project.activeFile = activeFile;

    await project.save();
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// DELETE /api/project/:id
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user!._id,
    });

    if (!project) return res.status(404).json({ error: "Project not found" });

    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
