import { NextFunction, Response } from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import { config } from "../config/common";
import userRepository from "../repository/userRepository";
import { CustomRequest } from "../type/types";

interface DecodedToken {
  user: {
    id: string;
    email: string;
    firstname?: string;
    lastname?: string;
  };
  iat: number;
}

const normalizeToken = (value?: string | null): string | null => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const lowerValue = normalizedValue.toLowerCase();
  if (lowerValue === "null" || lowerValue === "undefined") {
    return null;
  }

  return normalizedValue;
};

const unifiedAuthMiddleware = asyncHandler(
  async (req: CustomRequest, res: Response, next: NextFunction) => {
    let headerToken: string | null = null;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (typeof authHeader === "string") {
      const tokenMatch = authHeader.match(/^Bearer\s+(.*)$/i);
      if (tokenMatch) {
        headerToken = normalizeToken(tokenMatch[1]);
      }
    }

    const cookieToken = normalizeToken(req.cookies?.[config.JWTCONFIG.CLEAR_COOKIE]);
    const tokensToTry = Array.from(new Set([headerToken, cookieToken].filter(Boolean))) as string[];

    if (!tokensToTry.length) {
      res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
      return;
    }

    let decoded: DecodedToken | null = null;
    let token: string | null = null;

    try {
      for (const candidateToken of tokensToTry) {
        try {
          decoded = jwt.verify(
            candidateToken,
            process.env.ACCESS_TOKEN_SECRET || config.JWTCONFIG.SECRET
          ) as DecodedToken;
          token = candidateToken;
          break;
        } catch (_error) {
          // Try the next token source (header or cookie) before rejecting.
          continue;
        }
      }

      if (!decoded || !token) {
        res.clearCookie(config.JWTCONFIG.CLEAR_COOKIE);
        res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
        return;
      }

      if (!decoded.user || !decoded.user.id) {
        res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
        return;
      }

      const user = await userRepository.getUser(decoded.user.id, {
        options: {
          select: "email firstName lastName status type role lastActive organizationId",
        },
      });

      if (!user) {
        res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
        return;
      }

      req.user = {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId?.toString() || "",
      };
      req.token = token;

      next();
    } catch (error) {
      res.clearCookie(config.JWTCONFIG.CLEAR_COOKIE);
      res.status(401).json({ message: config.ERROR.USER.NOT_AUTHORIZED });
    }
  }
);

export default unifiedAuthMiddleware;
