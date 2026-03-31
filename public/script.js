class FusionApp {
    constructor() {
        this.currentUser = null;
        this.currentSpace = null;
        this.currentGenerationId = null;
        this.pollInterval = null;
        this.selectedProject = null;
        this.projects = [];
        this.spaces = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
        this.initializeVerboseLogs();
    }

    // ============================================
    // EVENT BINDING
    // ============================================

    bindEvents() {
        // Homepage buttons
        document.getElementById('create-project-btn')?.addEventListener('click', () => this.showAuthIfNeeded(() => this.switchView('dashboard')));
        document.getElementById('import-github-btn')?.addEventListener('click', () => this.showAuthIfNeeded(() => this.openGitHubModal()));
        document.getElementById('get-started-btn')?.addEventListener('click', () => this.showAuthIfNeeded(() => this.switchView('dashboard')));

        // Auth buttons
        document.getElementById('auth-btn')?.addEventListener('click', () => this.openAuthModal());
        document.getElementById('auth-submit-btn')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('auth-modal-close-btn')?.addEventListener('click', () => this.closeAuthModal());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

        // GitHub import
        document.getElementById('github-modal-close-btn')?.addEventListener('click', () => this.closeGitHubModal());
        document.getElementById('github-import-btn')?.addEventListener('click', () => this.handleGitHubImport());

        // Info modal
        document.getElementById('info-btn')?.addEventListener('click', () => this.openInfoModal());
        document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeInfoModal());
        document.getElementById('info-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'info-modal') this.closeInfoModal();
        });

        // Dashboard elements
        document.getElementById('generate-btn')?.addEventListener('click', () => this.handleGenerate());
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshPreview());
        document.getElementById('fullscreen-btn')?.addEventListener('click', () => this.openInNewTab());
        document.getElementById('clear-logs-btn')?.addEventListener('click', () => this.clearVerboseLogs());
        document.getElementById('copy-logs-btn')?.addEventListener('click', () => this.copyVerboseLogs());
        document.getElementById('refresh-projects-btn')?.addEventListener('click', () => this.loadProjects());
        document.getElementById('toggle-logs-btn')?.addEventListener('click', () => this.toggleVerboseLogs());
        document.getElementById('new-space-btn')?.addEventListener('click', () => this.createNewSpace());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('auth-modal')?.classList.contains('hidden')) {
                this.closeAuthModal();
            }
            if (e.key === 'Escape' && !document.getElementById('info-modal')?.classList.contains('hidden')) {
                this.closeInfoModal();
            }
            if (e.key === 'Escape' && !document.getElementById('github-import-modal')?.classList.contains('hidden')) {
                this.closeGitHubModal();
            }
        });

        // Prompt input enter key
        const promptInput = document.getElementById('prompt-input');
        if (promptInput) {
            promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleGenerate();
                }
            });
        }
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    checkAuth() {
        const token = localStorage.getItem('fusionToken');
        if (token) {
            // Verify token is valid (in real app, would validate with backend)
            const userData = localStorage.getItem('fusionUser');
            if (userData) {
                this.currentUser = JSON.parse(userData);
                this.switchView('dashboard');
                this.loadSpaces();
            } else {
                this.switchView('homepage');
            }
        } else {
            this.switchView('homepage');
        }
    }

    openAuthModal() {
        document.getElementById('auth-modal')?.classList.remove('hidden');
    }

    closeAuthModal() {
        document.getElementById('auth-modal')?.classList.add('hidden');
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
    }

    async handleLogin() {
        const email = document.getElementById('auth-email')?.value || '';
        const password = document.getElementById('auth-password')?.value || '';

        if (!email || !password) {
            this.showError('Please enter email and password');
            return;
        }

        this.setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const data = await response.json();
                this.showError(data.error || 'Login failed');
                return;
            }

            const data = await response.json();
            localStorage.setItem('fusionToken', data.token);
            localStorage.setItem('fusionUser', JSON.stringify(data.user));

            this.currentUser = data.user;
            this.closeAuthModal();
            this.switchView('dashboard');
            this.loadSpaces();
            this.showSuccess('Signed in successfully!');
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    handleLogout() {
        localStorage.removeItem('fusionToken');
        localStorage.removeItem('fusionUser');
        this.currentUser = null;
        this.currentSpace = null;
        this.switchView('homepage');
    }

    showAuthIfNeeded(callback) {
        if (!this.currentUser) {
            this.openAuthModal();
            // Store callback to execute after login
            window.postLoginCallback = callback;
        } else {
            callback();
        }
    }

    // ============================================
    // VIEW MANAGEMENT
    // ============================================

    switchView(viewName) {
        const homepageView = document.getElementById('homepage-view');
        const dashboardView = document.getElementById('dashboard-view');

        if (viewName === 'homepage') {
            homepageView?.classList.remove('hidden');
            dashboardView?.classList.add('hidden');
        } else {
            homepageView?.classList.add('hidden');
            dashboardView?.classList.remove('hidden');
            
            // If callback was pending (from login), execute it
            if (window.postLoginCallback) {
                window.postLoginCallback();
                window.postLoginCallback = null;
            }
        }
    }

    // ============================================
    // SPACES MANAGEMENT
    // ============================================

    async loadSpaces() {
        try {
            const token = localStorage.getItem('fusionToken');
            const response = await fetch('/api/spaces', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load spaces');

            const data = await response.json();
            this.spaces = data.spaces || [];

            if (this.spaces.length === 0) {
                // Create default space if none exist
                await this.createNewSpace();
            } else {
                this.renderSpaces();
                this.selectSpace(this.spaces[0]);
            }
        } catch (error) {
            console.error('Error loading spaces:', error);
            this.showError('Failed to load spaces');
        }
    }

    renderSpaces() {
        const spacesList = document.getElementById('spaces-list');
        if (!spacesList) return;

        spacesList.innerHTML = this.spaces.map(space => `
            <div class="space-item ${space.id === this.currentSpace?.id ? 'active' : ''}" data-space-id="${space.id}">
                <div style="font-weight: 500;">${space.name}</div>
                <small>${space.projects?.length || 0} project(s)</small>
            </div>
        `).join('');

        // Add click handlers
        spacesList.querySelectorAll('.space-item').forEach(item => {
            item.addEventListener('click', () => {
                const spaceId = item.getAttribute('data-space-id');
                const space = this.spaces.find(s => s.id === spaceId);
                if (space) this.selectSpace(space);
            });
        });
    }

    selectSpace(space) {
        this.currentSpace = space;
        this.renderSpaces();
        this.loadProjects();
    }

    async createNewSpace() {
        if (this.spaces.length >= 10) {
            this.showError('Maximum 10 spaces allowed');
            return;
        }

        const spaceName = prompt('Enter space name:');
        if (!spaceName) return;

        try {
            const token = localStorage.getItem('fusionToken');
            const response = await fetch('/api/spaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: spaceName })
            });

            if (!response.ok) throw new Error('Failed to create space');

            const newSpace = await response.json();
            this.spaces.push(newSpace);
            this.renderSpaces();
            this.selectSpace(newSpace);
            this.showSuccess(`Space "${spaceName}" created!`);
        } catch (error) {
            console.error('Error creating space:', error);
            this.showError('Failed to create space');
        }
    }

    // ============================================
    // PROJECTS MANAGEMENT
    // ============================================

    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            const data = await response.json();
            this.projects = data.projects || [];
            this.renderProjects();
        } catch (error) {
            console.error('Error loading projects:', error);
            this.addVerboseLog('error', 'Failed to load projects: ' + error.message);
        }
    }

    renderProjects() {
        const projectsList = document.getElementById('projects-list');
        if (!projectsList) return;

        const loading = projectsList.querySelector('.projects-loading');
        const empty = projectsList.querySelector('.projects-empty');

        if (this.projects.length === 0) {
            loading?.classList.add('hidden');
            empty?.classList.remove('hidden');
        } else {
            loading?.classList.add('hidden');
            empty?.classList.add('hidden');

            const projectsHtml = this.projects.map(project => `
                <div class="project-item ${project.name === this.selectedProject?.name ? 'selected' : ''}" data-project="${project.name}">
                    <div class="project-name" title="${project.name}">${project.name}</div>
                    <div class="project-details">${project.fileCount} files • ${new Date(project.createdAt).toLocaleDateString()}</div>
                </div>
            `).join('');

            projectsList.innerHTML = projectsHtml;

            projectsList.querySelectorAll('.project-item').forEach(item => {
                item.addEventListener('click', () => {
                    const projectName = item.getAttribute('data-project');
                    const project = this.projects.find(p => p.name === projectName);
                    if (project) this.selectProject(project);
                });
            });
        }
    }

    selectProject(project) {
        this.selectedProject = project;
        this.renderProjects();
        if (project.url) {
            this.loadProjectPreview(project.url);
        }
        this.updateGenerateButton();
    }

    updateGenerateButton() {
        const btn = document.getElementById('generate-btn');
        const label = document.getElementById('input-label');
        const input = document.getElementById('prompt-input');

        if (this.selectedProject) {
            btn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Continue Building</span>';
            label.textContent = 'What would you like to add or modify?';
            input.placeholder = `Describe changes to ${this.selectedProject.name}... (e.g., 'Add dark mode', 'Fix bugs on the dashboard')`;
        } else {
            btn.innerHTML = '<span class="btn-icon">✨</span><span class="btn-text">Generate App</span>';
            label.textContent = 'What would you like to build?';
            input.placeholder = "Describe your web app idea... (e.g., 'Create a todo app with drag and drop functionality')";
        }
    }

    // ============================================
    // GENERATION & PREVIEW
    // ============================================

    async handleGenerate() {
        const promptInput = document.getElementById('prompt-input');
        const prompt = promptInput.value.trim();

        if (!prompt) {
            this.showError('Please enter a prompt');
            return;
        }

        this.setLoading(true);
        this.addLogEntry('info', `🚀 Starting generation${this.selectedProject ? ' (continuing)' : ''}`);
        this.addVerboseLog('info', `Generation request: "${prompt}"`);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    continueFromProject: this.selectedProject?.name || null
                })
            });

            const data = await response.json();
            if (data.generationId) {
                this.currentGenerationId = data.generationId;
                this.pollGenerationStatus();
            } else {
                this.showError(data.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Generation error:', error);
            this.showError('Failed to start generation');
            this.addVerboseLog('error', 'Generation error: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    pollGenerationStatus() {
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/status/${this.currentGenerationId}`);
                const status = await response.json();

                if (status.progress) {
                    status.progress.forEach(entry => {
                        if (entry.type === 'info') {
                            this.addLogEntry('info', entry.message);
                        } else if (entry.type === 'success') {
                            this.addLogEntry('success', entry.message);
                        } else if (entry.type === 'error') {
                            this.addLogEntry('error', entry.message);
                        }
                    });
                }

                if (status.verboseLogs) {
                    status.verboseLogs.forEach(log => {
                        this.addVerboseLog(log.type || 'info', log.message || log);
                    });
                }

                const statusEl = document.getElementById('progress-status');
                if (statusEl) {
                    statusEl.textContent = status.status === 'complete' ? 'Complete!' : 'Generating...';
                }

                if (status.status === 'complete' && status.projectPath) {
                    clearInterval(this.pollInterval);
                    this.addLogEntry('success', '✅ Generation complete!');
                    this.addVerboseLog('success', 'Project generated successfully');
                    
                    document.getElementById('prompt-input').value = '';
                    this.selectedProject = null;
                    this.updateGenerateButton();
                    
                    // Reload projects to show the new one
                    setTimeout(() => this.loadProjects(), 1000);
                }
            } catch (error) {
                console.error('Poll error:', error);
                this.addVerboseLog('error', 'Status poll error: ' + error.message);
            }
        }, 2000);
    }

    loadProjectPreview(url) {
        const iframe = document.getElementById('preview-iframe');
        const placeholder = document.getElementById('preview-placeholder');

        if (iframe) {
            iframe.src = url;
            placeholder.style.display = 'none';
        }
    }

    refreshPreview() {
        const iframe = document.getElementById('preview-iframe');
        if (iframe) {
            iframe.src = iframe.src;
        }
    }

    openInNewTab() {
        const iframe = document.getElementById('preview-iframe');
        if (iframe && iframe.src !== 'about:blank') {
            window.open(iframe.src, '_blank');
        }
    }

    clearPreview() {
        const iframe = document.getElementById('preview-iframe');
        const placeholder = document.getElementById('preview-placeholder');
        if (iframe) iframe.src = 'about:blank';
        if (placeholder) placeholder.style.display = 'flex';
    }

    // ============================================
    // LOGGING
    // ============================================

    initializeVerboseLogs() {
        const verboseLogContent = document.getElementById('verbose-log-content');
        if (verboseLogContent) {
            verboseLogContent.classList.add('collapsed');
        }
    }

    addLogEntry(type, message) {
        const progressLog = document.getElementById('progress-log');
        if (!progressLog) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        const icons = { info: '📝', success: '✅', error: '❌' };
        entry.innerHTML = `<span class="log-icon">${icons[type] || '•'}</span><span class="log-text">${message}</span>`;
        progressLog.appendChild(entry);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    addVerboseLog(type, message) {
        const verboseLog = document.getElementById('verbose-log');
        if (!verboseLog) return;

        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
        verboseLog.value += logMessage;
        verboseLog.scrollTop = verboseLog.scrollHeight;
    }

    clearVerboseLogs() {
        const verboseLog = document.getElementById('verbose-log');
        if (verboseLog) verboseLog.value = '';
    }

    copyVerboseLogs() {
        const verboseLog = document.getElementById('verbose-log');
        if (verboseLog && verboseLog.value) {
            navigator.clipboard.writeText(verboseLog.value);
            this.showSuccess('Logs copied to clipboard!');
        }
    }

    toggleVerboseLogs() {
        const verboseLogContent = document.getElementById('verbose-log-content');
        const toggleIcon = document.getElementById('toggle-logs-icon');

        if (verboseLogContent) {
            verboseLogContent.classList.toggle('collapsed');
            if (toggleIcon) {
                toggleIcon.textContent = verboseLogContent.classList.contains('collapsed') ? '▶' : '▼';
            }
        }
    }

    // ============================================
    // GITHUB INTEGRATION
    // ============================================

    openGitHubModal() {
        document.getElementById('github-import-modal')?.classList.remove('hidden');
    }

    closeGitHubModal() {
        document.getElementById('github-import-modal')?.classList.add('hidden');
        document.getElementById('github-url').value = '';
        document.getElementById('github-branch').value = 'main';
    }

    async handleGitHubImport() {
        const url = document.getElementById('github-url')?.value || '';
        const branch = document.getElementById('github-branch')?.value || 'main';

        if (!url) {
            this.showError('Please enter a GitHub URL');
            return;
        }

        this.setLoading(true);
        this.addVerboseLog('info', `Importing from GitHub: ${url} (${branch})`);

        try {
            // In production, this would call a backend endpoint to clone the repo
            // For now, we'll just show a placeholder message
            this.addLogEntry('info', `📦 Importing repository: ${url.split('/').pop()}`);
            this.addVerboseLog('info', 'GitHub import feature coming soon - backend implementation required');
            
            this.showSuccess('GitHub import feature coming soon!');
            this.closeGitHubModal();
        } catch (error) {
            console.error('GitHub import error:', error);
            this.showError('GitHub import failed');
            this.addVerboseLog('error', 'GitHub import error: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    // ============================================
    // MODALS
    // ============================================

    openInfoModal() {
        document.getElementById('info-modal')?.classList.remove('hidden');
    }

    closeInfoModal() {
        document.getElementById('info-modal')?.classList.add('hidden');
    }

    // ============================================
    // UTILITIES
    // ============================================

    setLoading(isLoading) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (isLoading) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    }

    showSuccess(message) {
        console.log('✅ ' + message);
        // Could add toast notification here
    }

    showError(message) {
        console.error('❌ ' + message);
        this.addLogEntry('error', message);
        // Could add toast notification here
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fusionApp = new FusionApp();
});
