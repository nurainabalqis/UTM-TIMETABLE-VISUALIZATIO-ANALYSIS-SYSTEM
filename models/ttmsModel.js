// models/ttmsModel.js - REAL TTMS DATA ONLY
const TTMS = {
    BASE_URL: "http://web.fc.utm.my/ttms/web_man_webservice_json.cgi",
    
    // Current session
    getCurrentSession() {
        const saved = localStorage.getItem('currentSession');
        if (saved) {
            return JSON.parse(saved);
        }
        return { sesi: '2025/2026', semester: '1' };
    },
    
    setCurrentSession(sesi, semester) {
        const session = { sesi, semester };
        localStorage.setItem('currentSession', JSON.stringify(session));
    },
    
    // ============ AUTHENTICATION ============
    async login(username, password) {
        try {
            const url = `${this.BASE_URL}?entity=authentication&login=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            if (data && Array.isArray(data) && data.length > 0) {
                const userData = data[0];
                return {
                    status: "success",
                    nama: userData.full_name || username,
                    description: userData.description || "Student",
                    session_id: userData.session_id
                };
            } else {
                return { 
                    status: "error", 
                    message: "Invalid credentials. Please check your Matric/Staff ID and IC number." 
                };
            }
        } catch (error) {
            console.error("Login error:", error);
            return { 
                status: "error", 
                message: "Network error. Please check your connection." 
            };
        }
    },
    
    // ============ REAL DATA FETCHING ============
    
    // Get courses from TTMS
    async fetchCourses(sesi = null, semester = null) {
        const session = sesi ? { sesi, semester } : this.getCurrentSession();
        try {
            const url = `${this.BASE_URL}?entity=subjek&sesi=${session.sesi}&semester=${session.semester}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) return data;
            if (data && data.subjek) return data.subjek;
            return [];
        } catch (error) {
            console.error("Error fetching courses:", error);
            return [];
        }
    },
    
    // Get lecturers from TTMS
    async fetchLecturers() {
        const session = this.getCurrentSession();
        try {
            const url = `${this.BASE_URL}?entity=pensyarah&sesi=${session.sesi}&semester=${session.semester}`;
            const response = await fetch(url);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Error fetching lecturers:", error);
            return [];
        }
    },
    
    // Get rooms from TTMS
    async fetchRooms() {
        try {
            const url = `${this.BASE_URL}?entity=bilik`;
            const response = await fetch(url);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Error fetching rooms:", error);
            return [];
        }
    },
    
    // Get sessions from TTMS
    async fetchSessions() {
        try {
            const url = `${this.BASE_URL}?entity=sesisemester`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) return data;
            if (data && data.sesisemester) return data.sesisemester;
            return [];
        } catch (error) {
            console.error("Error fetching sessions:", error);
            return [];
        }
    },
    
    // Get student courses from TTMS
    async fetchMyCourses(no_matrik = null) {
        try {
            if (!no_matrik) {
                const userStr = localStorage.getItem("user");
                if (!userStr) throw new Error("User not logged in");
                const user = JSON.parse(userStr);
                no_matrik = user.username;
            }
            
            const url = `${this.BASE_URL}?entity=pelajar_subjek&no_matrik=${no_matrik}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (Array.isArray(data)) return data;
            if (data && data.pelajar_subjek) return data.pelajar_subjek;
            return [];
        } catch (error) {
            console.error("Error fetching student courses:", error);
            return [];
        }
    },
    
    // Get dashboard stats from TTMS
    async fetchDashboardStats() {
        const session = this.getCurrentSession();
        try {
            const [courses, sessions, lecturers] = await Promise.all([
                this.fetchCourses(),
                this.fetchSessions(),
                this.fetchLecturers()
            ]);
            
            return {
                courseCount: courses.length || 0,
                sessionCount: sessions.length || 0,
                lecturerCount: lecturers.length || 0,
                currentSession: `${session.sesi}-${session.semester}`
            };
        } catch (error) {
            console.error("Error fetching stats:", error);
            return { 
                courseCount: 0, 
                sessionCount: 0, 
                lecturerCount: 0,
                currentSession: 'N/A' 
            };
        }
    },
    
    // ============ REAL CHART DATA ============
    
    // Get real workload data from TTMS lecturers and courses
    async fetchLecturerWorkload() {
        try {
            const lecturers = await this.fetchLecturers();
            const courses = await this.fetchCourses();
            
            const workloadData = [];
            
            // Count courses per lecturer
            lecturers.forEach(lecturer => {
                const lecturerCourses = courses.filter(course => 
                    course.kod_pensyarah === lecturer.kod_pensyarah
                );
                
                if (lecturerCourses.length > 0) {
                    // Estimate 3 hours per course per week
                    const estimatedHours = lecturerCourses.length * 3;
                    workloadData.push({
                        lecturer: lecturer.nama_pensyarah || lecturer.kod_pensyarah,
                        hours: estimatedHours,
                        courseCount: lecturerCourses.length
                    });
                }
            });
            
            return workloadData.sort((a, b) => b.hours - a.hours).slice(0, 10);
            
        } catch (error) {
            console.error("Error fetching lecturer workload:", error);
            return [];
        }
    },
    
    // Get real room utilization from TTMS rooms
    async fetchRoomUtilizationStats() {
        try {
            const rooms = await this.fetchRooms();
            const courses = await this.fetchCourses();
            
            if (rooms.length === 0) return [];
            
            // Count courses by room type
            const roomTypes = {};
            rooms.forEach(room => {
                const type = room.jenis_bilik || 'Unknown';
                if (!roomTypes[type]) {
                    roomTypes[type] = { count: 0, courses: 0 };
                }
                roomTypes[type].count++;
            });
            
            // Count courses in each room type
            courses.forEach(course => {
                if (course.jenis_bilik) {
                    const type = course.jenis_bilik;
                    if (roomTypes[type]) {
                        roomTypes[type].courses++;
                    }
                }
            });
            
            // Calculate utilization percentage
            const result = [];
            Object.entries(roomTypes).forEach(([type, data]) => {
                const utilization = data.count > 0 ? 
                    Math.min(100, Math.round((data.courses / data.count) * 100)) : 0;
                
                result.push({
                    type: type,
                    count: data.count,
                    utilization: utilization
                });
            });
            
            return result;
            
        } catch (error) {
            console.error("Error fetching room utilization:", error);
            return [];
        }
    },
    
    // Get real weekly usage pattern from TTMS courses
    async fetchWeeklyUsagePattern() {
        try {
            const courses = await this.fetchCourses();
            
            // Initialize days
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            const usage = {};
            days.forEach(day => {
                usage[day] = { morning: 0, afternoon: 0, evening: 0 };
            });
            
            // Analyze course schedules
            courses.forEach(course => {
                if (course.hari && course.masa) {
                    const day = this.mapDayToShort(course.hari);
                    const timeCategory = this.categorizeTime(course.masa);
                    
                    if (usage[day] && timeCategory) {
                        usage[day][timeCategory]++;
                    }
                }
            });
            
            // Convert to chart format
            const result = [['Day', 'Morning', 'Afternoon', 'Evening']];
            days.forEach(day => {
                result.push([
                    day,
                    usage[day].morning,
                    usage[day].afternoon,
                    usage[day].evening
                ]);
            });
            
            return result;
            
        } catch (error) {
            console.error("Error fetching weekly usage:", error);
            return null;
        }
    },
    
    // Get real peak hours data from TTMS student timetables
    async fetchPeakHoursData() {
        try {
            const courses = await this.fetchCourses();
            
            // Analyze course times
            const timeSlots = {
                '8-9': 0, '9-10': 0, '10-11': 0, '11-12': 0,
                '12-1': 0, '2-3': 0, '3-4': 0, '4-5': 0, '5-6': 0
            };
            
            courses.forEach(course => {
                if (course.masa) {
                    const hour = this.extractHourFromTime(course.masa);
                    const slot = this.getTimeSlot(hour);
                    if (timeSlots[slot] !== undefined) {
                        timeSlots[slot]++;
                    }
                }
            });
            
            // Convert to array
            return Object.entries(timeSlots).map(([slot, count]) => ({
                slot: slot,
                count: count
            }));
            
        } catch (error) {
            console.error("Error fetching peak hours:", error);
            return [];
        }
    },
    
    // ============ HELPER FUNCTIONS ============
    
    // Map day name to short form
    mapDayToShort(dayName) {
        const dayMap = {
            'MONDAY': 'Mon', 'ISNIN': 'Mon',
            'TUESDAY': 'Tue', 'SELASA': 'Tue',
            'WEDNESDAY': 'Wed', 'RABU': 'Wed',
            'THURSDAY': 'Thu', 'KHAMIS': 'Thu',
            'FRIDAY': 'Fri', 'JUMAAT': 'Fri'
        };
        
        const upperDay = dayName.toUpperCase();
        return dayMap[upperDay] || dayName.substring(0, 3);
    },
    
    // Categorize time into morning/afternoon/evening
    categorizeTime(timeStr) {
        if (!timeStr) return null;
        
        const hour = this.extractHourFromTime(timeStr);
        if (hour === null) return null;
        
        if (hour >= 8 && hour < 12) return 'morning';
        if (hour >= 14 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        
        return null;
    },
    
    // Extract hour from time string
    extractHourFromTime(timeStr) {
        if (!timeStr) return null;
        
        // Handle formats like "8:00 AM - 10:00 AM" or "08:00-10:00"
        const match = timeStr.match(/(\d{1,2}):/);
        return match ? parseInt(match[1]) : null;
    },
    
    // Convert hour to time slot
    getTimeSlot(hour) {
        if (hour === null) return '8-9';
        if (hour >= 8 && hour < 9) return '8-9';
        if (hour >= 9 && hour < 10) return '9-10';
        if (hour >= 10 && hour < 11) return '10-11';
        if (hour >= 11 && hour < 12) return '11-12';
        if (hour >= 12 && hour < 13) return '12-1';
        if (hour >= 14 && hour < 15) return '2-3';
        if (hour >= 15 && hour < 16) return '3-4';
        if (hour >= 16 && hour < 17) return '4-5';
        if (hour >= 17 && hour < 18) return '5-6';
        return '8-9';
    },
    
    // Get room utilization percentage
    async fetchRoomUtilization() {
        try {
            const rooms = await this.fetchRooms();
            const courses = await this.fetchCourses();
            
            if (rooms.length === 0) {
                return { averageUtilization: 0 };
            }
            
            // Simple calculation: courses per room
            const coursesPerRoom = courses.length / rooms.length;
            const utilization = Math.min(100, Math.round(coursesPerRoom * 10));
            
            return {
                averageUtilization: utilization
            };
        } catch (error) {
            console.error("Error fetching room utilization:", error);
            return { averageUtilization: 0 };
        }
    },
    
    // Get clash count from TTMS
    async fetchClashes() {
        try {
            const userStr = localStorage.getItem("user");
            if (!userStr) return [];
            
            const user = JSON.parse(userStr);
            if (user.role === 'student') {
                // For students, check their courses for potential clashes
                const courses = await this.fetchMyCourses(user.username);
                const currentSession = this.getCurrentSession();
                const currentCourses = courses.filter(course => 
                    course.sesi === currentSession.sesi && 
                    course.semester.toString() === currentSession.semester
                );
                
                // Simple clash detection based on course count
                return currentCourses.length > 6 ? [{ type: "potential", course1: "Multiple", course2: "Courses" }] : [];
            }
            
            return [];
        } catch (error) {
            console.error("Error fetching clashes:", error);
            return [];
        }
    }
};

// Make TTMS globally available
if (typeof window !== 'undefined') {
    window.TTMS = TTMS;
}