// controllers/accessController.js
const AccessController = {
    // Define access matrix
    accessMatrix: {
        student: {
            dashboard: ['view'],
            mycourses: ['view'],
            courses: ['view'],
            sessions: ['view'],
            clash: ['view', 'detect'],
            utilization: ['view'], // Students can view but not manage
            studentcount: ['view']
        },
        lecturer: {
            dashboard: ['view'],
            mycourses: ['view'],
            courses: ['view', 'manage_own'],
            sessions: ['view', 'manage_own'],
            clash: ['view', 'detect', 'resolve_own'],
            utilization: ['view', 'analyze'],
            studentcount: ['view']
        },
        admin: {
            dashboard: ['view', 'manage'],
            mycourses: ['view'],
            courses: ['view', 'create', 'edit', 'delete', 'manage_all'],
            sessions: ['view', 'create', 'edit', 'delete', 'manage_all'],
            clash: ['view', 'detect', 'resolve_all', 'generate_reports'],
            utilization: ['view', 'analyze', 'manage', 'generate_reports'],
            users: ['view', 'create', 'edit', 'delete', 'manage_roles'],
            data: ['import', 'export', 'sync']
        }
    },

    // Check if user has permission
    hasPermission(user, module, action) {
        if (!user || !user.role) return false;
        
        const rolePermissions = this.accessMatrix[user.role];
        if (!rolePermissions || !rolePermissions[module]) return false;
        
        return rolePermissions[module].includes(action);
    },

    // Get allowed modules for user
    getAllowedModules(user) {
        if (!user || !user.role) return [];
        
        const rolePermissions = this.accessMatrix[user.role];
        return Object.keys(rolePermissions || {});
    },

    // Show/hide UI elements based on permissions
    applyUIRestrictions(user) {
        const userRole = user?.role || 'student';
        
        // Hide admin-only elements
        if (userRole !== 'admin') {
            document.querySelectorAll('[data-requires="admin"]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        // Hide lecturer-only elements from students
        if (userRole === 'student') {
            document.querySelectorAll('[data-requires="lecturer"]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        // Update UI labels based on role
        this.updateUILabels(userRole);
    },

    // Update UI labels based on role
    updateUILabels(role) {
        const labels = {
            courses: {
                student: 'Course Catalog',
                lecturer: 'Teaching Schedule',
                admin: 'Course Management'
            },
            sessions: {
                student: 'Session View',
                lecturer: 'My Sessions',
                admin: 'Session Management'
            }
        };
        
        Object.entries(labels).forEach(([key, value]) => {
            const element = document.querySelector(`[data-label="${key}"]`);
            if (element && value[role]) {
                element.textContent = value[role];
            }
        });
    }
};

// Make globally available
window.AccessController = AccessController;