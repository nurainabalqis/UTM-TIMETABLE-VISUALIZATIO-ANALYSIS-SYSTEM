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
                //this.loadWeeklyUsageChart(),
                this.loadPeakHoursChart()
            ]);

            await this.loadWeeklyChartChartJS();

            
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
    async loadWeeklyChartChartJS() {
    try {
        console.log('AnalysisController: Drawing WEEKLY chart using Chart.js');

        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            console.warn('No user found');
            return;
        }

        const weekly = await TTMS.fetchWeeklyDistributionForUser(user);
        if (!weekly) {
            console.warn('No weekly distribution data');
            return;
        }

        const canvas = document.getElementById('weeklyChart');
        if (!canvas) {
            console.error('weeklyChart canvas not found');
            return;
        }

        canvas.style.display = 'block';
        
        const oldMsg = canvas.parentElement.querySelector('.no-weekly-msg');
        if (oldMsg) oldMsg.remove();


        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }

        const labels = Object.keys(weekly);
        const morning = labels.map(d => weekly[d].morning);
        const afternoon = labels.map(d => weekly[d].afternoon);
        const evening = labels.map(d => weekly[d].evening);

        this.charts.weekly = new Chart(canvas, {
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

        console.log('AnalysisController: Weekly Chart.js rendered');

    } catch (err) {
        console.error('Error rendering Chart.js weekly chart', err);
    }
}

    
    // Load peak hours chart
    async loadPeakHoursChart() {
    try {
        console.log('📊 Loading Peak Hours chart (role-based)');

        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            console.warn('Peak hours: no user');
            return;
        }

        let peakData = [];
        let title = '';

        // ================= STUDENT =================
        if (user.role === 'student') {
            console.log('👨‍🎓 Peak Study Hours for student');
            peakData = await TTMS.fetchPeakStudyHoursForStudent(user);
            title = 'Peak Study Hours (Student)';
        }

        // ================= LECTURER =================
        else if (user.role === 'lecturer') {
            console.log('👨‍🏫 Peak Teaching Hours for lecturer');
            peakData = await TTMS.fetchPeakTeachingHoursForLecturer(user);
            title = 'Peak Teaching Hours (Lecturer)';
        }

        else {
            console.warn('Peak hours: unsupported role');
            return;
        }

        if (!peakData || peakData.length === 0) {
            console.warn('No peak hours data available');
            return;
        }

        // FIND PEAK DAY + TIME
        const peakSlot = peakData.reduce((max, curr) =>
            curr.count > max.count ? curr : max,
            peakData[0]
        );

        google.charts.setOnLoadCallback(() => {
            const data = new google.visualization.DataTable();
            data.addColumn('string', 'Time');
            data.addColumn('number', 'Count');

            peakData.forEach(item => {
                data.addRow([item.hour, item.count]);
            });

            const options = {
                title,
                curveType: 'function',
                backgroundColor: 'transparent',
                hAxis: { title: 'Time' },
                vAxis: { title: 'Number of Sessions', minValue: 0 },
                chartArea: { width: '85%', height: '70%' },
                colors: [user.role === 'student' ? '#1976D2' : '#D32F2F']
            };

            // 🔔 SHOW PEAK INFO ABOVE CHART
const infoId = 'peakHoursInfo';
let infoBox = document.getElementById(infoId);

if (!infoBox) {
    infoBox = document.createElement('div');
    infoBox.id = infoId;
    infoBox.style.textAlign = 'center';
    infoBox.style.marginBottom = '10px';
    infoBox.style.fontWeight = '600';
    infoBox.style.color = '#444';

    const chartContainer = document.getElementById('peakHoursChart');
    if (chartContainer && chartContainer.parentElement) {
        chartContainer.parentElement.insertBefore(infoBox, chartContainer);
    }
}

infoBox.innerText =
    `Peak time: ${peakSlot.day}, ${peakSlot.hour} (${peakSlot.count} classes)`;

            const container = document.getElementById('peakHoursChart');
            if (!container) {
                console.error('peakHoursChart container not found');
                return;
            }

            const chart = new google.visualization.ColumnChart(container);
            chart.draw(data, options);
            this.charts.peak = chart;
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