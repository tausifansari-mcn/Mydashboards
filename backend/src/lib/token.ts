import jwt from 'jsonwebtoken';

export interface TokenPayload {
  id: number;
  email: string;
  role: string;
  clientId: number | null;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function signResetToken(userId: number): string {
  return jwt.sign({ id: userId }, process.env.RESET_TOKEN_SECRET!, {
    expiresIn: '1h',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as TokenPayload;
}

export function verifyResetToken(token: string): { id: number } {
  return jwt.verify(token, process.env.RESET_TOKEN_SECRET!) as { id: number };
}
