import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

export const loginLimiter = isProd
  ? rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      message: {
        error: "Too many login attempts, please try again after 15 minutes",
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : (req, res, next) => next();
