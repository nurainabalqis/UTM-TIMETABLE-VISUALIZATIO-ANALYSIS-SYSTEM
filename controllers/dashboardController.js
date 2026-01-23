// controllers/dashboardController.js
const DashboardController = {
    // Load dashboard data - REAL DATA ONLY
    async loadDashboardData() {
        try {
            console.log('Loading REAL dashboard data from TTMS...');
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                console.error('No user found');
                return null;
            }
            
            // Fetch REAL data from TTMS
            const [courses, sessions, lecturers, rooms] = await Promise.all([
                TTMS.fetchCourses(),
                TTMS.fetchSessions(),
                TTMS.fetchLecturers(),
                TTMS.fetchRooms()
            ]);
            
            // Fetch student courses only if user is a student
            let myCourses = [];
            if (user.role === 'student') {
                myCourses = await TTMS.fetchMyCourses(user.username);
            }
            
            console.log('REAL Data fetched from TTMS:', {
                courses: courses.length,
                sessions: sessions.length,
                lecturers: lecturers.length,
                rooms: rooms.length,
                myCourses: myCourses.length
            });
            
            // Calculate REAL statistics
            const currentSession = TTMS.getCurrentSession();
            
            // Calculate total students from REAL data
            const totalStudents = await TTMS.fetchTotalStudents();
            
            // Filter my courses for current session
            const currentMyCourses = myCourses.filter(c => 
                c.sesi === currentSession.sesi && 
                c.semester.toString() === currentSession.semester
            );
            
            const stats = {
                myCourses: currentMyCourses.length,
                totalCourses: courses.length,
                totalStudents: totalStudents,
                totalSessions: sessions.length,
                totalLecturers: lecturers.length,
                totalRooms: rooms.length,
                roomUtilization: 0,
                currentSession: `${currentSession.sesi}-${currentSession.semester}`,
                dataSource: 'TTMS Live',
                lastUpdated: new Date().toLocaleTimeString()
            };
            
            // Calculate room utilization
            try {
                const roomUtil = await TTMS.fetchRoomUtilization();
                stats.roomUtilization = roomUtil.averageUtilization || 0;
            } catch (e) {
                console.warn('Could not fetch room utilization:', e);
            }
            
            console.log('REAL Dashboard stats:', stats);
            return { stats, user };
            
        } catch (error) {
            console.error('ERROR loading REAL dashboard data:', error);
            
            // Return empty stats on error
            return {
                stats: {
                    myCourses: 0,
                    totalCourses: 0,
                    totalStudents: 0,
                    totalSessions: 0,
                    totalLecturers: 0,
                    totalRooms: 0,
                    roomUtilization: 0,
                    currentSession: '2025/2026-1',
                    dataSource: 'TTMS Error',
                    lastUpdated: 'Error loading data'
                },
                error: error.message
            };
        }
    },

    // Load timetable data - SIMPLIFIED VERSION
    // In dashboardController.js, update the loadTimetableData method:

    async loadTimetableData(user) {
        try {
            console.log('📅 Loading simplified timetable for', user.username);
            
            let timetableData = [];
            const currentSession = TTMS.getCurrentSession();
            
            if (user.role === 'student') {
                // Fetch student's courses
                const courses = await TTMS.fetchMyCourses(user.username);
                
                // Filter current session courses
                const currentCourses = courses.filter(c => 
                    c.sesi === currentSession.sesi && 
                    c.semester.toString() === currentSession.semester
                );
                
                // Get schedule for each course
                for (const course of currentCourses) {
                    try {
                        // Fetch course schedule
                        const schedule = await this.fetchCourseSchedule(
                            course.kod_subjek,
                            currentSession.sesi,
                            currentSession.semester,
                            course.seksyen
                        );
                        
                        // FIX: Ensure schedule has proper format
                        const formattedSchedule = Array.isArray(schedule) ? schedule.map(s => ({
                            hari: s.hari || null,
                            masa: s.masa || null,
                            ruang: s.ruang || { kod_ruang: s.kod_ruang || null },
                            kod_bilik: s.kod_bilik || null
                        })) : [];
                        
                        timetableData.push({
                            courseCode: course.kod_subjek || 'N/A',
                            courseName: course.nama_subjek || 'Unnamed Course',
                            schedule: formattedSchedule
                        });
                        
                    } catch (error) {
                        console.warn(`Could not fetch schedule for ${course.kod_subjek}:`, error);
                    }
                }
                
            } else if (user.role === 'lecturer') {
                // Fetch lecturer's subjects
                const subjects = await TTMS.fetchLecturerSubjects(user.username);
                
                // Filter current session subjects
                const currentSubjects = subjects.filter(s => 
                    s.sesi === currentSession.sesi && 
                    s.semester.toString() === currentSession.semester
                );
                
                // Get schedule for each subject
                for (const subject of currentSubjects) {
                    try {
                        const schedule = await this.fetchCourseSchedule(
                            subject.kod_subjek,
                            currentSession.sesi,
                            currentSession.semester,
                            subject.seksyen
                        );
                        
                        // FIX: Ensure schedule has proper format
                        const formattedSchedule = Array.isArray(schedule) ? schedule.map(s => ({
                            hari: s.hari || null,
                            masa: s.masa || null,
                            ruang: s.ruang || { kod_ruang: s.kod_ruang || null },
                            kod_bilik: s.kod_bilik || null
                        })) : [];
                        
                        timetableData.push({
                            courseCode: subject.kod_subjek || 'N/A',
                            courseName: subject.nama_subjek || 'Unnamed Course',
                            schedule: formattedSchedule
                        });
                        
                    } catch (error) {
                        console.warn(`Could not fetch schedule for ${subject.kod_subjek}:`, error);
                    }
                }
            }
            
            console.log(`✅ Simplified timetable loaded: ${timetableData.length} courses`);
            return timetableData;
            
        } catch (error) {
            console.error('❌ Error loading simplified timetable:', error);
            throw error;
        }
    },

    // Helper to fetch course schedule
    async fetchCourseSchedule(courseCode, sesi, semester, section = null) {
        try {
            console.log(`📅 Fetching schedule for ${courseCode}${section ? ` section ${section}` : ''}`);
            
            // First try jadual_subjek endpoint
            const params = {
                entity: 'jadual_subjek',
                sesi: sesi,
                semester: semester,
                kod_subjek: courseCode
            };
            
            if (section) {
                params.seksyen = section;
            }
            
            let schedule = await TTMS.fetchWithAdminSession('jadual_subjek', params);
            
            // If no data, try alternative approach
            if (!schedule || schedule.length === 0) {
                console.log(`⚠️ No schedule from jadual_subjek, trying alternative...`);
                
                // Get all subjects and filter
                const allSubjects = await TTMS.fetchCourses(sesi, semester);
                const subjectSchedule = allSubjects.filter(s => 
                    s.kod_subjek === courseCode && 
                    (!section || s.seksyen === section)
                );
                
                schedule = subjectSchedule.map(s => ({
                    hari: s.hari,
                    masa: s.masa,
                    kod_bilik: s.kod_bilik,
                    ruang: s.kod_bilik ? { kod_ruang: s.kod_bilik } : null
                }));
            }
            
            console.log(`✅ Schedule for ${courseCode}:`, schedule);
            return schedule;
            
        } catch (error) {
            console.error(`❌ Error fetching schedule for ${courseCode}:`, error);
            return [];
        }
    },
    
    // Initialize charts with REAL data
    async initCharts() {
        console.log('Initializing charts with REAL TTMS data...');
        
        try {
            // Load Google Charts if not already loaded
            if (!window.google || !window.google.charts) {
                console.log('Loading Google Charts...');
                await new Promise((resolve, reject) => {
                    google.charts.load('current', { 
                        packages: ['corechart', 'bar', 'line'] 
                    });
                    google.charts.setOnLoadCallback(resolve);
                    
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('Google Charts load timeout')), 10000);
                });
            }
            
            // Small delay to ensure DOM is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Load all charts with REAL data
            await Promise.all([
                this.drawWorkloadChart(),
                this.drawPeakHoursChart(),
                this.drawRoomWeeklyHoursChart()
            ]);
            
            console.log('Charts initialized with REAL data');
            
        } catch (error) {
            console.error('ERROR initializing charts:', error);
        }
    },

    async getTimetableDataFromCourses(user) {
        try {
            console.log('📅 Trying alternative timetable data source...');
            
            const currentSession = TTMS.getCurrentSession();
            let courses = [];
            
            if (user.role === 'student') {
                courses = await TTMS.fetchMyCourses(user.username);
            } else if (user.role === 'lecturer') {
                // For lecturers, get courses they teach
                const allCourses = await TTMS.fetchCourses();
                courses = allCourses.filter(c => 
                    c.kod_pensyarah === user.username || 
                    c.no_pekerja === user.username
                );
            }
            
            // Filter for current session
            const currentCourses = courses.filter(c => 
                c.sesi === currentSession.sesi && 
                c.semester.toString() === currentSession.semester
            );
            
            // Convert to timetable format
            const timetableData = currentCourses.map(course => ({
                courseCode: course.kod_subjek,
                courseName: course.nama_subjek,
                schedule: [{
                    hari: course.hari,
                    masa: course.masa,
                    kod_bilik: course.kod_bilik,
                    ruang: course.kod_bilik ? { kod_ruang: course.kod_bilik } : null
                }]
            }));
            
            console.log(`✅ Alternative timetable data: ${timetableData.length} courses`);
            return timetableData;
            
        } catch (error) {
            console.error('❌ Error in alternative timetable:', error);
            return [];
        }
    },
    
    // Draw workload chart with REAL data
    async drawWorkloadChart() {
        try {
            console.log('Drawing REAL workload chart...');
            const workloadData = await TTMS.fetchLecturerWorkload();
            const container = document.getElementById('workloadChart');
            
            if (!container) {
                console.warn('Workload chart container not found');
                return;
            }
            
            if (!workloadData || workloadData.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-chart-pie fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No lecturer data available from TTMS</p>
                        <small class="text-muted">TTMS may not have lecturer data for current session</small>
                    </div>
                `;
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = new google.visualization.DataTable();
                data.addColumn('string', 'Lecturer');
                data.addColumn('number', 'Hours');
                data.addColumn({ type: 'string', role: 'tooltip' });
                
                workloadData.forEach(item => {
                    const shortName = item.lecturer.length > 20 ? 
                        item.lecturer.substring(0, 20) + '...' : item.lecturer;
                    data.addRow([
                        shortName,
                        item.hours,
                        `${item.lecturer}\n${item.courseCount} courses\n${item.hours} hours`
                    ]);
                });
                
                const options = {
                    title: 'Top 10 Lecturer Workload (Real TTMS Data)',
                    is3D: false,
                    colors: ['#2E7D32', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '75%' },
                    legend: { position: 'labeled' },
                    pieSliceText: 'value'
                };
                
                const chart = new google.visualization.PieChart(container);
                chart.draw(data, options);
                
                console.log('REAL Workload chart drawn with', workloadData.length, 'lecturers');
            });
            
        } catch (error) {
            console.error('ERROR drawing REAL workload chart:', error);
            const container = document.getElementById('workloadChart');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Could not load workload chart from TTMS
                    </div>
                `;
            }
        }
    },

    
    // Draw room weekly hours chart with REAL data
    async drawRoomWeeklyHoursChart() {
        try {
            console.log('Drawing REAL room weekly hours chart...');
            const roomData = await TTMS.fetchRoomWeeklyHours();
            const container = document.getElementById('roomWeeklyHoursChart');
            
            if (!container) {
                console.warn('Room weekly hours chart container not found');
                return;
            }
            
            if (!roomData || roomData.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-door-open fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No room usage data available from TTMS</p>
                        <small class="text-muted">TTMS may not have room booking data for current session</small>
                    </div>
                `;
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = new google.visualization.DataTable();
                data.addColumn('string', 'Room');
                data.addColumn('number', 'Weekly Hours');
                data.addColumn({ type: 'string', role: 'tooltip' });
                
                roomData.forEach(item => {
                    const shortName = item.roomCode.length > 10 ? 
                        item.roomCode.substring(0, 10) + '...' : item.roomCode;
                    data.addRow([
                        shortName,
                        item.hours,
                        `${item.roomCode}\nType: ${item.roomType}\n${item.courseCount} courses\n${item.hours} hours/week`
                    ]);
                });
                
                const options = {
                    title: 'Top 15 Rooms by Weekly Usage Hours (Real TTMS Data)',
                    colors: ['#1976D2'],
                    backgroundColor: 'transparent',
                    hAxis: { 
                        title: 'Room Code',
                        slantedText: true,
                        slantedTextAngle: 45
                    },
                    vAxis: { 
                        title: 'Weekly Hours',
                        minValue: 0
                    },
                    chartArea: { width: '80%', height: '65%' },
                    legend: { position: 'none' }
                };
                
                const chart = new google.visualization.ColumnChart(container);
                chart.draw(data, options);
                
                console.log('REAL Room weekly hours chart drawn with', roomData.length, 'rooms');
            });
            
        } catch (error) {
            console.error('ERROR drawing REAL room weekly hours chart:', error);
            const container = document.getElementById('roomWeeklyHoursChart');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Could not load room weekly hours chart from TTMS
                    </div>
                `;
            }
        }
    },
    
    // Refresh dashboard with REAL data
    async refreshDashboard() {
        console.log('Refreshing dashboard with REAL TTMS data...');
        
        try {
            // 1. Load stats first
            const data = await this.loadDashboardData();
            
            if (data && data.stats) {
                this.updateStatsUI(data.stats);
            }

            // 2. Initialize analysis controller charts ONCE
            if (window.analysisController) {
                console.log('🎨 Initializing analysis charts...');
                await analysisController.initDashboardCharts();
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Error refreshing dashboard:', error);
        }
    },
    
    // Update stats UI with REAL data
    updateStatsUI(stats) {
        console.log('Updating stats UI with REAL data:', stats);
        
        // This will be handled by Vue's reactivity in the actual implementation
        // For now, we just log it
    }
};

// Make globally available
window.DashboardController = DashboardController;

