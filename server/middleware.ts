import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

// Middleware to require admin role for mutations
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Check role from session cache first
  if (req.session.userRole === "viewer") {
    return res.status(403).json({ message: 'Read-only access. You do not have permission to modify data.' });
  }

  // If role not cached, fetch from database
  if (!req.session.userRole) {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.session.userRole = user.role;
        if (user.role === "viewer") {
          return res.status(403).json({ message: 'Read-only access. You do not have permission to modify data.' });
        }
      }
    } catch (error) {
      console.error("Error checking user role:", error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  next();
}
