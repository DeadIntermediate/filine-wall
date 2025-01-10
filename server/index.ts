import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeScheduledTasks } from "./services/scheduledTasks";
import { SpamDatabaseService } from "./services/spamDatabaseService";
import { SpamDetectionService } from "./services/spamDetectionService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Initialize FCC database on startup
    await SpamDatabaseService.refreshDatabase()
      .catch(error => {
        console.error("Initial FCC database refresh failed:", error);
        // Continue even if FCC database fails - it's not critical for core functionality
      });

    // Initialize spam detection model
    await SpamDetectionService.loadModel()
      .catch(error => {
        console.error("Failed to initialize spam detection model:", error);
        // Continue without AI model, will use traditional methods
      });

    // Start the initial model training in the background
    SpamDetectionService.trainModel().catch(error => {
      console.error("Initial model training failed:", error);
    });

    const server = registerRoutes(app);

    // Initialize scheduled tasks (including FCC database updates)
    initializeScheduledTasks();

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Server error:", err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`serving on port ${PORT}`);
      log("AI Spam Detection: Initialized and ready");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();