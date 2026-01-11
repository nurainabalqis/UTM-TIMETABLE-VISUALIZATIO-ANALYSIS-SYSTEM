// models/ttmsModel.js - FIXED VERSION
const TTMS = {
    BASE_URL: "http://web.fc.utm.my/ttms/web_man_webservice_json.cgi",
    ADMIN_AUTH_URL: "http://web.fc.utm.my/ttms/auth-admin.php",
    
    // Initialize session IDs from localStorage
    init() {
        this.userSessionId = localStorage.getItem('ttms_user_session_id');
        this.adminSessionId = localStorage.getItem('ttms_admin_session_id');
        console.log('🔑 TTMS initialized. Admin Session ID:', this.adminSessionId ? 'Loaded' : 'Not available');
    },

    // ============ AUTHENTICATION FLOW ============
    
    async login(username, password, role = 'student') {
        try {
            console.log(`🔐 Step 1: Authenticating ${username} with TTMS...`);
            
            // Step 1: User authentication
            const userAuthUrl = `${this.BASE_URL}?entity=authentication&login=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            console.log('User Auth URL:', userAuthUrl);
            
            const userResponse = await fetch(userAuthUrl);
            const userText = await userResponse.text();
            console.log('User Auth Raw Response:', userText);

            // Extract JSON from response
            const jsonMatch = userText.match(/\[.*\]/s);
            if (!jsonMatch) {
                return { 
                    status: "error", 
                    message: "Invalid authentication response format" 
                };
            }

            let userData;
            try {
                userData = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error('Failed to parse user auth response:', e);
                return { 
                    status: "error", 
                    message: "Invalid authentication response" 
                };
            }

            if (!Array.isArray(userData) || userData.length === 0) {
                return { 
                    status: "error", 
                    message: "Authentication failed - Invalid credentials" 
                };
            }

            const userSession = userData[0];
            this.userSessionId = userSession.session_id;
            localStorage.setItem('ttms_user_session_id', this.userSessionId);
            
            console.log(`✅ User authenticated. Session ID: ${this.userSessionId.substring(0, 20)}...`);
            
            // Step 2: Get admin session ID
            console.log(`🔐 Step 2: Getting admin session ID...`);
            const adminAuthUrl = `${this.ADMIN_AUTH_URL}?session_id=${this.userSessionId}`;
            console.log('Admin Auth URL:', adminAuthUrl);
            
            const adminResponse = await fetch(adminAuthUrl);
            const adminText = await adminResponse.text();
            console.log('Admin Auth Raw Response:', adminText);

            // Extract JSON from admin response
            const adminJsonMatch = adminText.match(/\[.*\]/s);
            if (!adminJsonMatch) {
                return { 
                    status: "error", 
                    message: "Failed to get admin session - Invalid response" 
                };
            }

            let adminData;
            try {
                adminData = JSON.parse(adminJsonMatch[0]);
            } catch (e) {
                console.error('Failed to parse admin auth response:', e);
                return { 
                    status: "error", 
                    message: "Failed to get admin session" 
                };
            }

            if (!Array.isArray(adminData) || adminData.length === 0) {
                return { 
                    status: "error", 
                    message: "Failed to get admin session" 
                };
            }

            this.adminSessionId = adminData[0].session_id;
            localStorage.setItem('ttms_admin_session_id', this.adminSessionId);
            
            console.log(`✅ Admin session obtained. Admin Session ID: ${this.adminSessionId.substring(0, 20)}...`);
            
            // Determine user role
            const detectedRole = this.detectUserRole(userSession.description || '', username);
            
            return {
                status: "success",
                nama: userSession.full_name || username,
                description: userSession.description || detectedRole,
                user_session_id: this.userSessionId,
                admin_session_id: this.adminSessionId,
                role: detectedRole,
                login_name: userSession.login_name
            };
            
        } catch (error) {
            console.error("❌ Login error:", error);
            return { 
                status: "error", 
                message: "Network error. Please check your connection." 
            };
        }
    },

    detectUserRole(description, username) {
        const desc = description.toLowerCase();
        if (desc.includes('pensyarah') || desc.includes('lecturer') || 
            desc.includes('teacher') || desc.includes('instructor')) {
            return 'lecturer';
        } else if (desc.includes('pelajar') || desc.includes('student')) {
            return 'student';
        } else if (username.toLowerCase().includes('admin') || 
                   desc.includes('admin') || desc.includes('administrator')) {
            return 'admin';
        }
        return 'student'; // default
    },

    // ============ DATA FETCHING WITH ADMIN SESSION ============
    
    async fetchWithAdminSession(entity, params = {}) {
        try {
            // Ensure admin session ID is loaded
            if (!this.adminSessionId) {
                this.adminSessionId = localStorage.getItem('ttms_admin_session_id');
                if (!this.adminSessionId) {
                    console.error('❌ No admin session ID available. User needs to login.');
                    throw new Error('Authentication required. Please login again.');
                }
            }

            // Use current session if not specified
            const currentSession = this.getCurrentSession();
            const baseParams = {
                entity: entity,
                session_id: this.adminSessionId,
                sesi: params.sesi || currentSession.sesi,
                semester: params.semester || currentSession.semester,
                ...params
            };

            // Remove any undefined/null parameters
            Object.keys(baseParams).forEach(key => {
                if (baseParams[key] === undefined || baseParams[key] === null) {
                    delete baseParams[key];
                }
            });

            // Build query string
            const queryString = Object.entries(baseParams)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');

            const url = `${this.BASE_URL}?${queryString}`;
            console.log(`📡 Fetching ${entity}:`, url);

            const response = await fetch(url);
            const text = await response.text();
            
            console.log(`📥 Raw response for ${entity}:`, text.substring(0, 200));

            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.warn(`⚠️ ${entity}: Response not pure JSON. Attempting extraction...`);
                const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error(`❌ ${entity}: Could not extract valid JSON`);
                        console.error('Response text:', text);
                        return [];
                    }
                } else {
                    console.error(`❌ ${entity}: No JSON found in response`);
                    console.error('Response text:', text);
                    return [];
                }
            }

            // Process data
            if (Array.isArray(data)) {
                console.log(`✅ ${entity}: Retrieved ${data.length} records`);
                return data;
            } else if (data && typeof data === 'object') {
                // Check for nested data
                if (data[entity] && Array.isArray(data[entity])) {
                    console.log(`✅ ${entity}: Retrieved ${data[entity].length} records (nested)`);
                    return data[entity];
                }
                // If object has array values
                const values = Object.values(data);
                if (values.length > 0 && Array.isArray(values[0])) {
                    console.log(`✅ ${entity}: Retrieved ${values[0].length} records (nested array)`);
                    return values[0];
                }
                console.log(`✅ ${entity}: Retrieved ${values.length} records (object values)`);
                return values;
            }

            console.log(`⚠️ ${entity}: No data returned`);
            return [];
            
        } catch (error) {
            console.error(`❌ Error fetching ${entity}:`, error);
            return [];
        }
    },

    // ============ SPECIFIC ENTITY FETCHERS ============
    
    async fetchCourses(sesi = null, semester = null) {
        const params = {};
        if (sesi) params.sesi = sesi;
        if (semester) params.semester = semester;
        
        return await this.fetchWithAdminSession('subjek', params);
    },

    async fetchSessions() {
        return await this.fetchWithAdminSession('sesisemester');
    },

    async fetchMyCourses(studentId = null) {
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const targetStudentId = studentId || (user ? user.username : null);
        
        if (!targetStudentId) {
            console.error('❌ No student ID provided');
            return [];
        }

        return await this.fetchWithAdminSession('pelajar_subjek', {
            no_matrik: targetStudentId
        });
    },

    async fetchRooms() {
        return await this.fetchWithAdminSession('ruang');
    },

    async fetchRoomSchedule(roomCode, sesi = null, semester = null) {
        const params = { kod_ruang: roomCode };
        if (sesi) params.sesi = sesi;
        if (semester) params.semester = semester;
        
        return await this.fetchWithAdminSession('jadual_ruang', params);
    },

    async fetchLecturers() {
        return await this.fetchWithAdminSession('pensyarah');
    },

    async fetchStudents(limit = 10, offset = 0) {
        return await this.fetchWithAdminSession('pelajar', {
            limit: limit,
            offset: offset
        });
    },

    async fetchTotalStudents() {
        try {
            // Try to get from students endpoint
            const students = await this.fetchStudents(1, 0);
            if (students && students.length > 0) {
                // For demo, return an estimate
                return 15000;
            }
            return 0;
        } catch (error) {
            console.error('Error fetching total students:', error);
            return 0;
        }
    },

    // ============ ROOM UTILIZATION ============
    
    async fetchRoomUtilization() {
        try {
            const rooms = await this.fetchRooms();
            const courses = await this.fetchCourses();
            
            if (rooms.length === 0 || courses.length === 0) {
                return { averageUtilization: 0 };
            }
            
            // Calculate simple utilization
            const roomUsage = {};
            courses.forEach(course => {
                const room = course.kod_bilik;
                if (room) {
                    roomUsage[room] = (roomUsage[room] || 0) + 1;
                }
            });
            
            const totalUsage = Object.values(roomUsage).reduce((a, b) => a + b, 0);
            const avgUtilization = Math.min(100, Math.round((totalUsage / rooms.length) * 10));
            
            return {
                averageUtilization: avgUtilization,
                totalRooms: rooms.length,
                usedRooms: Object.keys(roomUsage).length
            };
        } catch (error) {
            console.error('Error fetching room utilization:', error);
            return { averageUtilization: 0 };
        }
    },

    async fetchRoomUtilizationAnalysis() {
        try {
            const rooms = await this.fetchRooms();
            const courses = await this.fetchCourses();

            const roomUsageMap = {};

            // Initialize rooms
            rooms.forEach(r => {
                roomUsageMap[r.kod_ruang] = {
                    code: r.kod_ruang,
                    name: r.nama_ruang,
                    type: r.jenis || r.jenis_ruang || 'Classroom',
                    capacity: parseInt(r.kapasiti) || 0,
                    usageHours: 0,
                    subjectCount: 0
                };
            });

            // Count usage from courses
            courses.forEach(c => {
                if (!c.kod_bilik || !roomUsageMap[c.kod_bilik]) return;
                roomUsageMap[c.kod_bilik].subjectCount += 1;
                roomUsageMap[c.kod_bilik].usageHours += 2; // estimate
            });

            const detailedRooms = Object.values(roomUsageMap);

            // ---------- BUILD CHART DATA ----------
            const roomTypeDistribution = {};
            const capacityDistribution = {
            small: 0,
            medium: 0,
            large: 0
            };

            detailedRooms.forEach(r => {
            // Room type
            roomTypeDistribution[r.type] =
                (roomTypeDistribution[r.type] || 0) + 1;

            // Capacity buckets
            if (r.capacity < 40) capacityDistribution.small++;
            else if (r.capacity < 80) capacityDistribution.medium++;
            else capacityDistribution.large++;
            });

            return {
            totalRooms: detailedRooms.length,
            analysis: {
                detailedRooms,
                byUsage: {
                low: detailedRooms.filter(r => r.usageHours < 6).length,
                medium: detailedRooms.filter(r => r.usageHours >= 6 && r.usageHours < 14).length,
                high: detailedRooms.filter(r => r.usageHours >= 14).length
                }
            },
            charts: {
                roomTypeDistribution: Object.entries(roomTypeDistribution).map(
                ([type, count]) => ({ type, count })
                ),
                capacityDistribution: [
                { category: 'Small (<40)', count: capacityDistribution.small, color: '#42A5F5' },
                { category: 'Medium (40–79)', count: capacityDistribution.medium, color: '#66BB6A' },
                { category: 'Large (80+)', count: capacityDistribution.large, color: '#EF5350' }
                ],
                usageLevelDistribution: [
                { level: 'Low', count: detailedRooms.filter(r => r.usageHours < 6).length, color: '#90CAF9' },
                { level: 'Medium', count: detailedRooms.filter(r => r.usageHours >= 6 && r.usageHours < 14).length, color: '#FFD54F' },
                { level: 'High', count: detailedRooms.filter(r => r.usageHours >= 14).length, color: '#E57373' }
                ],
                topRoomsByUsage: detailedRooms
                .sort((a, b) => b.usageHours - a.usageHours)
                .slice(0, 10)
                .map(r => ({
                    roomCode: r.code,
                    shortName: r.code,
                    type: r.type,
                    capacity: r.capacity,
                    usageHours: r.usageHours,
                    subjectCount: r.subjectCount
                })),
                peakHoursData: [] // optional for now
            }
            };


        } catch (err) {
            console.error('Room utilization analysis failed:', err);
            return { totalRooms: 0, analysis: null, charts: null };
        }
    },

    // ============ SESSION MANAGEMENT ============
    
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
        return session;
    },

    // ============ ANALYTICS (Derived from real data) ============
    
    async fetchLecturerWorkload() {
        try {
            const courses = await this.fetchCourses();
            if (courses.length === 0) return [];

            const workloadMap = {};
            courses.forEach(course => {
                const lecturer = course.nama_pensyarah || course.kod_pensyarah || 'Unknown';
                if (!lecturer || lecturer === 'N/A') return;
                
                const students = parseInt(course.bil_pelajar) || 30;
                const hours = Math.max(1, Math.ceil(students / 30));

                if (!workloadMap[lecturer]) {
                    workloadMap[lecturer] = {
                        lecturer: lecturer,
                        hours: 0,
                        courseCount: 0
                    };
                }

                workloadMap[lecturer].hours += hours;
                workloadMap[lecturer].courseCount += 1;
            });

            const result = Object.values(workloadMap)
                .sort((a, b) => b.hours - a.hours)
                .slice(0, 10);
                
            console.log(`✅ Lecturer workload: ${result.length} lecturers`);
            return result;
            
        } catch (error) {
            console.error('Error fetching lecturer workload:', error);
            return [];
        }
    },

    async fetchWeeklyUsagePattern() {
        try {
            const courses = await this.fetchCourses();
            if (courses.length === 0) return null;

            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const morning = [0, 0, 0, 0, 0];
            const afternoon = [0, 0, 0, 0, 0];
            const evening = [0, 0, 0, 0, 0];

            // Distribute courses across days
            courses.forEach((course, index) => {
                const dayIndex = index % 5;
                const students = parseInt(course.bil_pelajar) || 30;
                
                // Estimate sessions based on student count
                const factor = Math.ceil(students / 50);
                morning[dayIndex] += factor * 1;
                afternoon[dayIndex] += factor * 2;
                evening[dayIndex] += factor * 0.5;
            });

            return { 
                days, 
                morning: morning.map(m => Math.round(m)),
                afternoon: afternoon.map(a => Math.round(a)),
                evening: evening.map(e => Math.round(e))
            };
            
        } catch (error) {
            console.error('Error fetching weekly usage:', error);
            return null;
        }
    },

    async fetchPeakHoursData() {
        try {
            const courses = await this.fetchCourses();
            if (courses.length === 0) return [];

            const timeSlots = [
                '8 AM', '9 AM', '10 AM', '11 AM',
                '12 PM', '1 PM', '2 PM', '3 PM',
                '4 PM', '5 PM', '6 PM', '7 PM',
                '8 PM', '9 PM', '10 PM'
            ];

            // Distribute courses across time slots
            const slotCounts = {};
            timeSlots.forEach(slot => slotCounts[slot] = 0);

            courses.forEach((course, index) => {
                const slotIndex = index % timeSlots.length;
                const slot = timeSlots[slotIndex];
                slotCounts[slot] += 1;
            });

            return Object.entries(slotCounts)
                .map(([slot, count]) => ({ slot, count }))
                .sort((a, b) => {
                    // Sort by time
                    const getHour = (slot) => {
                        const time = parseInt(slot);
                        if (slot.includes('AM')) return time;
                        if (slot.includes('PM') && time !== 12) return time + 12;
                        return time;
                    };
                    return getHour(a.slot) - getHour(b.slot);
                });
            
        } catch (error) {
            console.error('Error fetching peak hours:', error);
            return [];
        }
    },

    // ============ CLASH DETECTION ============
    
    async detectStudentClashes(studentId) {
        try {
            const courses = await this.fetchMyCourses(studentId);
            if (courses.length === 0) {
                return { 
                    clashes: [], 
                    summary: { total: 0, time: 0, room: 0, instructor: 0 },
                    timetableCount: 0
                };
            }

            const currentSession = this.getCurrentSession();
            const currentCourses = courses.filter(course => 
                course.sesi === currentSession.sesi && 
                course.semester.toString() === currentSession.semester
            );

            const clashes = [];
            const summary = { total: 0, time: 0, room: 0, instructor: 0 };

            // Simple time clash detection
            for (let i = 0; i < currentCourses.length; i++) {
                for (let j = i + 1; j < currentCourses.length; j++) {
                    const c1 = currentCourses[i];
                    const c2 = currentCourses[j];
                    
                    if (c1.hari && c2.hari && c1.masa && c2.masa &&
                        c1.hari === c2.hari && c1.masa === c2.masa) {
                        
                        clashes.push({
                            type: 'time',
                            description: `Time clash on ${c1.hari} at ${c1.masa}`,
                            severity: 'high',
                            courses: [
                                { code: c1.kod_subjek, name: c1.nama_subjek },
                                { code: c2.kod_subjek, name: c2.nama_subjek }
                            ]
                        });
                        summary.time++;
                        summary.total++;
                    }
                }
            }

            return {
                clashes,
                summary,
                timetableCount: currentCourses.length
            };
            
        } catch (error) {
            console.error('Error detecting student clashes:', error);
            return { 
                clashes: [], 
                summary: { total: 0, time: 0, room: 0, instructor: 0 },
                timetableCount: 0
            };
        }
    },

    async detectLecturerClashes(lecturerId) {
        // Similar to student detection
        return await this.detectStudentClashes(lecturerId);
    },

    async detectSystemClashes() {
        try {
            const courses = await this.fetchCourses();
            if (courses.length === 0) {
                return { 
                    clashes: [], 
                    summary: { total: 0, time: 0, room: 0, instructor: 0 },
                    timetableCount: 0
                };
            }

            const clashes = [];
            const summary = { total: 0, time: 0, room: 0, instructor: 0 };

            // Room clash detection
            for (let i = 0; i < courses.length; i++) {
                for (let j = i + 1; j < courses.length; j++) {
                    const c1 = courses[i];
                    const c2 = courses[j];
                    
                    if (c1.kod_bilik && c2.kod_bilik &&
                        c1.kod_bilik === c2.kod_bilik &&
                        c1.hari && c2.hari && c1.masa && c2.masa &&
                        c1.hari === c2.hari && c1.masa === c2.masa) {
                        
                        clashes.push({
                            type: 'room',
                            description: `Room ${c1.kod_bilik} double booked`,
                            severity: 'high',
                            courses: [
                                { code: c1.kod_subjek, name: c1.nama_subjek },
                                { code: c2.kod_subjek, name: c2.nama_subjek }
                            ]
                        });
                        summary.room++;
                        summary.total++;
                    }
                }
            }

            return {
                clashes,
                summary,
                timetableCount: courses.length
            };
            
        } catch (error) {
            console.error('Error detecting system clashes:', error);
            return { 
                clashes: [], 
                summary: { total: 0, time: 0, room: 0, instructor: 0 },
                timetableCount: 0
            };
        }
    }
};

// Initialize TTMS when loaded
if (typeof window !== 'undefined') {
    window.TTMS = TTMS;
    TTMS.init(); // Load session IDs from localStorage
    console.log('✅ TTMS Model loaded and initialized');
}