// controllers/studentController.js
const StudentController = {
    // Load student courses
    async loadStudentCourses(studentId = null) {
        try {
            const user = AuthController.getCurrentUser();
            if (!user) return null;
            
            // Use provided studentId or current user's ID
            const targetStudentId = studentId || user.username;
            
            if (user.role !== 'student' && !studentId) {
                AuthController.showAlert('Please specify a student ID', 'warning');
                return null;
            }
            
            const courses = await TTMS.fetchMyCourses(targetStudentId);
            const currentSession = TTMS.getCurrentSession();
            
            // Process courses
            const processedCourses = courses.map(course => ({
                ...course,
                isCurrent: course.sesi === currentSession.sesi && 
                          course.semester.toString() === currentSession.semester,
                displaySession: `${course.sesi}-${course.semester}`
            }));
            
            return {
                courses: processedCourses,
                total: courses.length,
                current: processedCourses.filter(c => c.isCurrent).length,
                studentId: targetStudentId
            };
            
        } catch (error) {
            console.error('Error loading student courses:', error);
            AuthController.showAlert('Failed to load student courses: ' + error.message, 'danger');
            return null;
        }
    },

    // Filter student courses
    filterStudentCourses(courses, filters = {}) {
        const {
            sessionFilter = 'current',
            statusFilter = 'all',
            yearFilter = 'all'
        } = filters;
        
        const currentSession = TTMS.getCurrentSession();
        
        return courses.filter(course => {
            let sessionMatch = true;
            let statusMatch = true;
            let yearMatch = true;
            
            // Session filter
            if (sessionFilter === 'current') {
                sessionMatch = course.sesi === currentSession.sesi && 
                              course.semester.toString() === currentSession.semester;
            } else if (sessionFilter !== 'all') {
                const [sesi, semester] = sessionFilter.split('-');
                sessionMatch = course.sesi === sesi && 
                              course.semester.toString() === semester;
            }
            
            // Status filter
            if (statusFilter !== 'all') {
                statusMatch = course.status === statusFilter;
            }
            
            // Year filter
            if (yearFilter !== 'all') {
                yearMatch = course.tahun_kursus === yearFilter;
            }
            
            return sessionMatch && statusMatch && yearMatch;
        });
    },

    // Get student statistics
    getStudentStatistics(courses) {
        const currentSession = TTMS.getCurrentSession();
        const currentCourses = courses.filter(c => 
            c.sesi === currentSession.sesi && 
            c.semester.toString() === currentSession.semester
        );
        
        const stats = {
            total: courses.length,
            current: currentCourses.length,
            byStatus: {},
            byYear: {},
            bySession: {},
            totalCredits: this.calculateTotalCredits(courses)
        };
        
        // Count by status
        courses.forEach(course => {
            const status = course.status || 'Unknown';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            // Count by year
            const year = course.tahun_kursus || 'Unknown';
            stats.byYear[year] = (stats.byYear[year] || 0) + 1;
            
            // Count by session
            const session = `${course.sesi}-${course.semester}`;
            stats.bySession[session] = (stats.bySession[session] || 0) + 1;
        });
        
        return stats;
    },

    // Calculate total credits
    calculateTotalCredits(courses) {
        // Simple calculation: assume 3 credits per course
        return courses.length * 3;
    },

    // Get student timetable
    async getStudentTimetable(studentId = null) {
        try {
            const user = AuthController.getCurrentUser();
            const targetStudentId = studentId || user?.username;
            
            if (!targetStudentId) return null;
            
            const courses = await TTMS.fetchMyCourses(targetStudentId);
            const currentSession = TTMS.getCurrentSession();
            
            // Filter current session courses
            const currentCourses = courses.filter(c => 
                c.sesi === currentSession.sesi && 
                c.semester.toString() === currentSession.semester
            );
            
            // Organize by day and time
            const timetable = {
                Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
            };
            
            currentCourses.forEach(course => {
                if (course.hari && course.masa) {
                    const day = this.mapDayToEnglish(course.hari);
                    if (timetable[day]) {
                        timetable[day].push({
                            course: course.kod_subjek,
                            name: course.nama_subjek,
                            time: course.masa,
                            room: course.kod_bilik || 'TBA',
                            lecturer: course.kod_pensyarah || 'N/A'
                        });
                    }
                }
            });
            
            // Sort each day by time
            Object.keys(timetable).forEach(day => {
                timetable[day].sort((a, b) => this.extractHour(a.time) - this.extractHour(b.time));
            });
            
            return {
                timetable: timetable,
                totalCourses: currentCourses.length,
                studentId: targetStudentId,
                session: currentSession
            };
            
        } catch (error) {
            console.error('Error getting student timetable:', error);
            return null;
        }
    },

    // Map day to English
    mapDayToEnglish(dayName) {
        const dayMap = {
            'ISNIN': 'Monday',
            'SELASA': 'Tuesday',
            'RABU': 'Wednesday',
            'KHAMIS': 'Thursday',
            'JUMAAT': 'Friday',
            'MONDAY': 'Monday',
            'TUESDAY': 'Tuesday',
            'WEDNESDAY': 'Wednesday',
            'THURSDAY': 'Thursday',
            'FRIDAY': 'Friday'
        };
        
        const upperDay = dayName.toUpperCase();
        return dayMap[upperDay] || dayName;
    },

    // Extract hour from time string
    extractHour(timeStr) {
        if (!timeStr) return 0;
        const match = timeStr.match(/(\d{1,2}):/);
        return match ? parseInt(match[1]) : 0;
    },

    // Export student courses to CSV
    exportToCSV(courses, studentId, filename = null) {
        if (courses.length === 0) {
            AuthController.showAlert('No courses to export', 'warning');
            return;
        }
        
        if (!filename) {
            filename = `student_${studentId}_courses.csv`;
        }
        
        const headers = ['Course Code', 'Course Name', 'Section', 'Session', 'Year', 'Status', 'Lecturer'];
        
        const csvContent = [
            headers.join(','),
            ...courses.map(course => [
                `"${course.kod_subjek || ''}"`,
                `"${course.nama_subjek || ''}"`,
                `"${course.seksyen || ''}"`,
                `"${course.sesi}-${course.semester}"`,
                `"${course.tahun_kursus || ''}"`,
                `"${course.status || ''}"`,
                `"${course.kod_pensyarah || ''}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        
        AuthController.showAlert(`Exported ${courses.length} courses to CSV`, 'success');
    },

    // Get student academic progress
    getAcademicProgress(courses) {
        const currentSession = TTMS.getCurrentSession();
        const allSessions = {};
        
        // Group courses by session
        courses.forEach(course => {
            const sessionKey = `${course.sesi}-${course.semester}`;
            if (!allSessions[sessionKey]) {
                allSessions[sessionKey] = {
                    session: sessionKey,
                    courses: [],
                    credits: 0,
                    isCurrent: sessionKey === `${currentSession.sesi}-${currentSession.semester}`
                };
            }
            allSessions[sessionKey].courses.push(course);
            allSessions[sessionKey].credits += 3; // Assume 3 credits per course
        });
        
        // Convert to array and sort
        const progress = Object.values(allSessions).sort((a, b) => {
            return b.session.localeCompare(a.session); // Newest first
        });
        
        return {
            progress: progress,
            totalSessions: progress.length,
            totalCourses: courses.length,
            totalCredits: progress.reduce((sum, session) => sum + session.credits, 0)
        };
    },

    // Check for timetable clashes
    checkTimetableClashes(timetable) {
        const clashes = [];
        
        Object.keys(timetable).forEach(day => {
            const dayCourses = timetable[day];
            
            for (let i = 0; i < dayCourses.length; i++) {
                for (let j = i + 1; j < dayCourses.length; j++) {
                    if (this.isTimeOverlap(dayCourses[i].time, dayCourses[j].time)) {
                        clashes.push({
                            day: day,
                            course1: dayCourses[i],
                            course2: dayCourses[j],
                            type: 'time_clash',
                            message: `Time clash between ${dayCourses[i].course} and ${dayCourses[j].course}`
                        });
                    }
                }
            }
        });
        
        return clashes;
    },

    // Check if times overlap
    isTimeOverlap(time1, time2) {
        // Simple check: if times are exactly the same
        return time1 === time2;
    },

    // Get student summary
    getStudentSummary(courses, studentId) {
        const stats = this.getStudentStatistics(courses);
        const progress = this.getAcademicProgress(courses);
        
        return {
            studentId: studentId,
            totalCourses: stats.total,
            currentCourses: stats.current,
            totalCredits: stats.totalCredits,
            sessionsCompleted: progress.totalSessions - (progress.progress[0]?.isCurrent ? 1 : 0),
            averageCoursesPerSession: (stats.total / progress.totalSessions).toFixed(1),
            favoriteStatus: this.getMostCommonStatus(stats.byStatus),
            commonYear: this.getMostCommonYear(stats.byYear)
        };
    },

    // Get most common status
    getMostCommonStatus(statusCount) {
        let maxCount = 0;
        let mostCommon = '';
        
        Object.entries(statusCount).forEach(([status, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = status;
            }
        });
        
        return mostCommon;
    },

    // Get most common year
    getMostCommonYear(yearCount) {
        let maxCount = 0;
        let mostCommon = '';
        
        Object.entries(yearCount).forEach(([year, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = year;
            }
        });
        
        return mostCommon;
    },

    // Search student courses
    searchStudentCourses(courses, searchTerm) {
        if (!searchTerm) return courses;
        
        const term = searchTerm.toLowerCase();
        return courses.filter(course => {
            return (
                (course.kod_subjek && course.kod_subjek.toLowerCase().includes(term)) ||
                (course.nama_subjek && course.nama_subjek.toLowerCase().includes(term)) ||
                (course.kod_pensyarah && course.kod_pensyarah.toLowerCase().includes(term))
            );
        });
    },

    // Get course recommendations based on current courses
    getCourseRecommendations(currentCourses, allCourses) {
        if (!currentCourses || currentCourses.length === 0) return [];
        
        const currentYear = currentCourses[0]?.tahun_kursus;
        const currentFaculty = currentCourses[0]?.kod_subjek?.substring(0, 2);
        
        // Filter courses from same faculty and next level
        const recommendations = allCourses.filter(course => {
            const courseFaculty = course.kod_subjek?.substring(0, 2);
            const courseLevel = course.kod_subjek?.match(/\d/)?.[0];
            const currentLevel = currentYear ? currentYear.charAt(0) : '1';
            
            return (
                courseFaculty === currentFaculty &&
                parseInt(courseLevel) === parseInt(currentLevel) + 1 &&
                !currentCourses.some(c => c.kod_subjek === course.kod_subjek)
            );
        });
        
        return recommendations.slice(0, 5); // Return top 5 recommendations
    }
};

// Make globally available
window.StudentController = StudentController;