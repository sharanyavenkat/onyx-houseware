import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { storage } from "./storage";

dotenv.config();

export async function initializeAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";

  try {
    const existingAdmin = await storage.getUserByUsername(adminUsername);

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
      });
      console.log("Admin user created successfully");
    }
  } catch (error) {
    console.error("Error initializing admin user:", error);
  }
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hashedPassword);
}
