// components/clashComponent.js
const ClashComponent = {
    template: `
        <div class="clash-detection-container">
            <!-- Page Header -->
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="text-dark mb-1">
                        <i class="fas fa-exclamation-triangle text-warning me-2"></i>Clash Detection
                    </h2>
                    <p class="text-muted mb-0">
                        Detect and resolve scheduling conflicts in timetables
                    </p>
                </div>
                <div class="badge bg-warning fs-6">
                    <i class="fas fa-calendar me-1"></i> {{ currentSession.sesi }}-{{ currentSession.semester }}
                </div>
            </div>
            
            <!-- Dashboard Cards -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card text-white bg-danger">
                        <div class="card-body text-center py-4">
                            <h5 class="card-title">Total Clashes</h5>
                            <h2 class="mb-0">{{ totalClashes }}</h2>
                            <small>Overall conflicts detected</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-primary">
                        <div class="card-body text-center py-4">
                            <h5 class="card-title">N28 Clashes</h5>
                            <h2 class="mb-0">{{ buildingCount.N28 }}</h2>
                            <small>Building N28 conflicts</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-white bg-warning">
                        <div class="card-body text-center py-4">
                            <h5 class="card-title">N28A Clashes</h5>
                            <h2 class="mb-0">{{ buildingCount.N28A }}</h2>
                            <small>Building N28A conflicts</small>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Control Panel -->
            <div class="card mb-4">
                <div class="card-header bg-warning text-dark">
                    <h5 class="mb-0">
                        <i class="fas fa-cogs me-2"></i>Clash Detection Controls
                    </h5>
                </div>
                <div class="card-body">
                    <div class="row align-items-center">
                        <div class="col-md-8">
                            <p class="mb-0">
                                Analyze TTMS timetable data to detect room scheduling conflicts.
                                <span class="badge bg-danger ms-1">Time Clashes</span>
                                <span class="badge bg-warning ms-1">Room Overlaps</span>
                            </p>
                        </div>
                        <div class="col-md-4 text-end">
                            <button class="btn btn-warning" @click="loadData" :disabled="loading">
                                <i class="fas fa-sync-alt me-1" :class="{'fa-spin': loading}"></i>
                                {{ loading ? 'Loading...' : 'Load TTMS Data' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Charts Section -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="chart-container">
                        <h5 class="mb-3">
                            <i class="fas fa-chart-bar me-2"></i>
                            Clash Count by Building
                        </h5>
                        <div ref="barChart" style="height: 300px;"></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="chart-container">
                        <h5 class="mb-3">
                            <i class="fas fa-chart-pie me-2"></i>
                            Clash Distribution by Building
                        </h5>
                        <div ref="pieChart" style="height: 300px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Day Chart -->
            <div class="row mb-4">
                <div class="col-md-12">
                    <div class="chart-container">
                        <h5 class="mb-3">
                            <i class="fas fa-calendar-day me-2"></i>
                            Clash Count per Day
                        </h5>
                        <div ref="dayChart" style="height: 300px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Data Table -->
            <div class="card">
                <div class="card-header bg-dark text-white">
                    <h5 class="mb-0">
                        <i class="fas fa-table me-2"></i>
                        Detailed Schedule Records
                    </h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead class="table-dark">
                                <tr>
                                    <th>No.</th>
                                    <th>Room Code</th>
                                    <th>Room Name</th>
                                    <th>Day</th>
                                    <th>Time</th>
                                    <th>Subject</th>
                                    <th>Section</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="loading">
                                    <td colspan="8" class="text-center py-4">
                                        <div class="spinner-border text-warning" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <p class="mt-2 mb-0">Loading data from TTMS...</p>
                                    </td>
                                </tr>
                                <tr v-else-if="records.length === 0">
                                    <td colspan="8" class="text-center py-4">
                                        <i class="fas fa-database fa-2x text-muted mb-3"></i>
                                        <p>No data loaded. Click "Load TTMS Data" to start.</p>
                                    </td>
                                </tr>
                                <tr v-else v-for="(record, index) in records" :key="index" 
                                    :class="{'table-danger': record.clash, 'table-success': !record.clash}">
                                    <td>{{ index + 1 }}</td>
                                    <td>
                                        <span class="badge" :class="getBuildingBadgeClass(record.kod_ruang)">
                                            {{ record.kod_ruang }}
                                        </span>
                                    </td>
                                    <td>{{ record.nama_ruang || 'N/A' }}</td>
                                    <td>{{ hariText(record.hari) }}</td>
                                    <td>{{ masaText(record.masa) }}</td>
                                    <td>{{ record.kod_subjek }}</td>
                                    <td>{{ record.seksyen }}</td>
                                    <td>
                                        <span class="badge" :class="record.clash ? 'bg-danger' : 'bg-success'">
                                            {{ record.clash ? 'CLASH' : 'OK' }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    
    data() {
        return {
            SESSION: "2025/2026",
            SEMESTER: 1,
            SUBJECTS: [
                { code: "SCSM2113", sections: [1,2,3] },
                { code: "SECR3104", sections: [3] },
                { code: "SECV3104", sections: [1] },
                { code: "SCST1143", sections: [1,2,3,4,5] },
                { code: "SCST1123", sections: [3] },
                { code: "UECS6013", sections: [1] },
                { code: "SECD2523", sections: [2,3,4] },
                { code: "SECI1013", sections: [8,9,10]},
                { code: "MCSD6227", sections: [1]},
                { code: "SECJ2013", sections: [9]},
            ],
            records: [],
            buildingCount: { N28: 0, N28A: 0 },
            dayCount: {1:0,2:0,3:0,4:0,5:0},
            totalClashes: 0,
            loading: false,
            chartsInitialized: false,
            currentSession: { sesi: '2025/2026', semester: '1' }
        };
    },
    
    methods: {
        hariText(h) {
            return ["","ISNIN","SELASA","RABU","KHAMIS","JUMAAT"][h] || h;
        },
        
        masaText(m) {
            return {4:"08:00-08:50",5:"09:00-09:50",6:"10:00-10:50"}[m] || m;
        },
        
        getBuildingBadgeClass(room) {
            if (!room) return 'bg-secondary';
            return room.startsWith("N28A") ? 'bg-warning' : 'bg-primary';
        },
        
        async fetchSchedule(code, section) {
            const url = `http://web.fc.utm.my/ttms/web_man_webservice_json.cgi?entity=jadual_subjek&sesi=${this.SESSION}&semester=${this.SEMESTER}&kod_subjek=${code}&seksyen=${section}`;
            
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return await res.json();
            } catch (error) {
                console.error(`Failed: ${code} Sec ${section}:`, error);
                return [];
            }
        },
        
        async loadData() {
            this.loading = true;
            this.records = [];
            this.buildingCount = { N28: 0, N28A: 0 };
            this.dayCount = {1:0,2:0,3:0,4:0,5:0};
            this.totalClashes = 0;
            
            let allRecords = [];
            
            // Fetch all data
            for(const subj of this.SUBJECTS){
                for(const sec of subj.sections){
                    try {
                        const data = await this.fetchSchedule(subj.code, sec);
                        if (data && Array.isArray(data)) {
                            data.forEach(d => {
                                if (d.ruang && d.ruang.kod_ruang) {
                                    allRecords.push({
                                        kod_subjek: d.kod_subjek,
                                        seksyen: d.seksyen,
                                        hari: d.hari,
                                        masa: d.masa,
                                        kod_ruang: d.ruang.kod_ruang,
                                        nama_ruang: d.ruang.nama_ruang
                                    });
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error: ${subj.code} Sec ${sec}:`, error);
                    }
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            // Detect clashes
            this.detectClashes(allRecords);
            this.loading = false;
            
            // Draw charts
            this.$nextTick(() => {
                this.drawCharts();
            });
        },
        
        detectClashes(allRecords) {
            const groups = {};
            allRecords.forEach(r => {
                const key = `${r.kod_ruang}_${r.hari}_${r.masa}`;
                if(!groups[key]) groups[key] = [];
                groups[key].push(r);
            });
            
            const rows = [];
            this.buildingCount = { N28:0, N28A:0 };
            this.dayCount = {1:0,2:0,3:0,4:0,5:0};
            this.totalClashes = 0;
            
            Object.values(groups).forEach(group => {
                const clash = group.length > 1;
                if(clash){
                    this.totalClashes++;
                    const b = group[0].kod_ruang.startsWith("N28A") ? "N28A" : "N28";
                    this.buildingCount[b]++;
                    this.dayCount[group[0].hari]++;
                }
                group.forEach(r => rows.push({...r, clash}));
            });
            
            this.records = rows;
        },
        
        drawCharts() {
            // Check if Google Charts is loaded
            if (typeof google === 'undefined' || typeof google.visualization === 'undefined') {
                console.error("Google Charts not loaded yet");
                setTimeout(() => this.drawCharts(), 500); // Retry after 500ms
                return;
            }
            
            // Bar Chart
            if (this.$refs.barChart) {
                const barData = google.visualization.arrayToDataTable([
                    ['Building','Clashes'],
                    ['N28', this.buildingCount.N28],
                    ['N28A', this.buildingCount.N28A]
                ]);
                
                const barOptions = {
                    title: 'Clash Count by Building',
                    legend: { position: 'none' },
                    colors: ['#dc3545','#fd7e14'],
                    height: 300,
                    backgroundColor: 'transparent',
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const barChart = new google.visualization.ColumnChart(this.$refs.barChart);
                barChart.draw(barData, barOptions);
            }
            
            // Pie Chart
            if (this.$refs.pieChart) {
                const pieData = google.visualization.arrayToDataTable([
                    ['Building','Clashes'],
                    ['N28', this.buildingCount.N28],
                    ['N28A', this.buildingCount.N28A]
                ]);
                
                const pieOptions = {
                    title: 'Clash Distribution by Building',
                    colors: ['#dc3545','#fd7e14'],
                    height: 300,
                    backgroundColor: 'transparent',
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const pieChart = new google.visualization.PieChart(this.$refs.pieChart);
                pieChart.draw(pieData, pieOptions);
            }
            
            // Day Chart
            if (this.$refs.dayChart) {
                const dayData = google.visualization.arrayToDataTable([
                    ['Day','Clashes'],
                    ['ISNIN', this.dayCount[1]],
                    ['SELASA', this.dayCount[2]],
                    ['RABU', this.dayCount[3]],
                    ['KHAMIS', this.dayCount[4]],
                    ['JUMAAT', this.dayCount[5]]
                ]);
                
                const dayOptions = {
                    title: 'Clash Count per Day',
                    legend: { position: 'none' },
                    colors: ['#0d6efd'],
                    height: 300,
                    backgroundColor: 'transparent',
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const dayChart = new google.visualization.ColumnChart(this.$refs.dayChart);
                dayChart.draw(dayData, dayOptions);
            }
            
            console.log("✅ Charts drawn successfully");
        },
        
        initializeGoogleCharts() {
            if (typeof google === 'undefined') {
                console.error("Google Charts script not loaded");
                return;
            }
            
            // Load charts package
            google.charts.load('current', { packages: ['corechart'] });
            
            // Set callback for when charts are loaded
            google.charts.setOnLoadCallback(() => {
                this.chartsInitialized = true;
                console.log("✅ Google Charts initialized");
            });
        }
    },
    
    mounted() {
        // Load current session from parent
        if (this.$parent && this.$parent.currentSession) {
            this.currentSession = this.$parent.currentSession;
        }
        
        // Initialize Google Charts
        this.initializeGoogleCharts();
        
        // Auto-load data after a short delay
        setTimeout(() => {
            if (this.records.length === 0) {
                this.loadData();
            }
        }, 1500);
    }
};