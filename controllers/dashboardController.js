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
                //TTMS.fetchLecturers(),
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
                //this.drawWeeklyChart(),
                this.drawPeakHoursChart(),
                this.drawRoomWeeklyHoursChart()
            ]);

            await this.drawWeeklyChartJS();

            
            console.log('Charts initialized with REAL data');
            
        } catch (error) {
            console.error('ERROR initializing charts:', error);
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
    

    //DARDARR
    // Draw weekly usage chart with REAL data
    async drawWeeklyChartJS() {
    try {
        console.log('Drawing WEEKLY chart using Chart.js...');

        
        let canvas = null;
        for (let i = 0; i < 10; i++) {
            canvas = document.getElementById('weeklyChartJS');
            if (canvas) break;
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (!canvas) {
            console.error('weeklyChartJS canvas NEVER appeared in DOM');
            return;
        }

        console.log('Canvas found:', canvas);

        
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            console.warn('No user found for weekly distribution');
            return;
        }

        const weekly = await TTMS.fetchWeeklyDistributionForUser(user);

        if (!weekly) {
            console.warn('No weekly distribution data returned');
            return;
        }


        if (this.weeklyChart) {
            this.weeklyChart.destroy();
        }

        const labels = Object.keys(weekly);
        const morning = labels.map(d => weekly[d].morning);
        const afternoon = labels.map(d => weekly[d].afternoon);
        const evening = labels.map(d => weekly[d].evening);

       
        this.weeklyChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Morning', data: morning, backgroundColor: '#FF9800' },
                    { label: 'Afternoon', data: afternoon, backgroundColor: '#4CAF50' },
                    { label: 'Evening', data: evening, backgroundColor: '#2196F3' }
                ]
            },
            options: {
                responsive: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                }
            }
        });

        console.log('✅ Chart.js weekly chart drawn');

    } catch (err) {
        console.error('❌ ERROR drawing Chart.js weekly chart', err);
    }
},


    
    // Draw peak hours chart with REAL data
    async drawPeakHoursChart() {
        try {
            console.log('Drawing REAL peak hours chart...');
            const peakData = await TTMS.fetchPeakHoursData();
            const container = document.getElementById('peakHoursChart');
            
            if (!container) {
                console.warn('Peak hours chart container not found');
                return;
            }
            
            if (!peakData || peakData.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-chart-line fa-2x text-muted mb-2"></i>
                        <p class="text-muted">No time slot data available from TTMS</p>
                        <small class="text-muted">TTMS may not have time data for current session</small>
                    </div>
                `;
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = new google.visualization.DataTable();
                data.addColumn('string', 'Time Slot');
                data.addColumn('number', 'Session Count');
                
                peakData.forEach(item => {
                    data.addRow([item.slot, item.count]);
                });
                
                const options = {
                    title: 'Peak Teaching Hours (Real TTMS Data)',
                    curveType: 'function',
                    colors: ['#D32F2F'],
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Time Slot', slantedText: true },
                    vAxis: { title: 'Number of Sessions', minValue: 0 },
                    chartArea: { width: '85%', height: '70%' },
                    pointSize: 5,
                    lineWidth: 3
                };
                
                const chart = new google.visualization.LineChart(container);
                chart.draw(data, options);
                
                console.log('REAL Peak hours chart drawn with', peakData.length, 'time slots');
            });
            
        } catch (error) {
            console.error('ERROR drawing REAL peak hours chart:', error);
            const container = document.getElementById('peekHoursChart');
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Could not load peak hours chart from TTMS
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
        
        const data = await this.loadDashboardData();
        
        if (data && data.stats) {
            this.updateStatsUI(data.stats);
        }
        
        // Reinitialize charts
        await this.initCharts();
        
        return data;
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