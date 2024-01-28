import { error as errorLogger } from "./logger";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as Sentry from "@sentry/node";
import { PostHog } from 'posthog-node'

export const unknownEndpoint = (req: Request, res: Response) => {
  res.status(404).send({ error: `unknown endpoint` });
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  errorLogger(error.message);
  next(error);
};

// Extend the Express request type to include user_id
export interface RequestWithUserId extends Request {
  user_id?: string;
}

export const authenticateToken = (req: RequestWithUserId, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {

    return res.sendStatus(401); 
  }// No token provided

  const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "no-secret";

  jwt.verify(token, SUPABASE_JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
    let id = user.sub.toString();
    req.user_id = id; // Add the user_id payload to the request

    //identify user for sentry error reporting
    Sentry.setUser({ id });
    
    next(); // Continue to the next middleware/route handler
  });
};
