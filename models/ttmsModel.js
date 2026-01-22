// models/ttmsModel.js - FIXED VERSION
// Add this near the top of ttmsModel.js, after the TTMS object definition
const MASA_TO_HOUR = {
    1: 7,   // 07:00
    2: 8,   // 08:00
    3: 9,   // 09:00
    4: 10,  // 10:00
    5: 11,  // 11:00
    6: 12,  // 12:00
    7: 13,  // 13:00 (1 PM)
    8: 14,  // 14:00 (2 PM)
    9: 15,  // 15:00 (3 PM)
    10: 16,  // 16:00 (4 PM)
    11: 17,  // 17:00 (5 PM)
    12: 18,  // 18:00 (6 PM)
};

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
  // Restrict rooms to Faculty of Computing buildings only (N28 & N28A)
  const rooms = await this.fetchWithAdminSession('ruang');

  const isFCRoom = (code) => {
    if (!code) return false;
    const k = String(code).trim().toUpperCase();

    // Typical TTMS room codes: N28-101, N28A-202, etc.
    return (
      k.startsWith('N28A') ||
      k.startsWith('N28-') ||
      k.startsWith('N28 ') ||
      k === 'N28' ||
      k.startsWith('N28')
    );
  };

  const filtered = Array.isArray(rooms)
    ? rooms.filter(r => isFCRoom(r.kod_ruang || r.kod_bilik || r.kod || r.ruang))
    : [];

  console.log(`🏫 Rooms filtered to N28/N28A: ${filtered.length}/${Array.isArray(rooms) ? rooms.length : 0}`);
  return filtered;
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
        const currentSession = this.getCurrentSession();

        // Try multiple possible keys used by TTMS
        const tries = [
            { no_pekerja: lecturerId },
            { kod_pensyarah: lecturerId },
            { login_name: lecturerId },
            { no_kp: lecturerId }
        ];

        for (const p of tries) {
            const res = await this.fetchWithAdminSession('pensyarah_subjek', {
                ...p,
                sesi: currentSession.sesi,
                semester: currentSession.semester
            });

            if (Array.isArray(res) && res.length > 0) {
                console.log('✅ fetchLecturerSubjects success with param:', p, 'count:', res.length);
                return res;
            }
        }

        console.warn('⚠️ fetchLecturerSubjects: no subjects found for', lecturerId);
        return [];
    } catch (error) {
        console.error('❌ Error fetching lecturer subjects:', error);
        return [];
    }
},

async fetchSubjectSections(sesi, semester) {
    try {
        return await this.fetchWithAdminSession("subjek_seksyen", { sesi, semester });
    } catch (e) {
        console.error("❌ fetchSubjectSections error:", e);
        return [];
    }
},

async fetchSubjects(sesi, semester) {
    try {
        // entity=subjek tak perlukan session_id
        return await this.fetch('subjek', { sesi, semester });
    } catch (e) {
        console.error("❌ fetchSubjects error:", e);
        return [];
    }
},


async fetchLecturerTimetable(lecturerId, lecturerName = "") {
    try {
        const { sesi, semester } = this.getCurrentSession();

        const norm = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();
        const tokens = norm(lecturerName).split(" ").filter(Boolean);

        const nameMatch = (candidate) => {
            const c = norm(candidate);
            if (!c || tokens.length === 0) return false;
            return tokens.every(t => c.includes(t));
        };

        console.log("📌 fetchLecturerTimetable:", lecturerId, lecturerName, sesi, semester);

        // 1) get all subjects (kod_subjek list)
        const subjects = await this.fetchWithAdminSession("subjek", { sesi, semester });
        if (!Array.isArray(subjects) || subjects.length === 0) return [];

        const timetableEntries = [];

        // 2) for each subject, get lecturer list by section via subjek_pensyarah
        for (const s of subjects) {
            const kod_subjek = s.kod_subjek;
            if (!kod_subjek) continue;

            const lecList = await this.fetchWithAdminSession("subjek_pensyarah", {
                kod_subjek,
                sesi,
                semester
            });

            if (!Array.isArray(lecList) || lecList.length === 0) continue;

            // 3) match lecturer by NAME in field "nama"
            const mySections = lecList.filter(l => nameMatch(l.nama));

            if (mySections.length === 0) continue;

            // 4) fetch jadual_subjek for each matched section
            for (const m of mySections) {
                const seksyen = String(m.seksyen || "").trim();
                if (!seksyen) continue;

                const jadual = await this.fetchWithAdminSession("jadual_subjek", {
                    kod_subjek,
                    seksyen,
                    sesi,
                    semester
                });

                if (Array.isArray(jadual) && jadual.length > 0) {
                    jadual.forEach(j => {
                        timetableEntries.push({
                            ...j,
                            kod_subjek,
                            seksyen,
                            nama_subjek: s.nama_subjek || j.nama_subjek || ""
                        });
                    });
                }
            }
        }

        console.log("✅ Lecturer timetable entries:", timetableEntries.length);
        return timetableEntries;

    } catch (e) {
        console.error("❌ fetchLecturerTimetable error:", e);
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
            const allRooms = await this.fetchRooms();
            const courses = await this.fetchCourses();

            const fcRooms = allRooms.filter(r => {
                const building = this.getBuildingFromRoomCode(r.kod_ruang);
                return building === 'N28' || building === "N28A";
            });

            const roomUsageMap = {};

            // Initialize rooms
            fcRooms.forEach(r => {
                roomUsageMap[r.kod_ruang] = {
                    code: r.kod_ruang,
                    name: r.nama_ruang,
                    building: this.getBuildingFromRoomCode(r.kod_ruang),
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

            // ================= ROOM TYPE DISTRIBUTION BY BUILDING =================
            const roomTypeByBuilding = {
                N28: {},
                N28A: {}
            };

            detailedRooms.forEach(r => {
                if (!r.building) return;

                const building = r.building;
                const type = r.type || 'Unknown';

                if (!roomTypeByBuilding[building][type]) {
                    roomTypeByBuilding[building][type] = 0;
                }

                roomTypeByBuilding[building][type]++;
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
                peakHoursData: [], // optional for now
                roomTypeByBuilding
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

    //ttmsModel.js
 
// ================= PEAK TEACHING HOURS (LECTURER) =================
    async fetchPeakTeachingHoursForLecturer(user) {
    try {
        console.log('📊 Peak Teaching Hours (REAL TTMS ONLY)');
        const { sesi, semester } = this.getCurrentSession();

        const lecturerId = user.username;
        const hourMap = {};

        // 1️⃣ Get lecturer subjects
        const subjects = await this.fetchWithAdminSession('pensyarah_subjek', {
            no_pekerja: lecturerId,
            sesi,
            semester
        });

        if (!Array.isArray(subjects) || subjects.length === 0) {
            return {
                status: 'NO_DATA',
                message: 'No teaching information found for this lecturer.',
                hours: []
            };
        }

        // 2️⃣ Fetch timetable slots
        for (const subject of subjects) {
            if (!subject.kod_subjek || !subject.seksyen) continue;

            const timetable = await this.fetchWithAdminSession('jadual_subjek', {
                kod_subjek: subject.kod_subjek,
                seksyen: subject.seksyen,
                sesi,
                semester
            });

            if (!Array.isArray(timetable)) continue;

            timetable.forEach(slot => {
                let hour = null;

                if (slot.jam) {
                    hour = parseInt(slot.jam.split(':')[0]);
                } else if (slot.masa && MASA_TO_HOUR[slot.masa]) {
                    hour = MASA_TO_HOUR[slot.masa];
                }

                if (!hour) return;

                hourMap[hour] = (hourMap[hour] || 0) + 1;
            });
        }

        const hours = Object.entries(hourMap)
            .map(([hour, count]) => ({
                hour: `${hour}:00`,
                count
            }))
            .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

        if (hours.length === 0) {
            return {
                status: 'NO_DATA',
                message: 'No teaching schedule found for this lecturer.',
                hours: []
            };
        }

        return {
            status: 'OK',
            hours
        };

    } catch (err) {
        console.error('❌ Lecturer peak hours error:', err);
        return {
            status: 'ERROR',
            message: 'Unable to load teaching data at this time.',
            hours: []
        };
    }
},

    // =================  FIXED PEAK STUDY HOURS (STUDENT) =================
    async fetchPeakStudyHoursForStudent(user) {
        try {
            console.log('📊 Fetching REAL peak study hours for student');

            const currentSession = this.getCurrentSession();
            const hourMap = {};

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

                try {
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

                        // Aggregate by HOUR only
                        if (!hourMap[hour]) {
                            hourMap[hour] = { count: 0, days: new Set() };
                        }
                        
                        // Only count once per day per hour
                        const dayHourKey = `${dayName}-${hour}`;
                        if (!hourMap[hour].days.has(dayHourKey)) {
                            hourMap[hour].count++;
                            hourMap[hour].days.add(dayHourKey);
                        }
                    });
                } catch (err) {
                    console.warn(`❌ Error fetching timetable for ${subject.kod_subjek}:`, err);
                    continue;
                }
            }

            console.log('🔥 Student hourMap:', hourMap);

            // 4. Convert to array format for chart
            const result = Object.entries(hourMap)
                .map(([hour, data]) => ({
                    hour: `${hour}:00`,
                    count: data.count
                }))
                .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

            console.log('✅ Peak study hours:', result);

            // 5. Find peak hour and day for display
            if (result.length > 0) {
                let maxCount = 0;
                let peakHour = result[0].hour;
                let peakDay = 'Various days';

                result.forEach(item => {
                    if (item.count > maxCount) {
                        maxCount = item.count;
                        peakHour = item.hour;
                    }
                });

                // Add peak info to result
                result[0].peakDay = peakDay;
                result[0].peakHour = peakHour;
                result[0].peakCount = maxCount;
            }

            return result;

        } catch (err) {
            console.error('❌ Error fetching peak study hours:', err);
            return [];
        }
    },

    async fetchAvailableStudySpaces({ day = '', timeBlock = '', roomType = '' }) {
        const MASA_TO_HOUR = {
            1: 7, 2: 8, 3: 9, 4: 10, 5: 11,
            6: 12, 7: 13, 8: 14, 9: 15, 10: 16
        };

        const { sesi, semester } = this.getCurrentSession();

        // 1. Get all rooms
        const allRooms = await this.fetchRooms();

        // 2. Filter to N28 & N28A only
        const fcRooms = allRooms.filter(r => {
            const building = this.getBuildingFromRoomCode(r.kod_ruang);
            return building === 'N28' || building === 'N28A';
        });

        // 3. Filter by room type (if selected)
        const filteredRooms = roomType
            ? fcRooms.filter(r => {
            const jenis = (r.jenis || '').toLowerCase();

            if (roomType === 'others') {
                return !jenis;
            }

            return jenis.includes(roomType);
        })
        : fcRooms;

        const availableRooms = [];

        // 4. Check schedule for each room
        for (const room of filteredRooms) {

            let schedule = await this.fetchWithAdminSession('jadual_ruang', {
                kod_ruang: room.kod_ruang,
                sesi,
                semester
            });

            // If no schedule → available all day
            if (!Array.isArray(schedule) || schedule.length === 0) {
                availableRooms.push(room);
                continue;
            }

            // FILTER BY DAY
            if (day) {
                schedule = schedule.filter(s => String(s.hari) === String(day));
            }

            // Check conflict by time block
            const hasConflict = timeBlock
                ? schedule.some(slot => {
                    const hour = slot.masa ? MASA_TO_HOUR[slot.masa] : null;
                    if (!hour) return false;

                    if (timeBlock === 'morning') return hour >= 8 && hour < 12;
                    if (timeBlock === 'afternoon') return hour >= 12 && hour < 18;
                    if (timeBlock === 'evening') return hour >= 18;

                    return false;
                })
                : false; // ✅ no conflict when "Any Time"

            if (!hasConflict) {
                availableRooms.push(room);
            }
        }

        return availableRooms;
    },

    // ============ HELPER FUNCTIONS ============
// Building derivation from room code
getBuildingFromRoomCode(kod_ruang) {
    if (!kod_ruang) return null;

    if (kod_ruang.startsWith('N28A')) return 'N28A';
    if (kod_ruang.startsWith('N28')) return 'N28';

    return null;
},

// Convert TTMS day number to English day name
getDayNameFromHari(dayNumber) {
    if (!dayNumber) return null;
    
    const dayNum = parseInt(dayNumber);
    const dayMap = {
        2: 'Monday',    // 2 = Isnin
        3: 'Tuesday',   // 3 = Selasa
        4: 'Wednesday', // 4 = Rabu
        5: 'Thursday',  // 5 = Khamis
        6: 'Friday'     // 6 = Jumaat
        // Skip 1 = Ahad (Sunday), 7 = Sabtu (Saturday)
    };
    
    return dayMap[dayNum] || null;
},

// Convert masa/jam to time block (morning, afternoon, evening)
getTimeBlockFromMasaJam(masa, jam) {
    let hour = 0;
    
    // Try jam first
    if (jam) {
        hour = parseInt(jam.split(':')[0]);
    } 
    // Then masa
    else if (masa) {
        const slot = parseInt(masa);
        const slotToHour = {
            1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 
            6: 12, 7: 13, 8: 14, 9: 15, 10: 16
        };
        hour = slotToHour[slot] || 0;
    }
    
    // Determine time block
    if (hour >= 8 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 14) return 'afternoon';
    if (hour >= 15 && hour <= 18) return 'evening';
    
    return null;
},

// Parse TTMS response
parseTTMSResponse(text, entity) {
    try {
        // Try to parse as JSON first
        const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            
            if (Array.isArray(data)) {
                return data;
            } else if (data && typeof data === 'object') {
                // Check for nested data
                if (data[entity] && Array.isArray(data[entity])) {
                    return data[entity];
                }
                // If object has array values
                const values = Object.values(data);
                if (values.length > 0 && Array.isArray(values[0])) {
                    return values[0];
                }
                return values;
            }
        }
        return [];
    } catch (error) {
        console.error(`Error parsing TTMS response for ${entity}:`, error);
        return [];
    }
},

    async fetchWeeklyDistributionForUser(user) {
    try {
        console.log('📊 REAL Weekly Distribution (TTMS only)');

        const { sesi, semester } = this.getCurrentSession();

        // Final structure (Monday–Friday only)
        const weekly = {
            Monday:    { morning: 0, afternoon: 0, evening: 0 },
            Tuesday:   { morning: 0, afternoon: 0, evening: 0 },
            Wednesday: { morning: 0, afternoon: 0, evening: 0 },
            Thursday:  { morning: 0, afternoon: 0, evening: 0 },
            Friday:    { morning: 0, afternoon: 0, evening: 0 }
        };

        let relevantSubjects = [];

        /* =======================
           1️⃣ GET USER SUBJECTS
           ======================= */

        if (user.role === 'student') {
            // Student → pelajar_subjek
            relevantSubjects = await this.fetchWithAdminSession('pelajar_subjek', {
                no_matrik: user.username,
                sesi,
                semester
            });

        } else if (user.role === 'lecturer') {
            // Lecturer → pensyarah_subjek
            relevantSubjects = await this.fetchWithAdminSession('pensyarah_subjek', {
                no_pekerja: user.username,
                sesi,
                semester
            });

        } else {
            console.warn('⚠️ Weekly distribution: unsupported role');
            return weekly;
        }

        if (!Array.isArray(relevantSubjects) || relevantSubjects.length === 0) {
            console.warn('⚠️ No subjects found → empty weekly distribution');
            return weekly;
        }

        /* ==========================
           2️⃣ FETCH ALL TIMETABLES
           ========================== */

        for (const subject of relevantSubjects) {
            if (!subject.kod_subjek || !subject.seksyen) continue;

            const timetable = await this.fetchWithAdminSession('jadual_subjek', {
                kod_subjek: subject.kod_subjek,
                seksyen: subject.seksyen,
                sesi,
                semester
            });

            if (!Array.isArray(timetable)) continue;

            /* ==========================
               3️⃣ PROCESS TIME SLOTS
               ========================== */

            timetable.forEach(slot => {
                const day = this.getDayNameFromHari(slot.hari);
                const block = this.getTimeBlockFromMasaJam(slot.masa, slot.jam);

                if (!weekly[day] || !block) return;

                weekly[day][block]++;
            });
        }

        console.log('✅ Weekly distribution computed:', weekly);
        return weekly;

    } catch (error) {
        console.error('❌ Weekly distribution error:', error);

        // SAFE fallback → zeros only (never fake data)
        return {
            Monday:    { morning: 0, afternoon: 0, evening: 0 },
            Tuesday:   { morning: 0, afternoon: 0, evening: 0 },
            Wednesday: { morning: 0, afternoon: 0, evening: 0 },
            Thursday:  { morning: 0, afternoon: 0, evening: 0 },
            Friday:    { morning: 0, afternoon: 0, evening: 0 }
        };
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

