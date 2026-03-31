import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'fusion-secret-key-change-in-production';

// Simple base64 JWT implementation (simplified, not for production)
function createJWT(payload: any): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    // Simplified signature (not cryptographically secure)
    const signature = Buffer.from(JWT_SECRET).toString('base64url');
    return `${header}.${body}.${signature}`;
}

function decodeJWT(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return payload;
    } catch (error) {
        return null;
    }
}

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId: string;
        role: string;
    };
}

export function generateToken(userId: string, email: string, organizationId: string, role: string): string {
    return createJWT({
        id: userId,
        email,
        organizationId,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    });
}

export function verifyToken(token: string): any {
    const decoded = decodeJWT(token);
    if (!decoded) return null;
    
    // Check expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }
    
    return decoded;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No authentication token' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }

    next();
}
