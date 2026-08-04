document.addEventListener('DOMContentLoaded', () => {
    // Current Active Node Mock ID
    const CURRENT_NODE_ID = "mock-folder-uuid-1234";

    // ----------------------------------------------------
    // Auth Modal Logic
    // ----------------------------------------------------
    const authModal = document.getElementById('auth-modal');
    const userProfileBtn = document.getElementById('user-profile-btn');
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authTitle = document.getElementById('auth-title');
    const authSubmit = document.getElementById('auth-submit');
    
    let isLoginMode = true;
    
    // Check if user is logged in
    const checkAuth = async () => {
        const token = localStorage.getItem('agentcache_token');
        if (!token) {
            authModal.classList.remove('hidden');
            return;
        }
        
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.ok) {
                authModal.classList.add('hidden');
                document.querySelector('.user-name').textContent = data.user.name || data.user.email.split('@')[0];
                document.querySelector('.user-role').textContent = 'Connected (HPC)';
                
                // Load settings into global object for the settings modal
                window.currentUserSettings = data.user.settings || {};
                
                loadNodes();
            } else {
                localStorage.removeItem('agentcache_token');
                authModal.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Auth check failed', err);
        }
    };
    
    userProfileBtn.addEventListener('click', () => {
        if (!localStorage.getItem('agentcache_token')) {
            authModal.classList.remove('hidden');
        }
    });
    
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authTitle.textContent = 'Connect to AgentCache';
            authSubmit.textContent = 'Login';
            authSwitchText.textContent = 'New to AgentCache?';
            authSwitchLink.textContent = 'Create an account';
        } else {
            authTitle.textContent = 'Create HPC Account';
            authSubmit.textContent = 'Sign Up';
            authSwitchText.textContent = 'Already have an account?';
            authSwitchLink.textContent = 'Login here';
        }
    });
    
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const action = isLoginMode ? 'login' : 'signup';
        
        authSubmit.textContent = 'Processing...';
        authError.classList.add('hidden');
        
        try {
            const res = await fetch(`/api/auth/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: email.split('@')[0] })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('agentcache_token', data.token);
                checkAuth();
            } else {
                authError.textContent = data.error || 'Authentication failed';
                authError.classList.remove('hidden');
            }
        } catch (err) {
            authError.textContent = 'Network error connecting to auth server.';
            authError.classList.remove('hidden');
        } finally {
            authSubmit.textContent = isLoginMode ? 'Login' : 'Sign Up';
        }
    });
    
    // ----------------------------------------------------
    // Settings Modal Logic
    // ----------------------------------------------------
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsForm = document.getElementById('settings-form');
    const settingsMsg = document.getElementById('settings-msg');
    const settingsSubmit = document.getElementById('settings-submit');
    
    settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Populate inputs with current settings
        const s = window.currentUserSettings || {};
        document.getElementById('setting-pqc').checked = !!s.pqcMode;
        document.getElementById('setting-openai').value = s.openaiKey || '';
        document.getElementById('setting-anthropic').value = s.anthropicKey || '';
        document.getElementById('setting-ollama').value = s.ollamaEndpoint || '';
        document.getElementById('setting-slurm').value = s.defaultCluster || '';
        
        settingsMsg.classList.add('hidden');
        settingsModal.classList.remove('hidden');
    });
    
    settingsClose.addEventListener('click', (e) => {
        e.preventDefault();
        settingsModal.classList.add('hidden');
    });
    
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('agentcache_token');
        if (!token) return;
        
        settingsSubmit.textContent = 'Saving...';
        
        const newSettings = {
            pqcMode: document.getElementById('setting-pqc').checked,
            openaiKey: document.getElementById('setting-openai').value,
            anthropicKey: document.getElementById('setting-anthropic').value,
            ollamaEndpoint: document.getElementById('setting-ollama').value,
            defaultCluster: document.getElementById('setting-slurm').value
        };
        
        try {
            const res = await fetch('/api/auth/settings', {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ settings: newSettings })
            });
            
            if (res.ok) {
                const data = await res.json();
                window.currentUserSettings = data.settings;
                settingsMsg.textContent = 'Settings saved successfully!';
                settingsMsg.style.color = '#4caf50';
                settingsMsg.classList.remove('hidden');
                
                // Hide success message after 3 seconds
                setTimeout(() => settingsMsg.classList.add('hidden'), 3000);
            } else {
                settingsMsg.textContent = 'Failed to save settings.';
                settingsMsg.style.color = '#ff5555';
                settingsMsg.classList.remove('hidden');
            }
        } catch (err) {
            settingsMsg.textContent = 'Network error saving settings.';
            settingsMsg.style.color = '#ff5555';
            settingsMsg.classList.remove('hidden');
        } finally {
            settingsSubmit.textContent = 'Save Preferences';
        }
    });

    // ----------------------------------------------------
    // Drop Zone & File List (Magical UI Simulation)
    // ----------------------------------------------------
    const dropZone = document.getElementById('drop-zone');
    const fileList = document.getElementById('file-list');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });
    
    // ----------------------------------------------------
    // Template Gallery Logic
    // ----------------------------------------------------
    const templateModal = document.getElementById('template-modal');
    const templateClose = document.getElementById('template-close');
    const templateBtn = document.getElementById('install-template-btn');
    const templateList = document.getElementById('template-list');
    
    // UI elements to update after install
    const folderBadge = document.getElementById('folder-template-badge');
    const folderDesc = document.getElementById('folder-desc');
    let installedTemplate = null;

    templateBtn.addEventListener('click', async () => {
        templateModal.classList.remove('hidden');
        templateList.innerHTML = '<div style="text-align:center; padding: 20px;"><i data-feather="loader" class="spin"></i> Loading templates...</div>';
        feather.replace();
        
        try {
            const token = localStorage.getItem('agentcache_token');
            const res = await fetch('/api/templates', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            templateList.innerHTML = '';
            
            for (const [packName, templates] of Object.entries(data.packs || {})) {
                const packHeader = document.createElement('h4');
                packHeader.className = 'section-title';
                packHeader.textContent = packName;
                templateList.appendChild(packHeader);
                
                templates.forEach(t => {
                    const card = document.createElement('div');
                    card.style.cssText = "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display:flex; justify-content:space-between; align-items:center;";
                    card.innerHTML = `
                        <div>
                            <div style="font-weight:500; font-size:14px;">${t.name}</div>
                            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${t.description}</div>
                        </div>
                        <button class="btn-outline" onclick="installTemplate('${t.id}', '${t.name.replace(/'/g, "\\'")}')">Install</button>
                    `;
                    templateList.appendChild(card);
                });
            }
        } catch(e) {
            templateList.innerHTML = '<div class="error-text">Failed to load templates.</div>';
        }
    });

    templateClose.addEventListener('click', () => {
        templateModal.classList.add('hidden');
    });

    // Make global for inline onclick
    window.installTemplate = async (templateId, templateName) => {
        const token = localStorage.getItem('agentcache_token');
        try {
            // Mock installation request for now since node doesn't exist in DB
            // const res = await fetch('/api/templates?action=install', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            //     body: JSON.stringify({ templateId, nodeId: CURRENT_NODE_ID })
            // });
            
            templateModal.classList.add('hidden');
            
            // Update UI
            installedTemplate = templateName;
            folderBadge.innerHTML = `<i data-feather="zap"></i> ${templateName}`;
            folderBadge.style.borderColor = 'var(--accent-amber)';
            folderDesc.textContent = `Autonomous agents are watching this folder for assets. Configured as: ${templateName}`;
            feather.replace();
            
            // Clear dropzone
            fileList.innerHTML = `
                <div class="file-row empty-state hidden">
                    <i data-feather="wind"></i>
                    <p>Folder is empty.</p>
                </div>
            `;
            
        } catch(e) {
            console.error(e);
            alert("Installation failed");
        }
    };

    // ----------------------------------------------------
    // Drop Zone & Human-in-the-Loop Workflow Simulation
    // ----------------------------------------------------
    const inputModal = document.getElementById('input-modal');
    const inputFieldsContainer = document.getElementById('input-fields-container');
    const inputForm = document.getElementById('input-form');
    
    let activeWorkflowRow = null;

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (!installedTemplate) {
            alert("Please install a Template Action Pack first!");
            return;
        }
        handleFiles(files);
    });
    
    function handleFiles(files) {
        const emptyState = fileList.querySelector('.empty-state');
        if (emptyState) emptyState.classList.add('hidden');
        
        [...files].forEach(file => {
            const size = (file.size / (1024*1024)).toFixed(2);
            const row = document.createElement('div');
            row.className = 'file-row';
            row.innerHTML = `
                <i data-feather="image" class="file-icon"></i>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${size} MB • Extracted just now</div>
                </div>
                <div class="file-status">
                    <div class="status-dot syncing"></div>
                    <span>Agent analyzing assets...</span>
                </div>
            `;
            fileList.appendChild(row);
            feather.replace();
            
            // Simulate Workflow Execution Engine
            activeWorkflowRow = row;
            
            setTimeout(() => {
                if (installedTemplate.includes('Brochure')) {
                    // Simulate BLOCKED state for Brochure Generator
                    const statusText = row.querySelector('.file-status span');
                    const statusDot = row.querySelector('.status-dot');
                    statusDot.style.background = '#ff9800'; // Orange pause
                    statusDot.classList.remove('syncing');
                    statusText.textContent = 'Blocked: Waiting for User Input';
                    
                    // Show Input Modal
                    inputFieldsContainer.innerHTML = `
                        <div class="input-group">
                            <label>Brochure Title</label>
                            <input type="text" id="brochure-title" required placeholder="e.g. Summer Collection 2026">
                        </div>
                        <div class="input-group">
                            <label>Marketing Copy / Concept</label>
                            <input type="text" id="brochure-copy" required placeholder="Describe the vibe...">
                        </div>
                    `;
                    inputModal.classList.remove('hidden');
                } else {
                    // Standard pass-through (e.g. Web Gallery Generator)
                    const statusDot = row.querySelector('.status-dot');
                    const statusText = row.querySelector('.file-status span');
                    statusDot.classList.remove('syncing');
                    statusDot.classList.add('cached');
                    statusText.textContent = 'Generated Webpage (Complete)';
                }
            }, 2000);
        });
    }

    // Submit User Input and Resume execution
    inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        inputModal.classList.add('hidden');
        
        if (activeWorkflowRow) {
            const statusDot = activeWorkflowRow.querySelector('.status-dot');
            const statusText = activeWorkflowRow.querySelector('.file-status span');
            
            // Resume
            statusDot.style.background = '';
            statusDot.classList.add('syncing');
            statusText.textContent = 'Compiling PDF Brochure...';
            
            // Finish
            setTimeout(() => {
                statusDot.classList.remove('syncing');
                statusDot.classList.add('cached');
                statusText.innerHTML = '<a href="#" style="color:#d4a574;">View Generated Brochure.pdf</a>';
            }, 3000);
        }
    });

    // Initialize
    checkAuth();
});

async function loadNodes() {
    // Hook for fetching actual node data
}
