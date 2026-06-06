import express, { Request, Response, NextFunction } from "express";
import { app } from "./app";
import { registerRoutes } from "./routes";

// Ensure NODE_ENV is set to production for serverless build context
process.env.NODE_ENV = "production";

// Register all Express API endpoints
registerRoutes(app).catch(err => {
  console.error("Failed to register routes in serverless context:", err);
});

// Global error handler for serverless requests
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
