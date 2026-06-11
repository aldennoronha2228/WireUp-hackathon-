import mongoose, { Document, Schema } from "mongoose";

export interface IProject extends Document {
  description: string;
  owner: mongoose.Types.ObjectId;
  files: Array<{
    name: string;
    language: string;
    content: string;
  }>;
  activeFile: string;
  chatHistory: Array<{
    id?: string;
    role: "user" | "assistant";
    content: string;
    images?: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    description: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    files: [
      {
        name: { type: String, required: true },
        language: { type: String, default: "plaintext" },
        content: { type: String, default: "" },
      },
    ],
    activeFile: { type: String, default: "" },
    chatHistory: [
      {
        id: { type: String },
        role: { type: String, required: true },
        content: { type: String, default: "" },
        images: { type: [String], default: [] }
      }
    ]
  },
  { timestamps: true }
);

const Project = mongoose.model<IProject>("Project", projectSchema);
export default Project;
