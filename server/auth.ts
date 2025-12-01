import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { storage } from "./storage";

dotenv.config();

export async function initializeAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const viewerUsername = process.env.VIEWER_USERNAME || "";
  const viewerPassword = process.env.VIEWER_PASSWORD || "";

  try {
    // Create or update admin account
    const existingAdmin = await storage.getUserByUsername(adminUsername);

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await storage.createUserWithRole({
        username: adminUsername,
        password: hashedPassword,
      }, "admin");
      console.log("Admin user created successfully");
    } else if (existingAdmin.role !== "admin") {
      // Ensure existing admin has admin role
      await storage.updateUserRole(adminUsername, "admin");
      console.log("Admin user role updated");
    }

    // Create or update viewer account (if credentials are provided)
    if (viewerUsername && viewerPassword) {
      const existingViewer = await storage.getUserByUsername(viewerUsername);

      if (!existingViewer) {
        const hashedPassword = await bcrypt.hash(viewerPassword, 12);
        await storage.createUserWithRole({
          username: viewerUsername,
          password: hashedPassword,
        }, "viewer");
        console.log("Viewer user created successfully");
      } else if (existingViewer.role !== "viewer") {
        // Ensure existing viewer has viewer role
        await storage.updateUserRole(viewerUsername, "viewer");
        console.log("Viewer user role updated");
      }
    }
  } catch (error) {
    console.error("Error initializing users:", error);
  }
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}
