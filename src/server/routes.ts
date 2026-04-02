import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import { database } from '../lib/database';
import { authMiddleware, optionalAuthMiddleware, generateToken, verifyToken, AuthRequest } from '../lib/auth';
import {
    createProjectMemory,
    loadProjectMemory,
    updateProjectMemory,
    buildContextFromMemory
} from '../lib/projectMemory';
import { generateWithClaude } from '../lib/generator';

const router: Router = express.Router();
const activeGenerations = new Map();

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

router.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await database.getUserByEmail(email, true);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const passwordMatch = await database.verifyPassword(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user.id, user.email, user.organizationId, user.role);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationId: user.organizationId,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name required' });
        }

        const existingUser = await database.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const userId = 'user-' + Date.now();
        const orgId = 'org-' + Date.now();

        // Create organization for new user
        const organization = await database.getOrganizationById(orgId);
        if (!organization) {
            // Create org (simplified - in real app would be more complex)
        }

        const user = await database.createUser(userId, email, password, name, orgId);
        const token = generateToken(user.id, user.email, user.organizationId, 'member');

        // Create default space
        const spaceId = 'space-' + Date.now();
        await database.createSpace(spaceId, orgId, 'Default Space');

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                organizationId: user.organizationId,
                role: 'member'
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

router.post('/api/auth/verify', authMiddleware, (req: AuthRequest, res: Response) => {
    res.json({
        valid: true,
        user: req.user
    });
});

// ============================================
// ORGANIZATION ENDPOINTS
// ============================================

router.get('/api/organization', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const organization = await database.getOrganizationById(req.user!.organizationId);
        res.json(organization);
    } catch (error) {
        console.error('Get org error:', error);
        res.status(500).json({ error: 'Failed to get organization' });
    }
});

// ============================================
// SPACES ENDPOINTS
// ============================================

router.get('/api/spaces', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            console.error('No user in request for GET /api/spaces');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const spaces = await database.getSpacesByOrganization(req.user.organizationId);
        res.json({ spaces });
    } catch (error) {
        console.error('Get spaces error:', error);
        res.status(500).json({ error: 'Failed to get spaces' });
    }
});

router.post('/api/spaces', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Space name required' });
        }

        // Check if user is authenticated
        if (!req.user || !req.user.organizationId) {
            console.error('Invalid user or missing organizationId:', req.user);
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const spaces = await database.getSpacesByOrganization(req.user.organizationId);
        if (spaces.length >= 10) {
            return res.status(409).json({ error: 'Maximum 10 spaces allowed per organization' });
        }

        const spaceId = 'space-' + Date.now();
        const space = await database.createSpace(spaceId, req.user.organizationId, name, description);

        res.status(201).json(space);
    } catch (error) {
        console.error('Create space error:', error);
        res.status(500).json({ error: 'Failed to create space' });
    }
});

router.get('/api/spaces/:spaceId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const space = await database.getSpaceById(req.params.spaceId as string);
        if (!space) {
            return res.status(404).json({ error: 'Space not found' });
        }
        res.json(space);
    } catch (error) {
        console.error('Get space error:', error);
        res.status(500).json({ error: 'Failed to get space' });
    }
});

router.delete('/api/spaces/:spaceId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        await database.deleteSpace(req.params.spaceId as string);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete space error:', error);
        res.status(500).json({ error: 'Failed to delete space' });
    }
});

// ============================================
// PROJECTS ENDPOINTS
// ============================================

router.get('/api/spaces/:spaceId/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const projects = await database.getProjectsBySpace(req.params.spaceId as string);
        res.json({ projects });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to get projects' });
    }
});

router.post('/api/spaces/:spaceId/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, prompt } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name required' });
        }

        const projectId = 'project-' + Date.now();
        const project = await database.createProject(projectId, req.params.spaceId as string, name, description, prompt);

        res.json(project);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

router.get('/api/projects/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const project = await database.getProjectById(req.params.projectId as string);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to get project' });
    }
});

router.patch('/api/projects/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const project = await database.updateProject(req.params.projectId as string, req.body);
        res.json(project);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

router.delete('/api/projects/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        await database.deleteProject(req.params.projectId as string);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ============================================
// GENERATION ENDPOINTS
// ============================================

router.post('/api/generate', async (req: Request, res: Response) => {
    const { prompt, continueFromProject } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const generationId = Date.now().toString();

    activeGenerations.set(generationId, {
        status: 'starting',
        prompt,
        progress: [],
        startTime: new Date(),
        projectPath: null,
        continueFromProject: continueFromProject || null,
        verboseLogs: []
    });

    generateProject(generationId, prompt, continueFromProject);

    res.json({
        generationId,
        status: 'started',
        message: continueFromProject ? 'Continuing project development...' : 'Generation started successfully'
    });
});

router.get('/api/status/:generationId', (req: Request, res: Response) => {
    const { generationId } = req.params;
    const generation = activeGenerations.get(generationId);
    
    if (!generation) {
        return res.status(404).json({ error: 'Generation not found' });
    }

    res.json({
        generationId,
        status: generation.status,
        progress: generation.progress,
        projectPath: generation.projectPath,
        startTime: generation.startTime,
        verboseLogs: generation.verboseLogs || []
    });
});

router.get('/api/projects', (req: Request, res: Response) => {
    const outputDir = path.join(__dirname, '../../output');
    
    if (!fs.existsSync(outputDir)) {
        return res.json({ projects: [] });
    }

    const projects = fs.readdirSync(outputDir)
        .filter(item => {
            const itemPath = path.join(outputDir, item);
            return fs.statSync(itemPath).isDirectory();
        })
        .map(projectName => {
            const projectPath = path.join(outputDir, projectName);
            const stats = fs.statSync(projectPath);
            const htmlFiles = fs.readdirSync(projectPath).filter(file => file.endsWith('.html'));
            
            let entryPoint = null;
            if (htmlFiles.includes('index.html')) {
                entryPoint = 'index.html';
            } else if (htmlFiles.length > 0) {
                entryPoint = htmlFiles[0];
            }
            
            return {
                name: projectName,
                path: `/output/${projectName}`,
                entryPoint: entryPoint,
                url: entryPoint ? `/output/${projectName}/${entryPoint}` : null,
                createdAt: stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
                fileCount: fs.readdirSync(projectPath).length,
                hasFiles: {
                    html: htmlFiles.length > 0,
                    css: fs.readdirSync(projectPath).some(file => file.endsWith('.css')),
                    js: fs.readdirSync(projectPath).some(file => file.endsWith('.js')),
                    ts: fs.readdirSync(projectPath).some(file => file.endsWith('.ts'))
                }
            };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ projects });
});

// ============================================
// GENERATION HELPER FUNCTION
// ============================================

async function generateProject(generationId: string, prompt: string, continueFromProject: string | null = null) {
    const generation = activeGenerations.get(generationId);
    
    try {
        generation.status = 'generating';
        
        let contextualPrompt = prompt;
        let targetProjectPath: string | undefined = undefined;
        let existingMemory = null;
        
        if (continueFromProject) {
            const outputDir = path.join(__dirname, '../../output');
            targetProjectPath = path.join(outputDir, continueFromProject);
            
            if (fs.existsSync(targetProjectPath)) {
                existingMemory = loadProjectMemory(targetProjectPath);
                if (existingMemory) {
                    const memoryContext = buildContextFromMemory(existingMemory);
                    contextualPrompt = `${memoryContext}\n\nNEW REQUEST: ${prompt}`;
                    
                    generation.progress.push({
                        timestamp: new Date(),
                        type: 'info',
                        message: `🔄 Continuing development on: "${existingMemory.projectName}"`
                    });
                    
                    generation.verboseLogs.push({
                        timestamp: new Date().toISOString(),
                        type: 'info',
                        message: `Continuing project "${continueFromProject}" with context from ${existingMemory.prompts.length} previous prompts`
                    });
                }
            }
        } else {
            generation.progress.push({
                timestamp: new Date(),
                type: 'info',
                message: `🚀 Starting generation for: "${prompt}"`
            });
        }

        const result = await generateWithClaude(contextualPrompt, targetProjectPath);

        if (result.messages && result.messages.length > 0) {
            generation.verboseLogs.push({
                timestamp: new Date().toISOString(),
                type: 'info',
                message: `Received ${result.messages.length} messages from Claude Code SDK`
            });
        }

        if (result.outputDirectory && fs.existsSync(result.outputDirectory)) {
            generation.projectPath = result.outputDirectory;
            const projectName = path.basename(result.outputDirectory);

            generation.progress.push({
                timestamp: new Date(),
                type: 'success',
                message: `✅ Project created: ${projectName}`
            });

            generation.verboseLogs.push({
                timestamp: new Date().toISOString(),
                type: 'success',
                message: `Project successfully ${continueFromProject ? 'updated' : 'generated'} at: ${result.outputDirectory}`
            });

            if (!continueFromProject && result.outputDirectory) {
                const projectName = path.basename(result.outputDirectory as string);
                createProjectMemory(projectName, prompt, result.outputDirectory as string);
            } else if (targetProjectPath && existingMemory) {
                updateProjectMemory(targetProjectPath, prompt, { success: true });
            }
        }

        generation.status = 'complete';

        generation.progress.push({
            timestamp: new Date(),
            type: 'success',
            message: '🎉 Generation complete!'
        });
    } catch (error: any) {
        console.error('Generation error:', error);
        generation.status = 'error';
        generation.progress.push({
            timestamp: new Date(),
            type: 'error',
            message: `❌ Error: ${error.message}`
        });

        generation.verboseLogs.push({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `Generation error: ${error.stack}`
        });
    }
}

export default router;
