// controllers/sessionController.js
const SessionController = {
    // Load all sessions
    async loadSessions() {
        try {
            const user = AuthController.getCurrentUser();
            if (!user) return null;
            
            const sessions = await TTMS.fetchSessions();
            
            // Sort by session (newest first)
            const sortedSessions = sessions.sort((a, b) => {
                const aKey = `${a.sesi}-${a.semester}`;
                const bKey = `${b.sesi}-${b.semester}`;
                return bKey.localeCompare(aKey);
            });
            
            return {
                sessions: sortedSessions,
                total: sessions.length,
                current: TTMS.getCurrentSession()
            };
            
        } catch (error) {
            console.error('Error loading sessions:', error);
            AuthController.showAlert('Failed to load sessions: ' + error.message, 'danger');
            return null;
        }
    },

    // Get session by ID
    getSessionById(sessions, sesi, semester) {
        return sessions.find(s => 
            s.sesi === sesi && s.semester.toString() === semester.toString()
        );
    },

    // Select a session
    selectSession(sesi, semester) {
        try {
            TTMS.setCurrentSession(sesi, semester);
            const session = { sesi, semester };
            
            // Update localStorage
            localStorage.setItem('currentSession', JSON.stringify(session));
            
            AuthController.showAlert(`Session changed to ${sesi}-${semester}`, 'success');
            return session;
            
        } catch (error) {
            console.error('Error selecting session:', error);
            AuthController.showAlert('Failed to change session', 'danger');
            return null;
        }
    },

    // Get current session info
    getCurrentSessionInfo() {
        const session = TTMS.getCurrentSession();
        return {
            ...session,
            display: `${session.sesi}-${session.semester}`,
            isCurrent: true
        };
    },

    // Format session for display
    formatSession(session) {
        if (!session) return 'N/A';
        return `${session.sesi}-${session.semester}`;
    },

    // Get session status
    getSessionStatus(session) {
        const currentSession = TTMS.getCurrentSession();
        const isCurrent = session.sesi === currentSession.sesi && 
                         session.semester.toString() === currentSession.semester;
        
        if (isCurrent) {
            return { text: 'Active', class: 'bg-primary', badge: 'Current' };
        }
        
        const sessionDate = new Date(session.tarikh_tamat || session.tarikh_mula || new Date());
        const now = new Date();
        
        if (sessionDate < now) {
            return { text: 'Completed', class: 'bg-secondary', badge: 'Archived' };
        } else {
            return { text: 'Upcoming', class: 'bg-success', badge: 'Future' };
        }
    },

    // Get sessions by status
    filterSessionsByStatus(sessions, status) {
        return sessions.filter(session => {
            const sessionStatus = this.getSessionStatus(session);
            return sessionStatus.text.toLowerCase() === status.toLowerCase();
        });
    },

    // Get session statistics
    getSessionStatistics(sessions) {
        const stats = {
            total: sessions.length,
            active: 0,
            upcoming: 0,
            completed: 0,
            byYear: {}
        };
        
        sessions.forEach(session => {
            const status = this.getSessionStatus(session);
            
            if (status.text === 'Active') stats.active++;
            else if (status.text === 'Upcoming') stats.upcoming++;
            else if (status.text === 'Completed') stats.completed++;
            
            // Group by year
            const year = session.sesi.split('/')[0];
            stats.byYear[year] = (stats.byYear[year] || 0) + 1;
        });
        
        return stats;
    },

    // Get courses for a session
    async getSessionCourses(sesi, semester) {
        try {
            // Save current session
            const oldSession = TTMS.getCurrentSession();
            
            // Temporarily set to target session
            TTMS.setCurrentSession(sesi, semester);
            
            // Fetch courses
            const courses = await TTMS.fetchCourses();
            
            // Restore original session
            TTMS.setCurrentSession(oldSession.sesi, oldSession.semester);
            
            return {
                session: { sesi, semester },
                courses: courses,
                total: courses.length
            };
            
        } catch (error) {
            console.error('Error getting session courses:', error);
            return null;
        }
    },

    // Export sessions to CSV
    exportToCSV(sessions, filename = 'sessions_export.csv') {
        if (sessions.length === 0) {
            AuthController.showAlert('No sessions to export', 'warning');
            return;
        }
        
        const headers = ['Session', 'Start Date', 'End Date', 'Status', 'Duration'];
        
        const csvContent = [
            headers.join(','),
            ...sessions.map(session => {
                const status = this.getSessionStatus(session);
                const startDate = AuthController.formatDate(session.tarikh_mula);
                const endDate = AuthController.formatDate(session.tarikh_tamat);
                
                return [
                    `"${session.sesi}-${session.semester}"`,
                    `"${startDate}"`,
                    `"${endDate}"`,
                    `"${status.text}"`,
                    `"${this.calculateDuration(session)} days"`
                ].join(',');
            })
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        
        AuthController.showAlert(`Exported ${sessions.length} sessions to CSV`, 'success');
    },

    // Calculate session duration
    calculateDuration(session) {
        if (!session.tarikh_mula || !session.tarikh_tamat) return 'N/A';
        
        try {
            const start = new Date(session.tarikh_mula);
            const end = new Date(session.tarikh_tamat);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch (error) {
            return 'N/A';
        }
    },

    // Get upcoming sessions
    getUpcomingSessions(sessions, limit = 5) {
        const now = new Date();
        return sessions
            .filter(session => {
                const startDate = new Date(session.tarikh_mula || now);
                return startDate > now;
            })
            .sort((a, b) => new Date(a.tarikh_mula) - new Date(b.tarikh_mula))
            .slice(0, limit);
    },

    // Get session timeline data
    getSessionTimeline(sessions) {
        return sessions.map(session => ({
            id: `${session.sesi}-${session.semester}`,
            content: `${session.sesi}-${session.semester}`,
            start: session.tarikh_mula,
            end: session.tarikh_tamat,
            className: this.getSessionStatus(session).class.replace('bg-', '')
        }));
    },

    // Validate session dates
    validateSession(session) {
        const errors = [];
        
        if (!session.sesi) errors.push('Session year is required');
        if (!session.semester) errors.push('Semester is required');
        if (!session.tarikh_mula) errors.push('Start date is required');
        if (!session.tarikh_tamat) errors.push('End date is required');
        
        if (session.tarikh_mula && session.tarikh_tamat) {
            const start = new Date(session.tarikh_mula);
            const end = new Date(session.tarikh_tamat);
            
            if (start >= end) {
                errors.push('End date must be after start date');
            }
            
            // Check if duration is reasonable (14-20 weeks)
            const duration = this.calculateDuration(session);
            if (duration < 14 * 7 || duration > 20 * 7) {
                errors.push('Session duration should be between 14-20 weeks');
            }
        }
        
        return errors;
    },

    // Generate next session
    generateNextSession(currentSession) {
        const [startYear, endYear] = currentSession.sesi.split('/').map(Number);
        let nextSesi, nextSemester;
        
        if (currentSession.semester === '1') {
            nextSesi = `${startYear}/${endYear}`;
            nextSemester = '2';
        } else {
            nextSesi = `${endYear}/${endYear + 1}`;
            nextSemester = '1';
        }
        
        return {
            sesi: nextSesi,
            semester: nextSemester,
            tarikh_mula: this.calculateNextStartDate(currentSession),
            tarikh_tamat: this.calculateNextEndDate(currentSession)
        };
    },

    // Calculate next start date
    calculateNextStartDate(currentSession) {
        const endDate = new Date(currentSession.tarikh_tamat || new Date());
        // Next session starts 2 weeks after current ends
        endDate.setDate(endDate.getDate() + 14);
        return endDate.toISOString().split('T')[0];
    },

    // Calculate next end date
    calculateNextEndDate(currentSession) {
        const startDate = new Date(this.calculateNextStartDate(currentSession));
        // Session lasts 14 weeks
        startDate.setDate(startDate.getDate() + (14 * 7));
        return startDate.toISOString().split('T')[0];
    },

    // Get academic calendar events
    getAcademicCalendar(session) {
        if (!session) return [];
        
        const startDate = new Date(session.tarikh_mula);
        const events = [
            { week: 1, event: 'Orientation Week', date: this.addDays(startDate, 0) },
            { week: 2, event: 'Classes Begin', date: this.addDays(startDate, 7) },
            { week: 7, event: 'Mid-Semester Break', date: this.addDays(startDate, 42) },
            { week: 8, event: 'Classes Resume', date: this.addDays(startDate, 49) },
            { week: 14, event: 'Study Week', date: this.addDays(startDate, 91) },
            { week: 15, event: 'Final Examinations', date: this.addDays(startDate, 98) },
            { week: 16, event: 'Results Release', date: this.addDays(startDate, 112) }
        ];
        
        return events;
    },

    // Helper: add days to date
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
};

// Make globally available
window.SessionController = SessionController;