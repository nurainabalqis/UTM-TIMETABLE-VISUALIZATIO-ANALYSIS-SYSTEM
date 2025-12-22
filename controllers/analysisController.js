// controllers/analysisController.js - REAL TTMS DATA ONLY
class AnalysisController {
    constructor() {
        this.charts = {};
    }
    
    // Initialize all charts with real TTMS data
    initDashboardCharts() {
        console.log("Loading real TTMS data for charts...");
        
        // Load each chart with real data
        this.loadRealWorkloadChart();
        this.loadRealRoomUtilizationChart();
        this.loadRealWeeklyUsageChart();
        this.loadRealPeakHoursChart();
        
        // Update stats with real data
        this.updateRealDashboardStats();
    }
    
    // Load real workload chart from TTMS
    loadRealWorkloadChart() {
        TTMS.fetchLecturerWorkload().then(workloadData => {
            if (workloadData.length === 0) {
                this.showNoDataMessage('workloadChart', 'No lecturer workload data available from TTMS');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const chartData = [['Lecturer', 'Teaching Hours']];
                
                workloadData.forEach(item => {
                    chartData.push([item.lecturer, item.hours]);
                });
                
                const data = google.visualization.arrayToDataTable(chartData);
                const options = {
                    title: 'Teaching Workload Distribution - Real TTMS Data',
                    is3D: false,
                    pieSliceText: 'value',
                    colors: ['#2E7D32', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9', '#E8F5E9'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'labeled' }
                };
                
                const chart = new google.visualization.PieChart(
                    document.getElementById('workloadChart')
                );
                chart.draw(data, options);
                this.charts.workload = chart;
                
                console.log(`Loaded workload chart with ${workloadData.length} lecturers from TTMS`);
            });
        }).catch(error => {
            console.error("Failed to load workload chart:", error);
            this.showError('workloadChart', 'Failed to load lecturer data from TTMS');
        });
    }
    
    // Load real room utilization chart from TTMS
    loadRealRoomUtilizationChart() {
        TTMS.fetchRoomUtilizationStats().then(roomData => {
            if (roomData.length === 0) {
                this.showNoDataMessage('roomChart', 'No room utilization data available from TTMS');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const chartData = [['Room Type', 'Utilization %']];
                
                roomData.forEach(item => {
                    chartData.push([item.type, item.utilization]);
                });
                
                const data = google.visualization.arrayToDataTable(chartData);
                const options = {
                    title: 'Room Utilization by Type - Real TTMS Data',
                    pieHole: 0.4,
                    pieSliceText: 'percentage',
                    colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9', '#BBDEFB'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'right' }
                };
                
                const chart = new google.visualization.PieChart(
                    document.getElementById('roomChart')
                );
                chart.draw(data, options);
                this.charts.room = chart;
                
                console.log(`Loaded room chart with ${roomData.length} room types from TTMS`);
            });
        }).catch(error => {
            console.error("Failed to load room chart:", error);
            this.showError('roomChart', 'Failed to load room data from TTMS');
        });
    }
    
    // Load real weekly usage chart from TTMS
    loadRealWeeklyUsageChart() {
        TTMS.fetchWeeklyUsagePattern().then(weeklyData => {
            if (!weeklyData) {
                this.showNoDataMessage('weeklyUsageChart', 'No weekly usage data available from TTMS');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = google.visualization.arrayToDataTable(weeklyData);
                const options = {
                    title: 'Weekly Session Distribution - Real TTMS Data',
                    colors: ['#FF9800', '#4CAF50', '#2196F3'],
                    backgroundColor: 'transparent',
                    hAxis: { 
                        title: 'Day',
                        textStyle: { color: '#333' }
                    },
                    vAxis: { 
                        title: 'Number of Sessions',
                        minValue: 0,
                        textStyle: { color: '#333' }
                    },
                    chartArea: { width: '80%', height: '70%' },
                    legend: { position: 'top' },
                    bar: { groupWidth: '60%' }
                };
                
                const chart = new google.visualization.ColumnChart(
                    document.getElementById('weeklyUsageChart')
                );
                chart.draw(data, options);
                this.charts.weekly = chart;
                
                console.log("Loaded weekly usage chart from TTMS");
            });
        }).catch(error => {
            console.error("Failed to load weekly chart:", error);
            this.showError('weeklyUsageChart', 'Failed to load weekly data from TTMS');
        });
    }
    
    // Load real peak hours chart from TTMS
    loadRealPeakHoursChart() {
        TTMS.fetchPeakHoursData().then(peakData => {
            if (peakData.length === 0) {
                this.showNoDataMessage('peakHoursChart', 'No peak hours data available from TTMS');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const chartData = [['Time Slot', 'Session Count']];
                
                peakData.forEach(item => {
                    chartData.push([item.slot, item.count]);
                });
                
                const data = google.visualization.arrayToDataTable(chartData);
                const options = {
                    title: 'Peak Teaching Hours - Real TTMS Data',
                    curveType: 'function',
                    colors: ['#D32F2F'],
                    backgroundColor: 'transparent',
                    hAxis: { 
                        title: 'Time Slot',
                        textStyle: { color: '#333' }
                    },
                    vAxis: { 
                        title: 'Number of Sessions',
                        minValue: 0,
                        textStyle: { color: '#333' }
                    },
                    chartArea: { width: '85%', height: '70%' },
                    pointSize: 6,
                    lineWidth: 3,
                    legend: { position: 'none' }
                };
                
                const chart = new google.visualization.LineChart(
                    document.getElementById('peakHoursChart')
                );
                chart.draw(data, options);
                this.charts.peak = chart;
                
                console.log(`Loaded peak hours chart with ${peakData.length} time slots from TTMS`);
            });
        }).catch(error => {
            console.error("Failed to load peak hours chart:", error);
            this.showError('peakHoursChart', 'Failed to load peak hours data from TTMS');
        });
    }
    
    // Update dashboard stats with real TTMS data
    updateRealDashboardStats() {
        // Update course count
        TTMS.fetchCourses().then(courses => {
            $('#courseCount').text(courses.length || 0);
        }).catch(() => {
            $('#courseCount').text('0');
        });
        
        // Update session count
        TTMS.fetchSessions().then(sessions => {
            $('#sessionCount').text(sessions.length || 0);
        }).catch(() => {
            $('#sessionCount').text('0');
        });
        
        // Update clash count
        TTMS.fetchClashes().then(clashes => {
            $('#clashCount').text(clashes.length || 0);
        }).catch(() => {
            $('#clashCount').text('0');
        });
        
        // Update room utilization
        TTMS.fetchRoomUtilization().then(utilization => {
            $('#roomUtilization').text(utilization.averageUtilization + '%');
        }).catch(() => {
            $('#roomUtilization').text('0%');
        });
        
        // Update my courses count
        const user = getCurrentUser();
        if (user && user.username) {
            TTMS.fetchMyCourses().then(courses => {
                const currentSession = TTMS.getCurrentSession();
                const currentCourses = courses.filter(course => 
                    course.sesi === currentSession.sesi && 
                    course.semester.toString() === currentSession.semester
                );
                $('#myCourseCount').text(currentCourses.length || 0);
            }).catch(() => {
                $('#myCourseCount').text('0');
            });
        }
    }
    
    // Show no data message
    showNoDataMessage(chartId, message) {
        const element = document.getElementById(chartId);
        if (element) {
            element.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-database fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">${message}</h5>
                    <p class="text-muted small">Try refreshing or check TTMS connection</p>
                </div>
            `;
        }
    }
    
    // Show error message
    showError(chartId, message) {
        const element = document.getElementById(chartId);
        if (element) {
            element.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h5 class="text-danger">Error Loading Chart</h5>
                    <p class="text-muted">${message}</p>
                    <button class="btn btn-sm btn-outline-danger mt-2" onclick="analysisController.refreshChart('${chartId}')">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
    
    // Refresh individual chart
    refreshChart(chartId) {
        switch(chartId) {
            case 'workloadChart':
                this.loadRealWorkloadChart();
                break;
            case 'roomChart':
                this.loadRealRoomUtilizationChart();
                break;
            case 'weeklyUsageChart':
                this.loadRealWeeklyUsageChart();
                break;
            case 'peakHoursChart':
                this.loadRealPeakHoursChart();
                break;
        }
    }
    
    // Refresh all charts
    refreshAllCharts() {
        this.charts = {};
        this.initDashboardCharts();
        showAlert("Refreshed with latest TTMS data", "success");
    }
}

// Global instance
const analysisController = new AnalysisController();

// Initialize when document is ready
$(document).ready(function() {
    // Load Google Charts
    google.charts.load('current', {'packages':['corechart', 'bar']});
    
    // Initialize dashboard when charts are loaded
    google.charts.setOnLoadCallback(function() {
        if (typeof analysisController !== 'undefined') {
            analysisController.initDashboardCharts();
        }
    });
});