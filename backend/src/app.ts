import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes";
import { authenticate } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiter";

const app = express();

// Security headers per security.md Section 7
app.use(helmet());

// Narrowly configured CORS per security.md Section 7
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body parsing with size limit
app.use(express.json({ limit: "10mb" }));

// General rate limiter per security.md Section 7
app.use(generalLimiter);

// Public health check endpoint (established in Phase 0)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

/**
 * Global authentication middleware per Phase 1 directive:
 * "Apply authenticate globally to all routes except /auth/login and /auth/refresh"
 * (and the health check endpoint).
 */
const publicPathPrefixes = ["/health", "/auth/login", "/auth/change-password", "/auth/refresh"];

app.use((req: Request, res: Response, next: NextFunction) => {
  const isPublic = publicPathPrefixes.some(
    (path) => req.path === path || req.path.startsWith(path),
  );
  if (isPublic) {
    return next();
  }
  return authenticate(req, res, next);
});

// Mount application routes
app.use(routes);

// Centralized error handling middleware
app.use(errorHandler);

export default app;
