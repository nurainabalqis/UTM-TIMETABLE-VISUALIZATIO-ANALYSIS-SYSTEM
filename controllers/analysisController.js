// controllers/analysisController.js
class AnalysisController {
    constructor() {
        this.charts = {};
    }
    
    // Initialize all charts
    async initDashboardCharts() {
        console.log('AnalysisController: Initializing dashboard charts...');
        
        try {
            // Ensure Google Charts is loaded
            if (!window.google || !window.google.charts) {
                console.log('AnalysisController: Loading Google Charts...');
                await new Promise((resolve) => {
                    google.charts.load('current', { packages: ['corechart', 'bar'] });
                    google.charts.setOnLoadCallback(resolve);
                });
            }
            
            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Load charts
            await Promise.all([
                this.loadWorkloadChart(),
                this.loadWeeklyUsageChart(),
                this.loadPeakHoursChart()
            ]);
            
            console.log('AnalysisController: All charts loaded successfully');
        } catch (error) {
            console.error('AnalysisController: Error initializing charts:', error);
        }
    }
    
    // Load workload chart
    async loadWorkloadChart() {
        try {
            const workloadData = await TTMS.fetchLecturerWorkload();
            
            if (workloadData.length === 0) {
                console.warn('No workload data available');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = new google.visualization.DataTable();
                data.addColumn('string', 'Lecturer');
                data.addColumn('number', 'Hours');
                
                workloadData.forEach(item => {
                    data.addRow([item.lecturer, item.hours]);
                });
                
                const options = {
                    title: 'Lecturer Workload Distribution',
                    is3D: false,
                    colors: ['#2E7D32', '#4CAF50', '#81C784', '#A5D6A7'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' }
                };
                
                const container = document.getElementById('workloadChart');
                if (container) {
                    const chart = new google.visualization.PieChart(container);
                    chart.draw(data, options);
                    this.charts.workload = chart;
                }
            });
        } catch (error) {
            console.error('Error loading workload chart:', error);
        }
    }
    
    // Load weekly usage chart
    async loadWeeklyUsageChart() {
        try {
            const weeklyData = await TTMS.fetchWeeklyUsagePattern();
            
            if (!weeklyData) {
                console.warn('No weekly data available');
                return;
            }
            
            google.charts.setOnLoadCallback(() => {
                const data = new google.visualization.DataTable();
                data.addColumn('string', 'Day');
                data.addColumn('number', 'Morning');
                data.addColumn('number', 'Afternoon');
                data.addColumn('number', 'Evening');
                
                weeklyData.days.forEach((day, index) => {
                    data.addRow([
                        day,
                        weeklyData.morning[index],
                        weeklyData.afternoon[index],
                        weeklyData.evening[index]
                    ]);
                });
                
                const options = {
                    title: 'Weekly Session Distribution',
                    colors: ['#FF9800', '#4CAF50', '#2196F3'],
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Day' },
                    vAxis: { title: 'Number of Sessions', minValue: 0 },
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const container = document.getElementById('weeklyChart');
                if (container) {
                    const chart = new google.visualization.ColumnChart(container);
                    chart.draw(data, options);
                    this.charts.weekly = chart;
                }
            });
        } catch (error) {
            console.error('Error loading weekly chart:', error);
        }
    }
    
    // Load peak hours chart
    async loadPeakHoursChart() {
        try {
            const peakData = await TTMS.fetchPeakHoursData();
            
            if (peakData.length === 0) {
                console.warn('No peak hours data available');
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
                    title: 'Peak Teaching Hours',
                    curveType: 'function',
                    colors: ['#D32F2F'],
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Time Slot' },
                    vAxis: { title: 'Number of Sessions', minValue: 0 },
                    chartArea: { width: '85%', height: '70%' }
                };
                
                const container = document.getElementById('peekHoursChart');
                if (container) {
                    const chart = new google.visualization.LineChart(container);
                    chart.draw(data, options);
                    this.charts.peak = chart;
                }
            });
        } catch (error) {
            console.error('Error loading peak hours chart:', error);
        }
    }
    
    // Refresh all charts
    refreshAllCharts() {
        this.charts = {};
        this.initDashboardCharts();
    }
}

// Global instance
window.analysisController = new AnalysisController();

// Auto-initialize when Google Charts is loaded
if (typeof google !== 'undefined' && google.charts) {
    google.charts.load('current', { packages: ['corechart', 'bar'] });
}