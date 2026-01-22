// controllers/authController.js
const AuthController = {
  // Check if user is authenticated
  isAuthenticated() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Get current user
  getCurrentUser() {
    return this.isAuthenticated();
  },

  // Login function with automatic role detection
  async login(username, password, role = null) {
    try {
      console.log(`Attempting login for ${username}${role ? ' as ' + role : ''}`);

      // Use TTMS login
      const response = await TTMS.login(username, password, role || 'student');

      if (response.status === "success") {
        // Prefer TTMS-detected role first
        let detectedRole = response.role || role;
        if (!detectedRole) {
          console.log('🔍 No role provided, detecting...');
          detectedRole = await this.detectUserRole(username);
        }

        const user = {
          username,
          name: response.full_name || response.nama || username,
          role: detectedRole,
          description: response.description || (detectedRole.charAt(0).toUpperCase() + detectedRole.slice(1)),
          loginTime: new Date().toISOString(),

          // Backward compatible field name used by some UI code
          session_id: response.user_session_id || response.session_id || null,

          // keep these too
          user_session_id: response.user_session_id || null,
          admin_session_id: response.admin_session_id || null,
          login_name: response.login_name || null
        };

        console.log("✅ Login successful:", user);
        return { success: true, user };
      }

      return {
        success: false,
        message: response.message || "Invalid credentials"
      };
    } catch (error) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        message: "Network error. Please check your connection."
      };
    }
  },
    // Detect user role automatically
    async detectUserRole(username) {
    try {
      console.log('🔍 Step 1: Detecting role for username:', username);

      // 1) Lecturer check
      try {
        const lecturers = await TTMS.fetchLecturers();
        const isLecturer = lecturers.some(lecturer =>
          lecturer.kod_pensyarah === username ||
          lecturer.no_pekerja === username ||
          lecturer.no_kp === username ||
          lecturer.email === username
        );
        if (isLecturer) return 'lecturer';
      } catch {}
            
      // 2) Student check
      try {
        const studentCourses = await TTMS.fetchMyCourses(username);
        if (studentCourses && studentCourses.length > 0) return 'student';
      } catch {}

      
            
            // Step 3: Check if username pattern suggests admin
            console.log('🔍 Step 3: Checking admin patterns...');
            if (username.toLowerCase().startsWith('admin') || 
                username.toLowerCase().includes('admin')) {
                console.log('✅ DETECTED AS ADMIN (by username pattern)');
                return 'admin';
            }
            
            // Step 4: Check username pattern for student
            console.log('🔍 Step 4: Checking username patterns...');
            
            // Student matric patterns
            // Pattern 1: A12345, B67890 (Letter + 5-6 digits)
            if (/^[A-Z]\d{5,6}$/i.test(username)) {
                console.log('✅ DETECTED AS STUDENT (matric pattern: Letter+Digits)');
                return 'student';
            }
            
            // Pattern 2: A12345B (Letter + digits + Letter)
            if (/^[A-Z]\d{5}[A-Z]$/i.test(username)) {
                console.log('✅ DETECTED AS STUDENT (matric pattern: Letter+Digits+Letter)');
                return 'student';
            }
            
            // Pattern 3: Pure digits (might be staff ID, default to student for now)
            if (/^\d+$/.test(username)) {
                console.log('⚠️ Pure digits detected, defaulting to STUDENT');
                return 'student';
            }
            
            // Default to student
            console.log('⚠️ No pattern matched, defaulting to STUDENT');
            return 'student';
            
      // 3) Admin heuristic
      if (username.toLowerCase().includes('admin')) return 'admin';

      return 'student';
    } catch {
      return 'student';
    }
    },

    // Logout function
    logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('currentSession');
        window.location.href = 'views/login.html';
    },

    // Check if user has access to a specific feature
    hasAccess(feature, userRole) {
        const accessMatrix = {
            'student': ['dashboard', 'mycourses', 'courses', 'sessions', 'clash'],
            'lecturer': ['dashboard', 'courses', 'sessions', 'clash', 'utilization'],
            'admin': ['dashboard', 'mycourses', 'courses', 'sessions', 'clash', 'utilization']
        };
        
        return accessMatrix[userRole]?.includes(feature) || false;
    },

    // Initialize session
    initSession() {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'views/login.html';
            return null;
        }
        
        // Set default session if not exists
        if (!localStorage.getItem('currentSession')) {
            TTMS.setCurrentSession('2025/2026', '1');
        }
        
        return user;
    },

    // Show alert message
    showAlert(message, type = 'info') {
        // Create alert element
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Remove existing alerts
        document.querySelectorAll('.alert-dismissible').forEach(alert => alert.remove());
        
        // Add new alert
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            document.querySelectorAll('.alert-dismissible').forEach(alert => {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            });
        }, 5000);
    },

    // Format date
    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-MY', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateStr;
        }
    },

    // Get role badge class
    getRoleBadgeClass(role) {
        return {
            'student-badge': role === 'student',
            'lecturer-badge': role === 'lecturer',
            'admin-badge': role === 'admin'
        };
    }
};

// Make globally available
window.AuthController = AuthController;
console.log('✅ AuthController loaded with automatic role detection');