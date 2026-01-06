// controllers/courseController.js
const CourseController = {
    cache: {
        courses: null,
        lastFetch: null,
        cacheDuration: 2 * 60 * 1000 // 2 minutes cache
    },

    // Load REAL courses from TTMS
    async loadCourses() {
        try {
            const user = AuthController.getCurrentUser();
            if (!user) {
                console.error('No user authenticated');
                return null;
            }
            
            // Check cache
            const now = Date.now();
            if (this.cache.courses && this.cache.lastFetch && 
                (now - this.cache.lastFetch) < this.cache.cacheDuration) {
                console.log('Using cached REAL courses data');
                return this.cache.courses;
            }
            
            console.log('Fetching REAL courses from TTMS...');
            
            // Get current session
            const currentSession = TTMS.getCurrentSession();
            
            // Fetch REAL courses from TTMS
            const courses = await TTMS.fetchCourses();
            
            if (!courses || courses.length === 0) {
                console.log('TTMS returned empty courses array');
                AuthController.showAlert('No course data available from TTMS for current session', 'warning');
            } else {
                console.log(`Retrieved ${courses.length} REAL courses from TTMS`);
            }
            
            // Calculate statistics from REAL data
            const currentCourses = courses.filter(c => 
                c.sesi === currentSession.sesi && 
                c.semester.toString() === currentSession.semester
            );
            
            const lecturers = new Set();
            const faculties = new Set();
            let totalStudents = 0;
            
            currentCourses.forEach(course => {
                if (course.kod_pensyarah) lecturers.add(course.kod_pensyarah);
                if (course.kod_subjek) {
                    const faculty = course.kod_subjek.substring(0, 2);
                    if (faculty) faculties.add(faculty);
                }
                totalStudents += parseInt(course.bil_pelajar) || 0;
            });
            
            const stats = {
                totalCourses: courses.length,
                currentCourses: currentCourses.length,
                totalStudents: totalStudents,
                uniqueLecturers: lecturers.size,
                uniqueFaculties: faculties.size,
                dataSource: 'TTMS Live',
                lastUpdated: new Date().toLocaleTimeString()
            };
            
            const result = {
                courses: courses,
                stats: stats,
                currentSession: currentSession,
                timestamp: now
            };
            
            // Cache the results
            this.cache.courses = result;
            this.cache.lastFetch = now;
            
            return result;
            
        } catch (error) {
            console.error('ERROR loading REAL courses:', error);
            AuthController.showAlert('Failed to load REAL courses from TTMS', 'danger');
            return null;
        }
    },

    // Filter REAL courses
    filterCourses(courses, filters = {}) {
        const {
            searchTerm = '',
            sessionFilter = 'current',
            facultyFilter = 'all'
        } = filters;
        
        const currentSession = TTMS.getCurrentSession();
        
        return courses.filter(course => {
            let sessionMatch = true;
            let facultyMatch = true;
            let searchMatch = true;
            
            // Session filter
            if (sessionFilter === 'current') {
                sessionMatch = course.sesi === currentSession.sesi && 
                              course.semester.toString() === currentSession.semester;
            } else if (sessionFilter !== 'all') {
                const [sesi, semester] = sessionFilter.split('-');
                sessionMatch = course.sesi === sesi && 
                              course.semester.toString() === semester;
            }
            
            // Faculty filter
            if (facultyFilter !== 'all') {
                facultyMatch = course.kod_subjek && course.kod_subjek.startsWith(facultyFilter);
            }
            
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                searchMatch = 
                    (course.kod_subjek && course.kod_subjek.toLowerCase().includes(term)) ||
                    (course.nama_subjek && course.nama_subjek.toLowerCase().includes(term)) ||
                    (course.kod_pensyarah && course.kod_pensyarah.toLowerCase().includes(term)) ||
                    (course.nama_pensyarah && course.nama_pensyarah.toLowerCase().includes(term));
            }
            
            return sessionMatch && facultyMatch && searchMatch;
        });
    },

    // Get course statistics from REAL data
    getCourseStatistics(courses) {
        const currentSession = TTMS.getCurrentSession();
        const currentCourses = courses.filter(c => 
            c.sesi === currentSession.sesi && 
            c.semester.toString() === currentSession.semester
        );
        
        const lecturers = new Set();
        const faculties = new Set();
        let totalStudents = 0;
        
        currentCourses.forEach(course => {
            if (course.kod_pensyarah) lecturers.add(course.kod_pensyarah);
            if (course.kod_subjek) {
                const faculty = course.kod_subjek.substring(0, 2);
                if (faculty) faculties.add(faculty);
            }
            totalStudents += parseInt(course.bil_pelajar) || 0;
        });
        
        return {
            totalCourses: courses.length,
            currentCourses: currentCourses.length,
            totalStudents: totalStudents,
            uniqueLecturers: lecturers.size,
            uniqueFaculties: faculties.size,
            byFaculty: this.groupByFaculty(courses),
            byLevel: this.groupByLevel(courses)
        };
    },

    // Group courses by faculty from REAL data
    groupByFaculty(courses) {
        const faculties = {};
        
        courses.forEach(course => {
            if (course.kod_subjek) {
                const facultyCode = course.kod_subjek.substring(0, 2);
                if (facultyCode) {
                    faculties[facultyCode] = (faculties[facultyCode] || 0) + 1;
                }
            }
        });
        
        return faculties;
    },

    // Group courses by level from REAL data
    groupByLevel(courses) {
        const levels = {};
        
        courses.forEach(course => {
            if (course.kod_subjek) {
                // Extract level from course code (e.g., "CS"123 -> 1 = level 1)
                const levelMatch = course.kod_subjek.match(/\d/);
                if (levelMatch) {
                    const level = levelMatch[0];
                    levels[level] = (levels[level] || 0) + 1;
                }
            }
        });
        
        return levels;
    },

    // Clear cache
    clearCache() {
        this.cache.courses = null;
        this.cache.lastFetch = null;
        console.log('Course cache cleared');
    },

    // Export REAL courses to CSV
    exportToCSV(courses, filename = 'ttms_courses_export.csv') {
        if (courses.length === 0) {
            AuthController.showAlert('No REAL courses to export', 'warning');
            return;
        }
        
        const headers = ['Course Code', 'Course Name', 'Session', 'Semester', 'Sections', 'Lecturer Code', 'Students', 'Room', 'Day', 'Time'];
        
        const csvContent = [
            headers.join(','),
            ...courses.map(course => [
                `"${course.kod_subjek || ''}"`,
                `"${course.nama_subjek || ''}"`,
                `"${course.sesi || ''}"`,
                `"${course.semester || ''}"`,
                `"${course.bil_seksyen || '0'}"`,
                `"${course.kod_pensyarah || ''}"`,
                `"${course.bil_pelajar || '0'}"`,
                `"${course.kod_bilik || ''}"`,
                `"${course.hari || ''}"`,
                `"${course.masa || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        
        AuthController.showAlert(`Exported ${courses.length} REAL courses from TTMS to CSV`, 'success');
    },

    // Search REAL courses
    searchCourses(courses, searchTerm) {
        if (!searchTerm) return courses;
        
        const term = searchTerm.toLowerCase();
        return courses.filter(course => {
            return (
                (course.kod_subjek && course.kod_subjek.toLowerCase().includes(term)) ||
                (course.nama_subjek && course.nama_subjek.toLowerCase().includes(term)) ||
                (course.kod_pensyarah && course.kod_pensyarah.toLowerCase().includes(term)) ||
                (course.nama_pensyarah && course.nama_pensyarah.toLowerCase().includes(term))
            );
        });
    }
};

// Make globally available
window.CourseController = CourseController;