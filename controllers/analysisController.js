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

        // 🔍 Check if weekly data actually has real activity
        const hasWeeklyActivity = Object.values(weekly).some(day =>
            day.morning > 0 || day.afternoon > 0 || day.evening > 0
        );

        // ❗ STUDENT with NO REAL DATA
        if (user.role === 'student' && !hasWeeklyActivity) {
            const canvas = document.getElementById('weeklyChart');
            if (canvas && canvas.parentElement) {
                canvas.style.display = 'none';

                // remove old message if any
                const oldMsg = canvas.parentElement.querySelector('.no-weekly-msg');
                if (oldMsg) oldMsg.remove();

                const msg = document.createElement('div');
                msg.className = 'no-weekly-msg text-center py-4 text-muted';
                msg.innerHTML = `
                    <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                    No weekly study data available for this student.
                `;

                canvas.parentElement.appendChild(msg);
        }
    return; // ⛔ stop rendering chart
}


        // ❗ Lecturer with NO REAL DATA (fake login or no classes)
        if (user.role === 'lecturer' && !hasWeeklyActivity) {
            const canvas = document.getElementById('weeklyChart');
            if (canvas && canvas.parentElement) {
                canvas.style.display = 'none';

                // remove old message if any
                const oldMsg = canvas.parentElement.querySelector('.no-weekly-msg');
                if (oldMsg) oldMsg.remove();

                const msg = document.createElement('div');
                msg.className = 'no-weekly-msg text-center py-4 text-muted';
                msg.innerHTML = `
                    <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                    No weekly teaching data available for this lecturer.
                `;

            canvas.parentElement.appendChild(msg);
        }
        return; // ⛔ stop rendering chart
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
        if (!user) return;

        const titleEl = document.getElementById('peakHoursTitle');
        const container = document.getElementById('peakHoursChart');

        if (!container) return;

        container.innerHTML = ''; // clear old chart/messages

        let peakData = [];
        let chartTitle = '';

        // ================= STUDENT =================
        if (user.role === 'student') {
            if (titleEl) {
                titleEl.innerHTML = `
                    <i class="fas fa-fire text-warning me-2"></i>
                    Peak Studying Hours
                `;
            }

            peakData = await TTMS.fetchPeakStudyHoursForStudent(user);

            // ❌ NO DATA (fake student)
            if (!Array.isArray(peakData) || peakData.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                        No study information available for this student.
                    </div>
                `;
                return;
            }

            chartTitle = 'Peak Studying Hours (Student)';
        }

        // ================= LECTURER =================
        else if (user.role === 'lecturer') {
            if (titleEl) {
                titleEl.innerHTML = `
                    <i class="fas fa-fire text-warning me-2"></i>
                    Peak Teaching Hours
                `;
            }

            const result = await TTMS.fetchPeakTeachingHoursForLecturer(user);

            // ❌ NO DATA (fake lecturer)
            if (!result || result.status !== 'OK' || !result.hours.length) {
                container.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                        ${result?.message || 'No teaching information available for this lecturer.'}
                    </div>
                `;
                return;
            }

            peakData = result.hours;
            chartTitle = 'Peak Teaching Hours (Lecturer)';
        }

        else return;

        // ================= CHART LOGIC =================

        const maxCount = Math.max(...peakData.map(p => p.count));
        const peakSlots = peakData.filter(p => p.count === maxCount);

        google.charts.setOnLoadCallback(() => {
            const data = new google.visualization.DataTable();
            data.addColumn('string', 'Time');
            data.addColumn('number', 'Count');

            peakData.forEach(item => {
                data.addRow([item.hour, item.count]);
            });

            const options = {
                title: chartTitle,
                backgroundColor: 'transparent',
                width: '100%',
                height: 380,

                chartArea: {
                    left: 60,
                    right: 30,
                    top: 60,
                    bottom: 60,
                    width: '100%',
                    height: '75%'
                },

                hAxis: {
                    title: 'Time',
                    textStyle: { fontSize: 12 }
                },

                vAxis: {
                    title: 'Number of Sessions',
                    minValue: 0,
                    textStyle: { fontSize: 12 }
                },

                legend: { position: 'none' },
                colors: [user.role === 'student' ? '#1976D2' : '#D32F2F']
            };

            // 🔔 Peak info text
            let infoBox = document.getElementById('peakHoursInfo');
            if (!infoBox) {
                infoBox = document.createElement('div');
                infoBox.id = 'peakHoursInfo';
                infoBox.style.textAlign = 'center';
                infoBox.style.marginBottom = '10px';
                infoBox.style.fontWeight = '600';
                infoBox.style.color = '#444';
                container.parentElement.insertBefore(infoBox, container);
            }

            infoBox.innerText =
                `Peak hours: ${peakSlots.map(p => p.hour).join(', ')} (${maxCount} sessions per week)`;

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