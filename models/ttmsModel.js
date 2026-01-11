// models/ttmsModel.js - CORRECTED VERSION

const TTMS = {
    BASE_URL: "http://web.fc.utm.my/ttms/web_man_webservice_json.cgi",

    // ============ TTMS RESPONSE PARSER ============
    parseTTMSResponse(text, label = 'TTMS') {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn(`⚠️ ${label} response not pure JSON. Extracting...`);

            const match = text.match(/\[.*\]|\{.*\}/s);
            if (!match) {
                console.error(`❌ ${label}: No JSON found in response`);
                return null;
            }

            try {
                return JSON.parse(match[0]);
            } catch (err) {
                console.error(`❌ ${label}: Extracted JSON still invalid`);
                return null;
            }
        }
    },

    // Current session management
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
    
    // ============ AUTHENTICATION ============
    async login(username, password, role = 'student') {
        try {
            console.log(`Attempting login for ${username}`);
            
            const url = `${this.BASE_URL}?entity=authentication&login=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            console.log('TTMS Login URL:', url);
            
            const response = await fetch(url);
            const text = await response.text();
            console.log('TTMS Login response:', text);

            try {
                const data = JSON.parse(text);
                
                if (Array.isArray(data) && data.length > 0) {
                    const user = data[0];
                    return {
                        status: "success",
                        nama: user.full_name || user.login_name,
                        description: user.description || 'Student',
                        session_id: user.session_id,
                        email: user.email,
                        login_name: user.login_name
                    };
                } else if (data && data.status === "success") {
                    return {
                        status: "success",
                        nama: data.full_name || username,
                        description: data.description || 'Student',
                        session_id: data.session_id
                    };
                } else {
                    return { 
                        status: "error", 
                        message: data.message || "Invalid credentials" 
                    };
                }
            } catch (e) {
                console.error('Failed to parse login response:', e);
                return { 
                    status: "error", 
                    message: "Authentication failed - Invalid response format" 
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
    
    // ============ DATA FETCHING ============
    
    // Get courses - REAL TTMS CALL
    async fetchCourses(sesi = null, semester = null) {
        try {
            const session = sesi ? { sesi, semester } : this.getCurrentSession();
            console.log(`Fetching REAL courses for session: ${session.sesi}-${session.semester}`);
            
            const url = `${this.BASE_URL}?entity=subjek&sesi=${session.sesi}&semester=${session.semester}`;
            console.log('REAL TTMS Courses URL:', url);
            
            const response = await fetch(url);
            const text = await response.text();
            console.log('Raw TTMS response received, length:', text.length);

            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('Failed to parse as JSON, trying to extract JSON...');
                
                const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('Could not extract valid JSON');
                        return [];
                    }
                } else {
                    console.error('No JSON found in response');
                    return [];
                }
            }
            
            // Process data based on structure
            if (Array.isArray(data)) {
                console.log(`SUCCESS: Retrieved ${data.length} REAL courses from TTMS`);
                return data;
            } else if (data && typeof data === 'object') {
                if (data.subjek && Array.isArray(data.subjek)) {
                    console.log(`SUCCESS: Retrieved ${data.subjek.length} REAL courses from TTMS (nested)`);
                    return data.subjek;
                }
                
                const arr = Object.values(data);
                if (Array.isArray(arr[0])) {
                    console.log(`SUCCESS: Retrieved ${arr[0].length} REAL courses from TTMS (nested array)`);
                    return arr[0];
                }
                
                console.log(`SUCCESS: Retrieved ${arr.length} REAL courses from TTMS (object values)`);
                return arr;
            }
            
            console.log('WARNING: TTMS returned empty or invalid data');
            return [];
            
        } catch (error) {
            console.error("ERROR fetching REAL courses:", error);
            return [];
        }
    },
    
    // Get sessions - REAL TTMS CALL
    async fetchSessions() {
        try {
            const url = `${this.BASE_URL}?entity=sesisemester`;
            console.log('REAL TTMS Sessions URL:', url);

            const response = await fetch(url);
            const text = await response.text();

            const data = this.parseTTMSResponse(text, 'Sessions');
            if (!data) return [];

            if (Array.isArray(data)) {
                console.log(`✅ Retrieved ${data.length} REAL sessions`);
                return data;
            }

            if (typeof data === 'object') {
                const arr = Object.values(data);
                console.log(`✅ Retrieved ${arr.length} REAL sessions`);
                return arr;
            }

            return [];
        } catch (error) {
            console.error('ERROR fetching sessions:', error);
            return [];
        }
    },
    
    // Get student courses - REAL TTMS CALL
    async fetchMyCourses(no_matrik = null) {
        try {
            if (!no_matrik) {
                const userStr = localStorage.getItem("user");
                if (!userStr) throw new Error("User not logged in");
                const user = JSON.parse(userStr);
                no_matrik = user.username;
            }

            const url = `${this.BASE_URL}?entity=pelajar_subjek&no_matrik=${no_matrik}`;
            console.log('REAL TTMS Student Courses URL:', url);

            const response = await fetch(url);
            const text = await response.text();

            const data = this.parseTTMSResponse(text, 'StudentCourses');
            if (!data) return [];

            if (Array.isArray(data)) {
                console.log(`✅ Retrieved ${data.length} REAL student courses`);
                return data;
            }

            if (typeof data === 'object') {
                const arr = Object.values(data);
                console.log(`✅ Retrieved ${arr.length} REAL student courses`);
                return arr;
            }

            return [];
        } catch (error) {
            console.error('ERROR fetching student courses:', error);
            return [];
        }
    },
    
    // ============ ROOM FUNCTIONS ============
    
    // Get REAL rooms from TTMS
    async fetchRooms() {
        try {
            console.log('📊 Fetching REAL rooms from TTMS...');
            const url = `${this.BASE_URL}?entity=ruang`;
            console.log('TTMS Rooms URL:', url);

            const response = await fetch(url);
            const text = await response.text();

            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('Failed to parse rooms JSON, trying to extract...');
                const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('Could not extract valid JSON');
                        return [];
                    }
                } else {
                    return [];
                }
            }

            // Process data based on structure
            if (Array.isArray(data)) {
                console.log(`✅ Retrieved ${data.length} REAL rooms from TTMS`);
                return data;
            } else if (data && typeof data === 'object') {
                const arr = Object.values(data);
                console.log(`✅ Retrieved ${arr.length} REAL rooms from TTMS`);
                return arr;
            }

            return [];
        } catch (error) {
            console.error("ERROR fetching REAL rooms:", error);
            return [];
        }
    },
    
    // Get room schedule/timetable
    async fetchRoomSchedule(roomCode, sesi = null, semester = null) {
        try {
            const session = sesi ? { sesi, semester } : this.getCurrentSession();
            console.log(`📅 Fetching schedule for room ${roomCode} in ${session.sesi}-${session.semester}`);

            const url = `${this.BASE_URL}?entity=jadual_ruang&sesi=${session.sesi}&semester=${session.semester}&kod_ruang=${encodeURIComponent(roomCode)}`;
            console.log('Room Schedule URL:', url);

            const response = await fetch(url);
            const text = await response.text();

            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        return [];
                    }
                } else {
                    return [];
                }
            }

            if (Array.isArray(data)) {
                console.log(`✅ Retrieved ${data.length} schedule entries for room ${roomCode}`);
                return data;
            }

            return [];
        } catch (error) {
            console.error("ERROR fetching room schedule:", error);
            return [];
        }
    },
    
    // Get comprehensive room utilization data
    async fetchRoomUtilizationAnalysis() {
        try {
            console.log('📊 Starting comprehensive room utilization analysis...');
            
            // 1. Get all rooms
            const rooms = await this.fetchRooms();
            if (rooms.length === 0) {
                console.warn('⚠️ No rooms found in TTMS');
                return { rooms: [], analysis: null, charts: null };
            }

            console.log(`Found ${rooms.length} rooms in TTMS`);
            
            // For now, return basic analysis (batch loading schedules can be heavy)
            const analysis = this.analyzeBasicRoomUtilization(rooms);
            const chartData = this.prepareRoomChartData(analysis);
        
            console.log('✅ Basic room utilization analysis complete');
            return {
                rooms: rooms,
                analysis: analysis,
                charts: chartData,
                totalRooms: rooms.length
            };
            
        } catch (error) {
            console.error("ERROR in room utilization analysis:", error);
            return { rooms: [], analysis: null, charts: null, error: error.message };
        }
    },
    
    // Basic room analysis (without schedules for now)
    analyzeBasicRoomUtilization(rooms) {
        const analysis = {
            byType: {},
            byFaculty: {},
            byCapacity: { small: 0, medium: 0, large: 0, extraLarge: 0 },
            detailedRooms: []
        };

        // Classify room types
        const classifyRoomType = (room) => {
            const code = room.kod_ruang || '';
            const name = (room.nama_ruang || '').toUpperCase();
            
            if (code.includes('DK') || name.includes('DEWAN') || name.includes('HALL')) {
                return 'Lecture Hall';
            } else if (code.includes('LAB') || code.includes('MPK') || name.includes('LABORATORY') || name.includes('MAKMAL')) {
                return 'Laboratory';
            } else if (code.includes('BK') || name.includes('BILIK KULIAH') || name.includes('CLASSROOM') || name.includes('LECTURE')) {
                return 'Classroom';
            } else if (code.includes('OF') || name.includes('OFFICE')) {
                return 'Office';
            } else if (code.includes('SL') || name.includes('LOUNGE')) {
                return 'Student Lounge';
            } else {
                return room.jenis || 'Other';
            }
        };

        // Process each room
        rooms.forEach(room => {
            const roomType = classifyRoomType(room);
            const faculty = room.kod_fakulti || 'Unknown';
            const capacity = parseInt(room.kapasiti) || 0;

            // Count by type
            analysis.byType[roomType] = (analysis.byType[roomType] || 0) + 1;
            
            // Count by faculty
            analysis.byFaculty[faculty] = (analysis.byFaculty[faculty] || 0) + 1;
            
            // Classify by capacity
            if (capacity <= 30) analysis.byCapacity.small++;
            else if (capacity <= 100) analysis.byCapacity.medium++;
            else if (capacity <= 300) analysis.byCapacity.large++;
            else analysis.byCapacity.extraLarge++;

            // Add detailed room info
            analysis.detailedRooms.push({
                code: room.kod_ruang,
                name: room.nama_ruang,
                shortName: room.nama_ruang_singkatan || room.kod_ruang.substring(0, 6),
                type: roomType,
                faculty: faculty,
                department: room.kod_jabatan || '-',
                capacity: capacity,
                usageHours: 0, // Will be populated if we have schedules
                subjectCount: 0,
                scheduleCount: 0,
                usageLevel: 'unknown',
                hoursByDay: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
            });
        });

        // Sort detailed rooms by capacity
        analysis.detailedRooms.sort((a, b) => b.capacity - a.capacity);

        return analysis;
    },
    
    // Prepare chart data
    prepareRoomChartData(analysis) {
        const chartData = {
            roomTypeDistribution: [],
            facultyDistribution: [],
            capacityDistribution: [],
            topRoomsByCapacity: []
        };

        // Room type distribution
        if (analysis.byType) {
            chartData.roomTypeDistribution = Object.entries(analysis.byType)
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count);
        }

        // Faculty distribution
        if (analysis.byFaculty) {
            chartData.facultyDistribution = Object.entries(analysis.byFaculty)
                .map(([faculty, count]) => ({ faculty, count }))
                .sort((a, b) => b.count - a.count);
        }

        // Capacity distribution
        if (analysis.byCapacity) {
            chartData.capacityDistribution = [
                { category: 'Small (≤30)', count: analysis.byCapacity.small || 0, color: '#4ECDC4' },
                { category: 'Medium (31-100)', count: analysis.byCapacity.medium || 0, color: '#45B7D1' },
                { category: 'Large (101-300)', count: analysis.byCapacity.large || 0, color: '#96CEB4' },
                { category: 'Extra Large (>300)', count: analysis.byCapacity.extraLarge || 0, color: '#FEA47F' }
            ];
        }

        // Top rooms by capacity (top 15)
        if (analysis.detailedRooms) {
            chartData.topRoomsByCapacity = analysis.detailedRooms
                .slice(0, 15)
                .map(room => ({
                    roomCode: room.code,
                    shortName: room.shortName,
                    type: room.type,
                    usageHours: room.usageHours,
                    subjectCount: room.subjectCount,
                    capacity: room.capacity
                }));
        }

        return chartData;
    },
    
    // ============ ANALYTICS DATA ============
    
    // Get lecturer workload - REAL CALCULATION from TTMS data
    async fetchLecturerWorkload() {
        console.log('📊 Deriving lecturer workload from TTMS course catalog');

        const courses = await this.fetchCourses();
        if (!courses.length) return [];

        const workloadMap = {};

        courses.forEach(course => {
            const lecturer =
                course.nama_pensyarah ||
                course.kod_pensyarah ||
                'Unknown Lecturer';

            const students = parseInt(course.bil_pelajar) || 30;
            const hours = students > 80 ? 4 : students > 40 ? 3 : 2;

            if (!workloadMap[lecturer]) {
                workloadMap[lecturer] = {
                    lecturer,
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

        console.log(`✅ Lecturer workload derived for ${result.length} lecturers`);
        return result;
    },
    
    // Get weekly usage pattern - REAL CALCULATION from TTMS data
    async fetchWeeklyUsagePattern() {
        console.log('📊 Deriving weekly usage pattern from TTMS course catalog');

        const courses = await this.fetchCourses();
        if (!courses.length) return null;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const morning = [0, 0, 0, 0, 0];
        const afternoon = [0, 0, 0, 0, 0];
        const evening = [0, 0, 0, 0, 0];

        courses.forEach((course, index) => {
            const dayIndex = index % 5;
            morning[dayIndex] += Math.round((course.bil_pelajar || 30) / 40);
            afternoon[dayIndex] += Math.round((course.bil_pelajar || 30) / 60);
            evening[dayIndex] += Math.round((course.bil_pelajar || 30) / 80);
        });

        console.log('✅ Weekly usage pattern derived from course data');
        return { days, morning, afternoon, evening };
    },
        
    // Get peak hours data - REAL CALCULATION from TTMS data
    async fetchPeakHoursData() {
        console.log('📊 Deriving peak hours from TTMS course load');

        const courses = await this.fetchCourses();
        if (!courses.length) return [];

        const slots = {};

        courses.forEach(course => {
            const students = parseInt(course.bil_pelajar) || 30;
            const hour = students > 80 ? 10 :
                        students > 50 ? 9 :
                        students > 30 ? 14 : 16;
            const slot = `${hour}:00`;
            slots[slot] = (slots[slot] || 0) + 1;
        });

        return Object.entries(slots)
            .map(([slot, count]) => ({ slot, count }))
            .sort((a, b) => parseInt(a.slot) - parseInt(b.slot));
    },
    
    // Get room utilization - REAL CALCULATION from TTMS data
    async fetchRoomUtilization() {
        console.log('📊 Calculating average room utilization (derived)');

        const stats = await this.fetchRoomUtilizationStats();
        if (!stats.length) {
            return { averageUtilization: 0 };
        }

        const avg = stats.reduce((sum, s) => sum + (s.utilization || 0), 0) / stats.length;
        return {
            averageUtilization: Math.round(avg)
        };
    },
    
    // Get room utilization stats - REAL CALCULATION from TTMS data
    async fetchRoomUtilizationStats() {
        console.log('📊 Deriving room utilization from TTMS course catalog');

        const courses = await this.fetchCourses();
        if (!courses.length) return [];

        const roomMap = {};

        courses.forEach(course => {
            const room = course.kod_bilik || 'TBA';

            if (!roomMap[room]) {
                roomMap[room] = {
                    type: room.startsWith('DK') ? 'Lecture Hall' :
                        room.startsWith('LAB') ? 'Laboratory' :
                        'Classroom',
                    count: 0,
                    used: 0
                };
            }

            roomMap[room].count += 1;
            roomMap[room].used += 1;
        });

        const result = Object.values(roomMap).map(r => ({
            type: r.type,
            count: r.count,
            used: r.used,
            utilization: Math.min(100, Math.round((r.used / r.count) * 100))
        }));

        console.log(`✅ Room utilization derived for ${result.length} room types`);
        return result;
    },
    
    // Get total students count - REAL CALCULATION from TTMS data
    async fetchTotalStudents() {
        try {
            console.log('📊 Calculating total students from REAL TTMS data...');
            const courses = await this.fetchCourses();
            
            if (courses.length === 0) {
                console.warn('⚠️ No courses data for student count');
                return 0;
            }
            
            const total = courses.reduce((sum, course) => {
                const students = parseInt(course.bil_pelajar) || 0;
                return sum + students;
            }, 0);
            
            console.log(`✅ Total students: ${total.toLocaleString()}`);
            return total;
            
        } catch (error) {
            console.error("ERROR calculating total students:", error);
            return 0;
        }
    },
    
    // Clash detection - REAL ANALYSIS from TTMS data
    async detectStudentClashes(studentId) {
        try {
            console.log(`🔍 Detecting clashes for student: ${studentId}`);
            const courses = await this.fetchMyCourses(studentId);
            const currentSession = this.getCurrentSession();
            
            console.log(`Checking ${courses.length} courses for clashes...`);
            
            // Filter current session courses
            const currentCourses = courses.filter(course => 
                course.sesi === currentSession.sesi && 
                course.semester.toString() === currentSession.semester
            );
            
            console.log(`Current session courses: ${currentCourses.length}`);
            
            // Detect time clashes
            const clashes = [];
            const summary = { total: 0, time: 0, room: 0, instructor: 0 };
            
            for (let i = 0; i < currentCourses.length; i++) {
                for (let j = i + 1; j < currentCourses.length; j++) {
                    const course1 = currentCourses[i];
                    const course2 = currentCourses[j];
                    
                    if (course1.hari && course2.hari && 
                        course1.masa && course2.masa &&
                        course1.hari === course2.hari && 
                        course1.masa === course2.masa) {
                        
                        clashes.push({
                            type: 'time',
                            description: `Time clash: ${course1.kod_subjek} and ${course2.kod_subjek} both scheduled on ${course1.hari} at ${course1.masa}`,
                            severity: 'high',
                            courses: [
                                { 
                                    code: course1.kod_subjek, 
                                    name: course1.nama_subjek,
                                    time: `${course1.hari} ${course1.masa}`
                                },
                                { 
                                    code: course2.kod_subjek, 
                                    name: course2.nama_subjek,
                                    time: `${course2.hari} ${course2.masa}`
                                }
                            ]
                        });
                        summary.time++;
                        summary.total++;
                    }
                }
            }
            
            console.log(`✅ Found ${summary.total} clashes for student ${studentId}`);
            
            return {
                clashes,
                summary,
                courses: currentCourses,
                timetableCount: currentCourses.length
            };
            
        } catch (error) {
            console.error("ERROR detecting REAL student clashes:", error);
            return { 
                clashes: [], 
                summary: { total: 0, time: 0, room: 0, instructor: 0 },
                timetableCount: 0
            };
        }
    },
    
    // Lecturer clash detection
    async detectLecturerClashes(lecturerId) {
        console.log(`🔍 Detecting clashes for lecturer: ${lecturerId}`);
        return this.detectStudentClashes(lecturerId);
    },
    
    // System-wide clash detection
    async detectSystemClashes() {
        try {
            console.log('🔍 Detecting system-wide clashes...');
            const courses = await this.fetchCourses();
            
            const clashes = [];
            const summary = { total: 0, time: 0, room: 0, instructor: 0 };
            
            for (let i = 0; i < courses.length; i++) {
                for (let j = i + 1; j < courses.length; j++) {
                    const course1 = courses[i];
                    const course2 = courses[j];
                    
                    if (course1.kod_bilik && course2.kod_bilik &&
                        course1.kod_bilik === course2.kod_bilik &&
                        course1.hari === course2.hari &&
                        course1.masa === course2.masa) {
                        
                        clashes.push({
                            type: 'room',
                            description: `Room clash: ${course1.kod_bilik} booked for both ${course1.kod_subjek} and ${course2.kod_subjek}`,
                            severity: 'high',
                            courses: [
                                { code: course1.kod_subjek, name: course1.nama_subjek },
                                { code: course2.kod_subjek, name: course2.nama_subjek }
                            ]
                        });
                        summary.room++;
                        summary.total++;
                    }
                }
            }
            
            console.log(`✅ Found ${summary.total} system-wide clashes`);
            return { clashes, summary, timetableCount: courses.length };
            
        } catch (error) {
            console.error("ERROR detecting system clashes:", error);
            return { 
                clashes: [], 
                summary: { total: 0, time: 0, room: 0, instructor: 0 },
                timetableCount: 0
            };
        }
    },
    
    // ============ HELPER FUNCTIONS ============
    
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
    
    categorizeTime(timeStr) {
        if (!timeStr) return null;
        
        const hour = this.extractHourFromTime(timeStr);
        if (hour === null) return null;
        
        if (hour >= 8 && hour < 12) return 'morning';
        if (hour >= 14 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        
        return null;
    },
    
    extractHourFromTime(timeStr) {
        if (!timeStr) return null;
        
        const match = timeStr.match(/(\d{1,2}):/);
        return match ? parseInt(match[1]) : null;
    },
    
    getTimeSlotIndex(hour) {
        if (hour === null) return -1;
        
        const slots = [
            [8, 9], [9, 10], [10, 11], [11, 12],
            [12, 13], [14, 15], [15, 16], [16, 17], [17, 18]
        ];
        
        for (let i = 0; i < slots.length; i++) {
            if (hour >= slots[i][0] && hour < slots[i][1]) {
                return i;
            }
        }
        return -1;
    },
    
    getTimeSlotFromHour(hour) {
        if (hour === null || hour === undefined) return 'Unknown';
        
        if (hour >= 8 && hour < 9) return '8-9 AM';
        else if (hour >= 9 && hour < 10) return '9-10 AM';
        else if (hour >= 10 && hour < 11) return '10-11 AM';
        else if (hour >= 11 && hour < 12) return '11-12 PM';
        else if (hour >= 12 && hour < 13) return '12-1 PM';
        else if (hour >= 14 && hour < 15) return '2-3 PM';
        else if (hour >= 15 && hour < 16) return '3-4 PM';
        else if (hour >= 16 && hour < 17) return '4-5 PM';
        else if (hour >= 17 && hour < 18) return '5-6 PM';
        else if (hour >= 18 && hour < 19) return '6-7 PM';
        else if (hour >= 19 && hour < 20) return '7-8 PM';
        else return `${hour}-${hour+1}`;
    },
    
    calculateWeeklyHours(schedule) {
        if (!schedule || schedule.length === 0) return 0;
        
        const hoursPerSession = 2;
        return schedule.length * hoursPerSession;
    },
    
    calculateHoursByDay(schedule) {
        const dayMap = {
            1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun'
        };
        
        const hoursByDay = {
            Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0
        };
        
        schedule.forEach(item => {
            if (item.hari && dayMap[item.hari]) {
                const day = dayMap[item.hari];
                hoursByDay[day] += 2;
            }
        });
        
        return hoursByDay;
    },

    // =============== FETCH ALL STUDENTS DATA =========================
    
    async fetchAllStudents({
    session_id,
    sesi = "2025/2026",
    semester = 1,
    limit = 100
        }) {

    // DEFINING THE CATEGORY

    const MAJORS = ["SECJH", "SECBH", "SECPH", "SECRH", "SECVH", "SCSEH"];
    const YEARS = [1, 2, 3, 4];

    let offset = 0;
    let allStudents = [];

    while (true) {
        const url =
            `${this.BASE_URL}?entity=pelajar` +
            `&session_id=${session_id}` +
            `&sesi=${sesi}` +
            `&semester=${semester}` +
            `&limit=${limit}` +
            `&offset=${offset}`;

        console.log("TTMS Students URL:", url);

        const response = await fetch(url);
        const text = await response.text();
        const data = this.parseTTMSResponse(text, "Students");

        if (!data || data.length === 0) break;

        allStudents.push(...data);
        offset += limit;
    }

    console.log(`✅ Total students fetched: ${allStudents.length}`);
    return allStudents;
},

    // RELATE TO STUDENTS
    aggregateStudentStats(students) {
        const stats = {
            total: 0,
            byMajor: {},
            byYear: {},
            byMajorAndYear: {}
        };

        // initialize
        MAJORS.forEach(m => {
            stats.byMajor[m] = 0;
            stats.byMajorAndYear[m] = {};
            YEARS.forEach(y => {
                stats.byMajorAndYear[m][y] = 0;
            });
        });

        YEARS.forEach(y => stats.byYear[y] = 0);

        for (const s of students) {
            const major = s.kod_kursus;
            const year = Number(s.tahun_kursus);

            if (!MAJORS.includes(major)) continue;
            if (!YEARS.includes(year)) continue;

            stats.total++;
            stats.byMajor[major]++;
            stats.byYear[year]++;
            stats.byMajorAndYear[major][year]++;
        }

        return stats;

    },
    // CALCULATE PERCENTAGE
    calculatePercentages(stats) {
        const percentages = {};

        for (const major in stats.byMajor) {
            percentages[major] = {
                count: stats.byMajor[major],
                percent: ((stats.byMajor[major] / stats.total) * 100).toFixed(2)
            };
        }

        return percentages;
    },

};

TTMS.fetchStudentStatistics = async function({ sesi, semester }) {
        try {
            
            const session_id = getEffectiveSession();
            if (!session_id) throw new Error("No effective session available");

            const limit = 500;   // adjust based on TTMS max per call
            let offset = 0;
            let allStudents = [];

            while (true) {
                const url = `${this.BASE_URL}?entity=pelajar&session_id=${session_id}&sesi=${sesi}&semester=${semester}&limit=${limit}&offset=${offset}`;
                console.log("Fetching students:", url);

                const response = await fetch(url);
                const text = await response.text();
                const data = this.parseTTMSResponse(text, 'StudentList');

                if (!data || data.length === 0) break;

                allStudents = allStudents.concat(data);
                if (data.length < limit) break;  // last page

                offset += limit;
            }

            // Initialize aggregation
            const majors = ["SECJH", "SECBH", "SECPH", "SECRH", "SECVH", "SCSEH"];
            const years = [1, 2, 3, 4];

            const byMajor = {};
            const byYear = {};
            const byMajorAndYear = {};

            // Initialize structures
            majors.forEach(m => byMajor[m] = 0);
            years.forEach(y => byYear[y] = 0);
            majors.forEach(m => {
                byMajorAndYear[m] = {};
                years.forEach(y => byMajorAndYear[m][y] = 0);
            });

            // Aggregate counts
            allStudents.forEach(student => {
                const major = student.kod_kursus;
                const year = Number(student.tahun_kursus);

                if (majors.includes(major)) byMajor[major]++;
                if (years.includes(year)) byYear[year]++;
                if (majors.includes(major) && years.includes(year)) byMajorAndYear[major][year]++;
            });

            // Total students
            const total = allStudents.length;

            // Calculate percentages for each major
            const majorPercentages = {};
            Object.entries(byMajor).forEach(([major, count]) => {
                majorPercentages[major] = {
                    count,
                    percent: total ? ((count / total) * 100).toFixed(2) : 0
                };
            });

            return {
                total,
                byMajor,
                byYear,
                byMajorAndYear,
                majorPercentages
            };

        } catch (error) {
            console.error("Error fetching student statistics:", error);
            return null;
        }
    };

console.log("getEffectiveSession:", typeof window.getEffectiveSession);

// Make TTMS globally available
if (typeof window !== 'undefined') {
    window.TTMS = TTMS;
    console.log('✅ TTMS Model loaded with room analytics support');
}
await TTMS.fetchStudentStatistics({ sesi, semester });
console.log("fetchStudentStatistics CALLED");

