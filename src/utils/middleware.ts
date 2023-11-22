import { error as errorLogger } from "./logger";
import { Request, Response, NextFunction } from 'express';

export const unknownEndpoint = (req: Request, res: Response) => {
  res.status(404).send({ error: `unknown endpoint` });
};

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  errorLogger(error.message);
  next(error);
};
