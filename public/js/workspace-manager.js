/**
 * Workspace Manager
 * Handles localStorage persistence and CRUD operations for user workspaces
 */

class WorkspaceManager {
  constructor() {
    this.storageKey = 'agentcache_workspaces';
  }

  /**
   * Get all workspaces
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      return [];
    }
  }

  /**
   * Get workspace by ID
   */
  getById(id) {
    const workspaces = this.getAll();
    return workspaces.find(w => w.id === id);
  }

  /**
   * Save new workspace
   */
  save(workspace) {
    try {
      const workspaces = this.getAll();
      
      // Check if workspace already exists
      const existingIndex = workspaces.findIndex(w => w.id === workspace.id);
      
      if (existingIndex >= 0) {
        // Update existing
        workspaces[existingIndex] = {
          ...workspaces[existingIndex],
          ...workspace,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new
        workspaces.push({
          ...workspace,
          createdAt: workspace.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(workspaces));
      return true;
    } catch (error) {
      console.error('Failed to save workspace:', error);
      return false;
    }
  }

  /**
   * Update existing workspace
   */
  update(id, updates) {
    try {
      const workspaces = this.getAll();
      const index = workspaces.findIndex(w => w.id === id);
      
      if (index >= 0) {
        workspaces[index] = {
          ...workspaces[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(this.storageKey, JSON.stringify(workspaces));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update workspace:', error);
      return false;
    }
  }

  /**
   * Delete workspace by ID
   */
  delete(id) {
    try {
      const workspaces = this.getAll();
      const filtered = workspaces.filter(w => w.id !== id);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      return false;
    }
  }

  /**
   * Get workspaces by sector
   */
  getBySector(sector) {
    return this.getAll().filter(w => w.sector === sector);
  }

  /**
   * Get recently updated workspaces
   */
  getRecent(limit = 5) {
    const workspaces = this.getAll();
    return workspaces
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, limit);
  }

  /**
   * Search workspaces by name or sector
   */
  search(query) {
    const workspaces = this.getAll();
    const lowerQuery = query.toLowerCase();
    return workspaces.filter(w => 
      w.name.toLowerCase().includes(lowerQuery) ||
      w.sector?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export workspace as JSON
   */
  export(id) {
    const workspace = this.getById(id);
    if (!workspace) return null;
    
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workspace
    };
  }

  /**
   * Import workspace from JSON
   */
  import(data) {
    try {
      if (!data.workspace) {
        throw new Error('Invalid workspace data');
      }
      
      // Generate new ID to avoid conflicts
      const workspace = {
        ...data.workspace,
        id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        importedAt: new Date().toISOString()
      };
      
      return this.save(workspace) ? workspace : null;
    } catch (error) {
      console.error('Failed to import workspace:', error);
      return null;
    }
  }

  /**
   * Clear all workspaces
   */
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Failed to clear workspaces:', error);
      return false;
    }
  }

  /**
   * Get workspace statistics
   */
  getStats() {
    const workspaces = this.getAll();
    const sectors = {};
    
    workspaces.forEach(w => {
      if (w.sector) {
        sectors[w.sector] = (sectors[w.sector] || 0) + 1;
      }
    });
    
    return {
      total: workspaces.length,
      bySector: sectors,
      mostRecent: workspaces.length > 0 
        ? workspaces.reduce((latest, w) => 
            new Date(w.updatedAt || w.createdAt) > new Date(latest.updatedAt || latest.createdAt) 
              ? w : latest
          )
        : null
    };
  }
}

// Create singleton instance
const workspaceManager = new WorkspaceManager();

// Export for use in modules or direct access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkspaceManager;
}
