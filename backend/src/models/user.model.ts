// ??$$$ group 1 - Landing Page & Authentication
import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  fullName: string;
  password: string;
  profilePic: string;
  googleId?: string;
  skillLevel?: "beginner" | "intermediate" | "experienced";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    password: { type: String, required: false, default: "" },
    profilePic: { type: String, default: "" },
    googleId: { type: String, default: "" },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "experienced"],
      default: "beginner",
    },
  },
  { timestamps: true }
);

const User = mongoose.model<IUser>("User", userSchema);
export default User;