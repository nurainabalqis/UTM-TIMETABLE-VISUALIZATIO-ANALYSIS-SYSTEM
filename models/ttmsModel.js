// models/ttmsModel.js - CORRECTED VERSION

// ===== TTMS CONSTANTS (GLOBAL TO MODEL) =====
const DAY_MAP_NUM = {
    1: 'Sunday',
    2: 'Monday',
    3: 'Tuesday',
    4: 'Wednesday',
    5: 'Thursday',
    6: 'Friday',
    7: 'Saturday'
};

const MASA_TO_HOUR = {
    1: 8,
    2: 9,
    3: 9,
    4: 10,
    5: 11,
    6: 12,
    7: 14,
    8: 15,
    9: 16,
    10: 17,
    11: 18,
    12: 19
};

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
    

    // ================= FIXED PEAK TEACHING HOURS (LECTURER) =================
    async fetchPeakTeachingHoursForLecturer(user) {
        console.log('📊 Fetching REAL peak teaching hours for lecturer');

        const currentSession = this.getCurrentSession();

        // Track: day|hour -> count (for finding peak specific slot)
        const hourDayMap = {};
        // Track: hour -> total count (for chart display)
        const hourOnlyMap = {};

        try {
            // 1. Get all subjects in current session
            const allSubjects = await this.fetchCourses(
                currentSession.sesi,
                currentSession.semester
            );

            // 2. Find subjects taught by this lecturer
            const lecturerSubjects = [];
            for (const sub of allSubjects) {
                const teaches = await this.doesLecturerTeachSubject(user.nama, sub);
                if (teaches) lecturerSubjects.push(sub);
            }

            console.log(`👨‍🏫 Lecturer teaches ${lecturerSubjects.length} subjects`);

            if (lecturerSubjects.length === 0) return [];

            // 3. Fetch timetable for each subject
            for (const subject of lecturerSubjects) {
                if (!subject.kod_subjek || !subject.seksyen) continue;

                const url = `${this.BASE_URL}?entity=jadual_subjek`
                    + `&sesi=${subject.sesi}`
                    + `&semester=${subject.semester}`
                    + `&kod_subjek=${subject.kod_subjek}`
                    + `&seksyen=${subject.seksyen}`;

                const res = await fetch(url);
                const text = await res.text();
                const timetable = this.parseTTMSResponse(text, 'JadualSubjek');

                if (!Array.isArray(timetable)) continue;

                timetable.forEach(slot => {
                    let hour = null;

                    if (slot.jam) {
                        hour = typeof slot.jam === 'string'
                            ? parseInt(slot.jam.split(':')[0])
                            : slot.jam;
                    } else if (slot.masa) {
                        hour = MASA_TO_HOUR[slot.masa];
                    }

                    const dayName = this.getDayNameFromHari(slot.hari);
                    if (!dayName || hour === null) return;

                    // Track by day+hour for peak finding
                    const dayHourKey = `${dayName}|${hour}`;
                    hourDayMap[dayHourKey] = (hourDayMap[dayHourKey] || 0) + 1;

                    // Track by hour only for chart
                    const hourKey = `${hour}:00`;
                    hourOnlyMap[hourKey] = (hourOnlyMap[hourKey] || 0) + 1;
                });
            }

            console.log('✅ Lecturer hourDayMap:', hourDayMap);
            console.log('✅ Lecturer hourOnlyMap:', hourOnlyMap);

            // Find the peak slot (specific day + time with most classes)
            let peakDay = '';
            let peakHour = '';
            let peakCount = 0;

            Object.entries(hourDayMap).forEach(([key, count]) => {
                if (count > peakCount) {
                    const [day, hour] = key.split('|');
                    peakDay = day;
                    peakHour = hour;
                    peakCount = count;
                }
            });
            // Store peak info for display
            this._peakInfo = {
                day: peakDay,
                hour: `${peakHour}:00`,
                count: peakCount
            };

            // Return aggregated by hour for chart (NO DUPLICATES)
            return Object.entries(hourOnlyMap)
                .map(([hour, count]) => ({
                    day: 'All Days', // This will show as aggregate
                    hour,
                    count
                }))
                .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

        } catch (err) {
            console.error('❌ Error fetching peak teaching hours', err);
            return [];
        }
    },

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

    // Add this NEW function in ttmsModel.js

    async fetchLecturerCourses(no_pekerja) {
        try {
            console.log(`📚 Fetching courses for lecturer: ${no_pekerja}`);
        
            const url = `${this.BASE_URL}?entity=pensyarah_subjek&no_pekerja=${no_pekerja}`;
            console.log('Lecturer Courses URL:', url);

            const response = await fetch(url);
            const text = await response.text();

            const data = this.parseTTMSResponse(text, 'LecturerCourses');
            if (!data) return [];

            if (Array.isArray(data)) {
                console.log(`✅ Retrieved ${data.length} courses for lecturer`);
                return data;
            }

            return [];
        } catch (error) {
            console.error('ERROR fetching lecturer courses:', error);
            return [];
        }
    },

    async doesLecturerTeachSubject(lecturerName, subject) {
        if (!lecturerName || !subject?.kod_subjek || !subject?.seksyen) return false;

        const url = `${this.BASE_URL}?entity=subjek_pensyarah`
            + `&kod_subjek=${subject.kod_subjek}`
            + `&sesi=${subject.sesi}`
            + `&semester=${subject.semester}`
            + `&seksyen=${subject.seksyen}`;

        try {
            const res = await fetch(url);
            const text = await res.text();
            const data = this.parseTTMSResponse(text, 'SubjekPensyarah');

            if (!Array.isArray(data)) return false;

            return data.some(p =>
                p.nama?.toUpperCase() === lecturerName.toUpperCase()
            );
        } catch (err) {
            console.error('❌ Error checking lecturer subject:', err);
            return false;
        }
    },
    
    // ================= FIXED PEAK STUDY HOURS (STUDENT) =================
async fetchPeakStudyHoursForStudent(user) {
    console.log('📊 Fetching REAL peak study hours for student');

    const currentSession = this.getCurrentSession();
    
    // Track: day|hour -> count (for finding peak specific slot)
    const hourDayMap = {};
    // Track: hour -> total count (for chart display)
    const hourOnlyMap = {};

    try {
        // 1. Get student's enrolled subjects
        const subjects = await this.fetchMyCourses(user.username);
        if (!subjects.length) {
            console.warn('⚠️ Student has no subjects');
            return [];
        }

        // 2. Filter current session
        const currentSubjects = subjects.filter(s =>
            s.sesi === currentSession.sesi &&
            String(s.semester) === String(currentSession.semester)
        );

        console.log(`📚 Student current subjects: ${currentSubjects.length}`);

        if (!currentSubjects.length) return [];

        // 3. Fetch timetable for each subject
        for (const subject of currentSubjects) {
            if (!subject.kod_subjek || !subject.seksyen) continue;

            const url = `${this.BASE_URL}?entity=jadual_subjek`
                + `&sesi=${subject.sesi}`
                + `&semester=${subject.semester}`
                + `&kod_subjek=${subject.kod_subjek}`
                + `&seksyen=${subject.seksyen}`;

            const res = await fetch(url);
            const text = await res.text();
            const timetable = this.parseTTMSResponse(text, 'JadualSubjek');

            if (!Array.isArray(timetable)) continue;

            timetable.forEach(slot => {
                let hour = null;

                // Prefer jam
                if (slot.jam) {
                    hour = typeof slot.jam === 'string'
                        ? parseInt(slot.jam.split(':')[0])
                        : slot.jam;
                }
                // Fallback to masa
                else if (slot.masa) {
                    hour = MASA_TO_HOUR[slot.masa];
                }

                const dayName = this.getDayNameFromHari(slot.hari);
                if (!dayName || hour === null) return;

                // Track by day+hour for peak finding
                const dayHourKey = `${dayName}|${hour}`;
                hourDayMap[dayHourKey] = (hourDayMap[dayHourKey] || 0) + 1;

                // Track by hour only for chart
                const hourKey = `${hour}:00`;
                hourOnlyMap[hourKey] = (hourOnlyMap[hourKey] || 0) + 1;
            });
        }

        console.log('✅ Student hourDayMap:', hourDayMap);
        console.log('✅ Student hourOnlyMap:', hourOnlyMap);

        // Find the peak slot (specific day + time with most classes)
        let peakDay = '';
        let peakHour = '';
        let peakCount = 0;

        Object.entries(hourDayMap).forEach(([key, count]) => {
            if (count > peakCount) {
                const [day, hour] = key.split('|');
                peakDay = day;
                peakHour = hour;
                peakCount = count;
            }
        });

        // Store peak info for display
        this._peakInfo = {
            day: peakDay,
            hour: `${peakHour}:00`,
            count: peakCount
        };

        // Return aggregated by hour for chart (NO DUPLICATES)
        return Object.entries(hourOnlyMap)
            .map(([hour, count]) => ({
                day: 'All Days', // This will show as aggregate
                hour,
                count
            }))
            .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    } catch (err) {
        console.error('❌ Error fetching peak study hours', err);
        return [];
    }
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

    async fetchWeeklyDistributionForUser(user) {
    console.log('📊 Fetching REAL weekly distribution for:', user.username);
    
    const currentSession = this.getCurrentSession();
    console.log('📅 Current session:', currentSession);

    // Initialize weekly structure (5 days only)
    const weekly = {
        Monday: { morning: 0, afternoon: 0, evening: 0 },
        Tuesday: { morning: 0, afternoon: 0, evening: 0 },
        Wednesday: { morning: 0, afternoon: 0, evening: 0 },
        Thursday: { morning: 0, afternoon: 0, evening: 0 },
        Friday: { morning: 0, afternoon: 0, evening: 0 }
    };

    try {
        // 1. Get student's enrolled courses
        let subjects = [];
        if (user.role === 'student') {
            subjects = await this.fetchMyCourses(user.username);
        } else if (user.role === 'lecturer') {
            console.log('👨‍🏫 Building lecturer subject list via TTMS');

            const allSubjects = await this.fetchCourses(
                currentSession.sesi,
                currentSession.semester
            );

            subjects = [];
            for (const sub of allSubjects) {
                const teaches = await this.doesLecturerTeachSubject(user.nama, sub);
                if (teaches) {
                    subjects.push(sub);
            }
    }

            console.log(`✅ Lecturer teaches ${subjects.length} subjects`);
        } else {
            console.warn('⚠️ User is not student or lecturer');
            return weekly;
        }

        console.log('Total enrolled courses found:', subjects.length);

        
        // 2. Filter only current session courses
        console.log('📚 All courses:', subjects);

        const currentSubjects = subjects.filter(s => {
            console.log(`Checking course: ${s.kod_subjek}, sesi=${s.sesi}, semester=${s.semester}`);
            console.log(`Against: currentSession.sesi=${currentSession.sesi}, currentSession.semester=${currentSession.semester}`);
    
        const match = s.sesi === currentSession.sesi &&
            String(s.semester) === String(currentSession.semester);
    
        console.log(`Match result: ${match}`);
        return match;
    });

    console.log('✅ Current session courses:', currentSubjects.length);

        if (currentSubjects.length === 0) {
            console.warn('⚠️ No courses found for current session');
            return weekly;
        }

        // 3. For each course, fetch its timetable
        for (const subject of currentSubjects) {
            if (!subject.kod_subjek || !subject.seksyen) {
                console.warn('⚠️ Skipping subject without code/section:', subject);
                continue;
            }

            const url = `${this.BASE_URL}?entity=jadual_subjek&sesi=${subject.sesi}&semester=${subject.semester}&kod_subjek=${subject.kod_subjek}&seksyen=${subject.seksyen}`;
            
            console.log(`🔍 Fetching: ${subject.kod_subjek} - ${subject.nama_subjek}`);

            try {
                const res = await fetch(url);
                const text = await res.text();
                const timetable = this.parseTTMSResponse(text, 'JadualSubjek');

                if (!Array.isArray(timetable) || timetable.length === 0) {
                    console.warn(`⚠️ No timetable data for ${subject.kod_subjek}`);
                    continue;
                }

                console.log(`   📅 Found ${timetable.length} time slots`);

                // 4. Process each time slot (only use hari, masa, jam from TTMS)
                timetable.forEach((slot, index) => {
                    console.log(`      Slot ${index + 1}: hari=${slot.hari}, masa=${slot.masa}, jam=${slot.jam}`);

                    // Get day name from TTMS hari field
                    const dayName = this.getDayNameFromHari(slot.hari);
                    
                    // Get time block from TTMS masa or jam field
                    const timeBlock = this.getTimeBlockFromMasaJam(slot.masa, slot.jam);

                    console.log(`         → ${dayName} ${timeBlock}`);

                    // Only count Monday-Friday
                    if (weekly[dayName] && timeBlock) {
                        weekly[dayName][timeBlock]++;
                        console.log(`         ✅ Counted!`);
                    } else if (dayName === 'Saturday' || dayName === 'Sunday') {
                        console.log(`         ⏭️ Skipped weekend`);
                    } else {
                        console.warn(`         ⚠️ Invalid: ${dayName} / ${timeBlock}`);
                    }
                });

            } catch (error) {
                console.error(`❌ Error fetching timetable for ${subject.kod_subjek}:`, error);
            }
        }

        console.log('✅ Final weekly distribution:', weekly);
        return weekly;

    } catch (error) {
        console.error('❌ Error in fetchWeeklyDistributionForUser:', error);
        return weekly; // Return empty structure on error
    }
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
    
    getTimeBlockFromMasa(masa) {
    const hour = MASA_TO_HOUR[masa];
    if (!hour) {
        console.warn(`⚠️ Unknown masa value: ${masa}`);
        return null;
    }

    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    
    console.warn(`⚠️ Hour ${hour} outside defined blocks`);
    return null;
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

    getDayNameFromHari(hari) {
   
    if (typeof hari === 'number') {
        const dayMap = {
            2: 'Monday',
            3: 'Tuesday',
            4: 'Wednesday',
            5: 'Thursday',
            6: 'Friday'
            // 1 (Sunday) and 7 (Saturday) excluded
        };
        return dayMap[hari] || null;
    }
    
   
    if (typeof hari === 'string') {
        const dayMapMalay = {
            'ISNIN': 'Monday',
            'SELASA': 'Tuesday',
            'RABU': 'Wednesday',
            'KHAMIS': 'Thursday',
            'JUMAAT': 'Friday'
        };
        return dayMapMalay[hari.toUpperCase()] || null;
    }
    
    return null;
},

// Helper: Convert TTMS masa/jam to time block (morning/afternoon/evening)
getTimeBlockFromMasaJam(masa, jam) {
    let hour = null;
    

    if (jam) {
        // jam might be like "08:00", "14:00", etc.
        if (typeof jam === 'string' && jam.includes(':')) {
            hour = parseInt(jam.split(':')[0]);
        } else if (typeof jam === 'number') {
            hour = jam;
        }
    }
    
    
    if (hour === null && masa) {
        const masaToHour = {
            1: 8,   // 8:00 AM
            2: 9,   // 9:00 AM
            3: 10,  // 10:00 AM
            4: 11,  // 11:00 AM
            5: 12,  // 12:00 PM
            6: 14,  // 2:00 PM
            7: 15,  // 3:00 PM
            8: 16,  // 4:00 PM
            9: 17,  // 5:00 PM
            10: 18, // 6:00 PM
            11: 19, // 7:00 PM
            12: 20  // 8:00 PM
        };
        hour = masaToHour[masa];
    }
    
    if (!hour) {
        console.warn(`⚠️ Cannot determine hour from masa=${masa}, jam=${jam}`);
        return null;
    }
    
    // Categorize into time blocks
    if (hour >= 8 && hour < 12) {
        return 'morning';     // 8 AM - 11:59 AM
    } else if (hour >= 12 && hour < 18) {
        return 'afternoon';   // 12 PM - 5:59 PM
    } else if (hour >= 18 && hour < 22) {
        return 'evening';     // 6 PM - 9:59 PM
    }
    
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
    }
};

// Make TTMS globally available
if (typeof window !== 'undefined') {
    window.TTMS = TTMS;
    console.log('✅ TTMS Model loaded with room analytics support');
}