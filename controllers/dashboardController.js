// controllers/dashboardController.js - UPDATED FOR TTMS SYNC
function loadDashboard() {
    if (!isAuthenticated()) {
        window.location.href = "views/start.html";
        return;
    }
    
    const user = getCurrentUser();
    console.log(`Loading dashboard for ${user.name}`);
    
    // Load real statistics from TTMS
    updateDashboardStats();
    
    // Load real charts data
    loadChartsData();
}

function updateDashboardStats() {
    // Update stats cards with real data
    TTMS.fetchDashboardStats().then(stats => {
        $('#courseCount').text(stats.courseCount);
        $('#sessionCount').text(stats.sessionCount);
        $('#studentCount').text(stats.studentCount);
        $('#currentSession').text(stats.currentSession);
    }).catch(error => {
        console.error("Error updating stats:", error);
        $('#courseCount').text('0');
        $('#sessionCount').text('0');
        $('#studentCount').text('0');
    });
}

function loadChartsData() {
    // Load real data for charts
    loadCourseDistributionChart();
    loadSessionTimelineChart();
    loadRoomUtilizationChart();
}

function loadCourseDistributionChart() {
    TTMS.fetchCourses().then(courses => {
        if (!courses || courses.length === 0) return;
        
        // Group courses by faculty/department
        const deptCount = {};
        courses.forEach(course => {
            const dept = course.kod_subjek ? course.kod_subjek.substring(0, 3) : 'Other';
            deptCount[dept] = (deptCount[dept] || 0) + 1;
        });
        
        // Prepare chart data
        const chartData = [['Department', 'Number of Courses']];
        Object.entries(deptCount).forEach(([dept, count]) => {
            chartData.push([dept, count]);
        });
        
        // Draw chart
        google.charts.setOnLoadCallback(() => {
            const data = google.visualization.arrayToDataTable(chartData);
            const options = {
                title: 'Course Distribution by Department',
                is3D: true,
                colors: ['#2E7D32', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9'],
                backgroundColor: 'transparent'
            };
            
            const chart = new google.visualization.PieChart(document.getElementById('courseChart'));
            chart.draw(data, options);
        });
    });
}

function loadSessionTimelineChart() {
    TTMS.fetchSessions().then(sessions => {
        if (!sessions || sessions.length === 0) return;
        
        // Prepare timeline data
        const chartData = [['Session', 'Start', 'End']];
        sessions.slice(0, 10).forEach(session => {
            chartData.push([
                `${session.sesi}-${session.semester}`,
                new Date(session.tarikh_mula),
                new Date(session.tarikh_tamat)
            ]);
        });
        
        // Draw timeline chart
        google.charts.setOnLoadCallback(() => {
            const data = google.visualization.arrayToDataTable(chartData);
            const options = {
                title: 'Session Timeline',
                colors: ['#1976D2'],
                backgroundColor: 'transparent'
            };
            
            const chart = new google.visualization.Timeline(document.getElementById('timelineChart'));
            chart.draw(data, options);
        });
    });
}

function loadRoomUtilizationChart() {
    TTMS.fetchRooms().then(rooms => {
        if (!rooms || rooms.length === 0) {
            // Use mock data if no room data
            const mockData = [
                ['Room Type', 'Count'],
                ['Lecture Halls', 15],
                ['Labs', 8],
                ['Tutorial Rooms', 12],
                ['Meeting Rooms', 5]
            ];
            
            google.charts.setOnLoadCallback(() => {
                const data = google.visualization.arrayToDataTable(mockData);
                const options = {
                    title: 'Room Distribution',
                    pieHole: 0.4,
                    colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9'],
                    backgroundColor: 'transparent'
                };
                
                const chart = new google.visualization.PieChart(document.getElementById('roomChart'));
                chart.draw(data, options);
            });
            return;
        }
        
        // Process real room data
        const roomTypes = {};
        rooms.forEach(room => {
            const type = room.jenis_bilik || 'Unknown';
            roomTypes[type] = (roomTypes[type] || 0) + 1;
        });
        
        const chartData = [['Room Type', 'Count']];
        Object.entries(roomTypes).forEach(([type, count]) => {
            chartData.push([type, count]);
        });
        
        google.charts.setOnLoadCallback(() => {
            const data = google.visualization.arrayToDataTable(chartData);
            const options = {
                title: 'Room Distribution',
                pieHole: 0.4,
                colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9'],
                backgroundColor: 'transparent'
            };
            
            const chart = new google.visualization.PieChart(document.getElementById('roomChart'));
            chart.draw(data, options);
        });
    });
}

// Initialize when page loads
$(document).ready(function() {
    if ($('#dashboard').length) {
        loadDashboard();
    }
});