import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import routes from './routes';
import { database } from '../lib/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../../public')));

// Serve generated projects from output directory
app.use('/output', express.static(path.join(__dirname, '../../output')));

// API routes
app.use(routes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all non-API routes
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Fusion server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '../../public')}`);
    console.log(`📂 Output directory: ${path.join(__dirname, '../../output')}`);
    console.log(`💾 Database initialized at: ${process.cwd()}/fusion.db`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        database.close();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        database.close();
        process.exit(0);
    });
});

export default app;
