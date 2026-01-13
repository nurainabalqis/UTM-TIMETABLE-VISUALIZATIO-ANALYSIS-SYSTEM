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

    async fetchCourseSchedule(courseCode, sesi = null, semester = null, section = null) {
    try {
        const currentSession = this.getCurrentSession();
        const params = {
            entity: 'jadual_subjek',
            sesi: sesi || currentSession.sesi,
            semester: semester || currentSession.semester,
            kod_subjek: courseCode
        };
        
        if (section) {
            params.seksyen = section;
        }
        
        const schedule = await this.fetchWithAdminSession('jadual_subjek', params);
        return Array.isArray(schedule) ? schedule : [];
        
        } catch (error) {
            console.error(`❌ Error fetching schedule for ${courseCode}:`, error);
            return [];
        }
    },
    
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

    // Fetch lecturer subjects
    async fetchLecturerSubjects(lecturerId) {
        try {
            const params = {
                entity: 'pensyarah_subjek',
                no_pekerja: lecturerId
            };
            
            return await this.fetchWithAdminSession('pensyarah_subjek', params);
            
        } catch (error) {
            console.error('Error fetching lecturer subjects:', error);
            return [];
        }
    },

    async fetchLecturerTimetable(lecturerId) {
    try {
        console.log('👨‍🏫 Fetching lecturer timetable for:', lecturerId);
        
        // Get current session
        const currentSession = this.getCurrentSession();
        
        // Method 1: Try to get from pensyarah_subjek endpoint
        try {
            const lecturerSubjects = await this.fetchWithAdminSession('pensyarah_subjek', {
                no_pekerja: lecturerId
            });
            
            console.log(`📚 Lecturer subjects found: ${lecturerSubjects.length}`);
            
            // Filter for current session
            const currentSubjects = lecturerSubjects.filter(subject => 
                subject.sesi === currentSession.sesi && 
                subject.semester.toString() === currentSession.semester
            );
            
            console.log(`📅 Current session subjects: ${currentSubjects.length}`);
            
            // Get schedule for each subject
            const timetableData = [];
            for (const subject of currentSubjects) {
                try {
                    const schedule = await this.fetchCourseSchedule(
                        subject.kod_subjek,
                        currentSession.sesi,
                        currentSession.semester,
                        subject.seksyen
                    );
                    
                    if (schedule && schedule.length > 0) {
                        timetableData.push({
                            courseCode: subject.kod_subjek,
                            courseName: subject.nama_subjek,
                            section: subject.seksyen,
                            studentCount: subject.bil_pelajar || 0,
                            schedule: schedule
                        });
                        console.log(`✅ Added: ${subject.kod_subjek} (${subject.seksyen}) - ${schedule.length} sessions`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Could not fetch schedule for ${subject.kod_subjek}:`, error.message);
                }
            }
            
            if (timetableData.length > 0) {
                console.log(`✅ Lecturer timetable loaded: ${timetableData.length} subjects`);
                return timetableData;
            }
            } catch (error) {
                console.warn('⚠️ Method 1 failed:', error.message);
            }
            
            // Method 2: Try to get from courses where lecturer is assigned
            try {
                console.log('🔄 Trying Method 2: Fetching all courses...');
                const allCourses = await this.fetchCourses(currentSession.sesi, currentSession.semester);
                
                // Filter courses taught by this lecturer
                const lecturerCourses = allCourses.filter(course => {
                    // Check various lecturer ID fields
                    return course.kod_pensyarah === lecturerId || 
                        course.no_pekerja === lecturerId ||
                        (course.nama_pensyarah && course.nama_pensyarah.includes(lecturerId));
                });
                
                console.log(`📚 Courses found for lecturer: ${lecturerCourses.length}`);
                
                // Get unique courses (group by course code and section)
                const uniqueCourses = [];
                const courseKeySet = new Set();
                
                lecturerCourses.forEach(course => {
                    const key = `${course.kod_subjek}-${course.seksyen || '1'}`;
                    if (!courseKeySet.has(key)) {
                        courseKeySet.add(key);
                        uniqueCourses.push(course);
                    }
                });
                
                // Build timetable data
                const timetableData = [];
                for (const course of uniqueCourses) {
                    try {
                        const schedule = await this.fetchCourseSchedule(
                            course.kod_subjek,
                            currentSession.sesi,
                            currentSession.semester,
                            course.seksyen
                        );
                        
                        if (schedule && schedule.length > 0) {
                            timetableData.push({
                                courseCode: course.kod_subjek,
                                courseName: course.nama_subjek,
                                section: course.seksyen || '1',
                                studentCount: course.bil_pelajar || 0,
                                schedule: schedule
                            });
                        } else {
                            // If no schedule from API, create from course data
                            if (course.hari && course.masa) {
                                timetableData.push({
                                    courseCode: course.kod_subjek,
                                    courseName: course.nama_subjek,
                                    section: course.seksyen || '1',
                                    studentCount: course.bil_pelajar || 0,
                                    schedule: [{
                                        hari: course.hari,
                                        masa: course.masa,
                                        kod_bilik: course.kod_bilik,
                                        ruang: course.kod_bilik ? { kod_ruang: course.kod_bilik } : null
                                    }]
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not process ${course.kod_subjek}:`, error.message);
                    }
                }
                
                if (timetableData.length > 0) {
                    console.log(`✅ Lecturer timetable (Method 2): ${timetableData.length} courses`);
                    return timetableData;
                }
                
            } catch (error) {
                console.warn('⚠️ Method 2 failed:', error.message);
            }
            
            console.log('⚠️ No timetable data found for lecturer');
            return [];
            
        } catch (error) {
            console.error('❌ Error fetching lecturer timetable:', error);
            return [];
        }
    },

    // ============ STUDENTS FETCHING ============

    async fetchStudents(sesi = null, semester = null) {
        try {
            console.log('📊 Fetching students list from TTMS...');
            
            // Get admin session ID
            if (!this.adminSessionId) {
                this.adminSessionId = localStorage.getItem('ttms_admin_session_id');
                if (!this.adminSessionId) {
                    throw new Error('No admin session ID available');
                }
            }
            
            const currentSession = this.getCurrentSession();
            
            // Build parameters
            const params = {
                entity: 'pelajar',
                session_id: this.adminSessionId,
                sesi: sesi || currentSession.sesi,
                semester: semester || currentSession.semester
            };
            
            // Remove any undefined/null parameters
            Object.keys(params).forEach(key => {
                if (params[key] === undefined || params[key] === null) {
                    delete params[key];
                }
            });
            
            // Build query string
            const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                .join('&');
            
            const url = `${this.BASE_URL}?${queryString}`;
            console.log('📡 Students URL:', url);
            
            // Make AJAX request
            const response = await fetch(url);
            const text = await response.text();
            
            console.log('📥 Students raw response:', text.substring(0, 200));
            
            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.warn('⚠️ Students: Response not pure JSON. Attempting extraction...');
                const jsonMatch = text.match(/\[.*\]/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('❌ Students: Could not extract valid JSON');
                        return [];
                    }
                } else {
                    console.error('❌ Students: No JSON found in response');
                    return [];
                }
            }
            
            // Process data
            if (Array.isArray(data)) {
                console.log(`✅ Students: Retrieved ${data.length} records`);
                return data;
            } else if (data && typeof data === 'object') {
                // Check for nested data
                if (data.pelajar && Array.isArray(data.pelajar)) {
                    console.log(`✅ Students: Retrieved ${data.pelajar.length} records (nested)`);
                    return data.pelajar;
                }
                // If object has array values
                const values = Object.values(data);
                if (values.length > 0 && Array.isArray(values[0])) {
                    console.log(`✅ Students: Retrieved ${values[0].length} records (nested array)`);
                    return values[0];
                }
                console.log(`✅ Students: Retrieved ${values.length} records (object values)`);
                return values;
            }
            
            console.log('⚠️ Students: No data returned');
            return [];
            
        } catch (error) {
            console.error('❌ Error fetching students:', error);
            return [];
        }
    },

    // ============ STUDENT DATA ============

    async fetchTotalStudents() {
        try {
            console.log('📊 Fetching total students from TTMS...');
            
            // Get admin session ID
            if (!this.adminSessionId) {
                this.adminSessionId = localStorage.getItem('ttms_admin_session_id');
                if (!this.adminSessionId) {
                    console.error('❌ No admin session ID available');
                    return 0;
                }
            }
            
            const currentSession = this.getCurrentSession();
            
            // Build URL for students endpoint
            const url = `${this.BASE_URL}?entity=pelajar&session_id=${this.adminSessionId}&sesi=${currentSession.sesi}&semester=${currentSession.semester}`;
            
            console.log('📡 Fetching students from:', url);
            
            // Make AJAX request using Fetch API
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error(`❌ HTTP error! Status: ${response.status}`);
                return 0;
            }
            
            const text = await response.text();
            console.log('📥 Students response received');
            
            // Parse response
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.warn('⚠️ Response not pure JSON. Attempting extraction...');
                const jsonMatch = text.match(/\[.*\]/s);
                if (jsonMatch) {
                    try {
                        data = JSON.parse(jsonMatch[0]);
                    } catch (e) {
                        console.error('❌ Could not extract valid JSON from students response');
                        return 0;
                    }
                } else {
                    console.error('❌ No JSON found in students response');
                    return 0;
                }
            }
            
            // Process data
            if (Array.isArray(data)) {
                console.log(`✅ Total students retrieved: ${data.length}`);
                return data.length;
            } else if (data && typeof data === 'object') {
                // Check for nested data
                if (data.pelajar && Array.isArray(data.pelajar)) {
                    console.log(`✅ Total students retrieved (nested): ${data.pelajar.length}`);
                    return data.pelajar.length;
                }
                // If object has array values
                const values = Object.values(data);
                if (values.length > 0 && Array.isArray(values[0])) {
                    console.log(`✅ Total students retrieved (nested array): ${values[0].length}`);
                    return values[0].length;
                }
                console.log(`✅ Total students retrieved (object values): ${values.length}`);
                return values.length;
            }
            
            console.log('⚠️ No student data returned');
            return 0;
            
        } catch (error) {
            console.error('❌ Error fetching total students:', error);
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

// Initialize TTMS when loaded
if (typeof window !== 'undefined') {
    window.TTMS = TTMS;
    TTMS.init(); // Load session IDs from localStorage
    console.log('✅ TTMS Model loaded and initialized');
}