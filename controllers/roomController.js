// controllers/roomController.js - UPDATE with chart functions

const RoomController = {
    
    // Draw comprehensive room utilization dashboard
    async drawRoomUtilizationDashboard() {
        try {
            console.log('📊 Drawing room utilization dashboard...');
            
            // Load Google Charts
            if (!window.google || !window.google.charts) {
                await new Promise((resolve) => {
                    google.charts.load('current', { packages: ['corechart', 'bar'] });
                    google.charts.setOnLoadCallback(resolve);
                });
            }
            
            // Fetch analysis data
            const user = AuthController.getCurrentUser();
            if (!user) return;
            
            const analysis = await TTMS.fetchRoomUtilizationAnalysis();
            if (!analysis.analysis || !analysis.charts) {
                console.warn('No room analysis data available');
                return;
            }
            
            // Draw all charts
            await Promise.all([
                this.drawRoomTypeChart(analysis.charts.roomTypeDistribution),
                this.drawUsageLevelChart(analysis.charts.usageLevelDistribution),
                this.drawTopRoomsChart(analysis.charts.topRoomsByUsage),
                this.drawPeakHoursChart(analysis.charts.peakHoursData),
                this.drawCapacityChart(analysis.charts.capacityDistribution)
            ]);
            
            console.log('✅ Room utilization dashboard drawn');
            
        } catch (error) {
            console.error('ERROR drawing room dashboard:', error);
        }
    },
    
    // Draw room type distribution chart
    drawRoomTypeChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('roomTypeChart');
                if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No room type data available</div>';
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Room Type');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.type,
                        item.count,
                        `<div class="chart-tooltip">
                            <strong>${item.type}</strong><br>
                            Count: ${item.count}<br>
                            ${Math.round((item.count / data.reduce((s, i) => s + i.count, 0)) * 100)}% of total
                         </div>`
                    ]);
                });
                
                const options = {
                    title: 'Room Distribution by Type',
                    is3D: false,
                    pieHole: 0.4,
                    colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#8E44AD', '#16A085'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'labeled' },
                    tooltip: { isHtml: true }
                };
                
                const chart = new google.visualization.PieChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw usage level chart
    drawUsageLevelChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('usageLevelChart');
                if (!container || !data) {
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Usage Level');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'style' });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.level,
                        item.count,
                        `color: ${item.color}`
                    ]);
                });
                
                const options = {
                    title: 'Room Utilization Levels',
                    legend: 'none',
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Usage Level' },
                    vAxis: { title: 'Number of Rooms', minValue: 0 },
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw top rooms by usage chart (STACKED BAR CHART like your example)
    drawTopRoomsChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('topRoomsChart');
                if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No room usage data available</div>';
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Room');
                chartData.addColumn('number', 'Subjects');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                chartData.addColumn('number', 'Hours/Week');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                
                data.forEach(room => {
                    const tooltipSubjects = `
                        <div class="tooltip-content">
                            <strong>${room.shortName}</strong><br>
                            Type: ${room.type}<br>
                            Subjects: ${room.subjectCount}<br>
                            Capacity: ${room.capacity}
                        </div>
                    `;
                    
                    const tooltipHours = `
                        <div class="tooltip-content">
                            <strong>${room.shortName}</strong><br>
                            Type: ${room.type}<br>
                            Hours/Week: ${room.usageHours}<br>
                            ${room.usageHours > 20 ? 'High Usage' : room.usageHours > 10 ? 'Medium Usage' : 'Low Usage'}
                        </div>
                    `;
                    
                    chartData.addRow([
                        room.shortName,
                        room.subjectCount,
                        tooltipSubjects,
                        room.usageHours,
                        tooltipHours
                    ]);
                });
                
                const options = {
                    title: 'Top Rooms by Weekly Usage',
                    isStacked: true,
                    legend: { position: 'top', maxLines: 3 },
                    colors: ['#FF69B4', '#457E96'], // Pink and blue like your example
                    backgroundColor: 'transparent',
                    hAxis: {
                        title: 'Room',
                        slantedText: true,
                        slantedTextAngle: 45
                    },
                    vAxis: {
                        title: 'Hours/Week & Subjects',
                        minValue: 0
                    },
                    chartArea: {
                        width: '80%',
                        height: '65%',
                        left: 100,
                        right: 50,
                        top: 60,
                        bottom: 120
                    },
                    bar: { groupWidth: '65%' },
                    tooltip: { isHtml: true },
                    height: 500
                };
                
                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                
                // Add click handler
                google.visualization.events.addListener(chart, 'select', function() {
                    const selection = chart.getSelection();
                    if (selection.length > 0) {
                        const row = selection[0].row;
                        const roomCode = data[row].roomCode;
                        RoomController.viewRoomDetails(roomCode);
                    }
                });
                
                resolve();
            });
        });
    },
    
    // Draw peak hours chart
    drawPeakHoursChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('peakHoursChart');
                if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No peak hours data available</div>';
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Time Slot');
                chartData.addColumn('number', 'Sessions');
                
                data.forEach(item => {
                    chartData.addRow([item.slot, item.count]);
                });
                
                const options = {
                    title: 'Peak Room Usage Hours',
                    curveType: 'function',
                    colors: ['#D32F2F'],
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Time of Day', slantedText: true },
                    vAxis: { title: 'Number of Sessions', minValue: 0 },
                    chartArea: { width: '85%', height: '70%' },
                    pointSize: 5,
                    lineWidth: 3
                };
                
                const chart = new google.visualization.LineChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw capacity distribution chart
    drawCapacityChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('capacityChart');
                if (!container || !data) {
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Capacity Range');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'style' });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.category,
                        item.count,
                        `color: ${item.color}`
                    ]);
                });
                
                const options = {
                    title: 'Room Capacity Distribution',
                    pieHole: 0.4,
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'labeled' }
                };
                
                const chart = new google.visualization.PieChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // View room details
    async viewRoomDetails(roomCode) {
        try {
            const rooms = await TTMS.fetchRooms();
            const room = rooms.find(r => r.kod_ruang === roomCode);
            
            if (room) {
                const schedule = await TTMS.fetchRoomSchedule(roomCode);
                
                // Create modal or show details
                const details = `
                    <div class="room-details">
                        <h4>${room.kod_ruang} - ${room.nama_ruang}</h4>
                        <p><strong>Type:</strong> ${room.jenis || 'N/A'}</p>
                        <p><strong>Faculty:</strong> ${room.kod_fakulti || 'N/A'}</p>
                        <p><strong>Capacity:</strong> ${room.kapasiti || 'N/A'}</p>
                        <p><strong>Scheduled Sessions:</strong> ${schedule.length}</p>
                        
                        ${schedule.length > 0 ? `
                        <h5>Current Schedule:</h5>
                        <ul>
                            ${schedule.slice(0, 5).map(s => `
                                <li>${s.subjek?.kod_subjek || 'Unknown'} - Day ${s.hari}, Time ${s.masa}</li>
                            `).join('')}
                        </ul>
                        ` : '<p>No schedule data available.</p>'}
                    </div>
                `;
                
                // You could show this in a modal or alert
                alert(details);
            }
        } catch (error) {
            console.error('Error viewing room details:', error);
        }
    }
};

// Make globally available
window.RoomController = RoomController;