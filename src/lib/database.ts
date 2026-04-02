// In-memory database implementation
// For production, replace with proper database (PostgreSQL, MongoDB, etc.)

interface User {
    id: string;
    email: string;
    password: string;
    name: string;
    organizationId: string;
    role: string;
    createdAt: string;
    updatedAt: string;
}

interface Organization {
    id: string;
    name: string;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
}

interface Space {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

interface Project {
    id: string;
    spaceId: string;
    name: string;
    description?: string;
    prompt?: string;
    githubUrl?: string;
    githubBranch?: string;
    deploymentUrl?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
}

class Database {
    private users: Map<string, User> = new Map();
    private organizations: Map<string, Organization> = new Map();
    private spaces: Map<string, Space> = new Map();
    private projects: Map<string, Project> = new Map();

    constructor() {
        this.initializeData();
    }

    private initializeData() {
        const adminId = 'admin-1';
        const orgId = 'org-default';
        const now = new Date().toISOString();

        // Create default organization
        this.organizations.set(orgId, {
            id: orgId,
            name: 'Default Organization',
            ownerUserId: adminId,
            createdAt: now,
            updatedAt: now
        });

        // Create admin user (coinkrazy26@gmail.com / admin123)
        // Using simple hash-like encoding for demo (NOT for production!)
        const passwordHash = Buffer.from('admin123').toString('base64');
        this.users.set(adminId, {
            id: adminId,
            email: 'coinkrazy26@gmail.com',
            password: passwordHash,
            name: 'Admin User',
            organizationId: orgId,
            role: 'admin',
            createdAt: now,
            updatedAt: now
        });

        // Create default space
        const spaceId = 'space-default';
        this.spaces.set(spaceId, {
            id: spaceId,
            organizationId: orgId,
            name: 'Default Space',
            description: 'Your first space',
            createdAt: now,
            updatedAt: now
        });

        console.log('✅ Admin user created: coinkrazy26@gmail.com / admin123');
    }

    // ============================================
    // USER METHODS
    // ============================================

    async getUserByEmail(email: string, includePassword: boolean = false): Promise<any> {
        for (const user of this.users.values()) {
            if (user.email === email) {
                if (includePassword) {
                    return user;
                }
                return { ...user, password: undefined };
            }
        }
        return null;
    }

    async getUserById(id: string): Promise<any> {
        const user = this.users.get(id);
        if (user) {
            return { ...user, password: undefined };
        }
        return null;
    }

    async createUser(id: string, email: string, password: string, name: string, organizationId: string): Promise<any> {
        const now = new Date().toISOString();
        const passwordHash = Buffer.from(password).toString('base64');

        const user: User = {
            id,
            email,
            password: passwordHash,
            name,
            organizationId,
            role: 'member',
            createdAt: now,
            updatedAt: now
        };

        this.users.set(id, user);
        return { id, email, name, organizationId, role: 'member' };
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        // Simple verification (NOT for production!)
        const passwordHash = Buffer.from(password).toString('base64');
        return passwordHash === hash;
    }

    // ============================================
    // ORGANIZATION METHODS
    // ============================================

    async getOrganizationById(id: string): Promise<any> {
        return this.organizations.get(id) || null;
    }

    async getUserOrganization(userId: string): Promise<any> {
        const user = this.users.get(userId);
        if (user) {
            return this.organizations.get(user.organizationId) || null;
        }
        return null;
    }

    // ============================================
    // SPACE METHODS
    // ============================================

    async createSpace(id: string, organizationId: string, name: string, description?: string): Promise<any> {
        const now = new Date().toISOString();
        const space: Space = {
            id,
            organizationId,
            name,
            description,
            createdAt: now,
            updatedAt: now
        };

        this.spaces.set(id, space);
        return space;
    }

    async getSpacesByOrganization(organizationId: string): Promise<any[]> {
        const spaces: Space[] = [];
        for (const space of this.spaces.values()) {
            if (space.organizationId === organizationId) {
                spaces.push(space);
            }
        }
        return spaces.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getSpaceById(id: string): Promise<any> {
        return this.spaces.get(id) || null;
    }

    async deleteSpace(id: string): Promise<void> {
        this.spaces.delete(id);
        // Also delete projects in this space
        for (const [projectId, project] of this.projects.entries()) {
            if (project.spaceId === id) {
                this.projects.delete(projectId);
            }
        }
    }

    // ============================================
    // PROJECT METHODS
    // ============================================

    async createProject(
        id: string,
        spaceId: string,
        name: string,
        description?: string,
        prompt?: string
    ): Promise<any> {
        const now = new Date().toISOString();
        const project: Project = {
            id,
            spaceId,
            name,
            description,
            prompt,
            status: 'draft',
            createdAt: now,
            updatedAt: now
        };

        this.projects.set(id, project);
        return project;
    }

    async getProjectsBySpace(spaceId: string): Promise<any[]> {
        const projects: Project[] = [];
        for (const project of this.projects.values()) {
            if (project.spaceId === spaceId) {
                projects.push(project);
            }
        }
        return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getProjectById(id: string): Promise<any> {
        return this.projects.get(id) || null;
    }

    async updateProject(id: string, updates: any): Promise<any> {
        const project = this.projects.get(id);
        if (project) {
            const updated = {
                ...project,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.projects.set(id, updated);
            return updated;
        }
        return null;
    }

    async deleteProject(id: string): Promise<void> {
        this.projects.delete(id);
    }

    close() {
        console.log('Database connection closed');
    }
}

export const database = new Database();
