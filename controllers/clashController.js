// -----------------------
// CONFIGURATION
// -----------------------
const SESSION = "2025/2026";
const SEMESTER = 1;

// Real subjects + sections (TTMS data)
const SUBJECTS = [
    { code: "SCSM2113", sections: [1,2,3] },
    { code: "SECR3104", sections: [3] },
    { code: "SECV3104", sections: [1] },
    { code: "SCST1143", sections: [1,2,3,4,5] },
    { code: "SCST1123", sections: [3] },
    { code: "UECS6013", sections: [1] },
    { code: "SECD2523", sections: [2,3,4] },
    { code: "SECI1013", sections: [8,9,10]},
    { code: "MCSD6227", sections: [1]},  // Removed extra space
    { code: "SECJ2013", sections: [9]},   // Removed extra space
];

let allRecords = [];
let buildingCount = { N28:0, N28A:0 };
let dayCount = {1:0,2:0,3:0,4:0,5:0}; // ISNIN=1 … JUMAAT=5

// -----------------------
// UTILITY
// -----------------------
function hariText(h) {
    return ["","ISNIN","SELASA","RABU","KHAMIS","JUMAAT"][h] || h;
}
function masaText(m) {
    return {4:"08:00-08:50",5:"09:00-09:50",6:"10:00-10:50"}[m] || m;
}
function buildingFromRoom(room) {
    return room && room.startsWith("N28A") ? "N28A" : "N28";
}

// -----------------------
// FETCH TTMS DATA (DIRECT - NO PROXY)
// -----------------------
async function fetchSchedule(code, section) {
    const url = `http://web.fc.utm.my/ttms/web_man_webservice_json.cgi?entity=jadual_subjek&sesi=${SESSION}&semester=${SEMESTER}&kod_subjek=${code}&seksyen=${section}`;
    
    console.log(`📡 Fetching: ${code} Section ${section}`);
    
    try {
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log(` ${code} Sec ${section}: ${data.length} records`);
        return data;
        
    } catch (error) {
        console.error(` Failed: ${code} Sec ${section}:`, error.message);
        return [];
    }
}

// -----------------------
// LOAD ALL SUBJECTS
// -----------------------
async function loadAllSubjects() {
    allRecords = [];
    buildingCount = { N28:0, N28A:0 };
    dayCount = {1:0,2:0,3:0,4:0,5:0};

    const totalClashesEl = document.getElementById("totalClashes");
    totalClashesEl.innerText = "Loading...";
    
    const tbody = document.querySelector("#clashTable tbody");
    if (tbody) {
        tbody.innerHTML = "<tr><td colspan='8' class='text-center'>🔄 Loading data from TTMS...</td></tr>";
    }

    let successCount = 0;
    let failCount = 0;
    let totalRecords = 0;

    console.log("🚀 Starting to load TTMS data...");
    console.log(`Session: ${SESSION}, Semester: ${SEMESTER}`);

    for(const subj of SUBJECTS){
        for(const sec of subj.sections){
            try {
                const data = await fetchSchedule(subj.code, sec);
                
                if (data && Array.isArray(data) && data.length > 0) {
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
                            totalRecords++;
                        }
                    });
                    successCount++;
                } else {
                    console.warn(`⚠️ No data: ${subj.code} Sec ${sec}`);
                    failCount++;
                }
            } catch (error) {
                console.error(`❌ Error: ${subj.code} Sec ${sec}:`, error);
                failCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log(`\n Summary:`);
    console.log(`   Success: ${successCount}`);
    console.log(`    Failed: ${failCount}`);
    console.log(`    Total Records: ${totalRecords}`);

    if (totalRecords === 0) {
        alert("⚠️ No data loaded!\n\nCheck console (F12) for errors.");
        totalClashesEl.innerText = "0";
        if (tbody) {
            tbody.innerHTML = "<tr><td colspan='8' class='text-center text-danger'>No data loaded. Check console.</td></tr>";
        }
    } else {
        detectClashes();
    }
}

// -----------------------
// DETECT CLASHES
// -----------------------
function detectClashes(){
    const groups = {};
    allRecords.forEach(r => {
        const key = `${r.kod_ruang}_${r.hari}_${r.masa}`;
        if(!groups[key]) groups[key] = [];
        groups[key].push(r);
    });

    const rows = [];
    let totalClashes = 0;
    buildingCount = { N28:0, N28A:0 };
    dayCount = {1:0,2:0,3:0,4:0,5:0};

    Object.values(groups).forEach(group => {
        const clash = group.length > 1;
        if(clash){
            totalClashes++;
            const b = buildingFromRoom(group[0].kod_ruang);
            buildingCount[b]++;
            dayCount[group[0].hari]++;
        }
        group.forEach(r => rows.push({...r, clash}));
    });

    document.getElementById("totalClashes").innerText = totalClashes;
    document.getElementById("n28Clashes").innerText = buildingCount.N28;
    document.getElementById("n28aClashes").innerText = buildingCount.N28A;
    renderTable(rows);
    renderCharts();
}

// -----------------------
// RENDER TABLE
// -----------------------
function renderTable(rows){
    const tbody = document.querySelector("#clashTable tbody");
    
    if (!tbody) {
        console.error("Table body not found!");
        return;
    }
    
    tbody.innerHTML = "";
    let bil = 1;

    rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.className = r.clash ? "table-danger" : "table-success";
        
        const building = buildingFromRoom(r.kod_ruang);
        const buildingBadge = building === "N28" 
            ? '<span class="badge bg-primary me-1">N28</span>' 
            : '<span class="badge bg-warning me-1">N28A</span>';
        
        tr.innerHTML = `
            <td>${bil++}</td>
            <td>${buildingBadge}${r.kod_ruang}</td>
            <td>${r.nama_ruang}</td>
            <td>${hariText(r.hari)}</td>
            <td>${masaText(r.masa)}</td>
            <td>${r.kod_subjek}</td>
            <td>${r.seksyen}</td>
            <td><span class="badge ${r.clash?'bg-danger':'bg-success'}">${r.clash?'CLASH':'OK'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// -----------------------
// APPLY FILTER
// -----------------------
function applyFilter(){ 
    if (allRecords.length > 0) {
        detectClashes(); 
    }
}

// -----------------------
// RENDER GOOGLE CHARTS
// -----------------------
function renderCharts(){
    // Check if chart containers exist
    const barChartContainer = document.getElementById('barChart');
    const pieChartContainer = document.getElementById('pieChart');
    const dayChartContainer = document.getElementById('dayChart');
    
    if (!barChartContainer || !pieChartContainer || !dayChartContainer) {
        console.error("Chart containers not found! Make sure HTML has proper IDs.");
        return;
    }
    
    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(drawAllCharts);

    function drawAllCharts(){
        // Bar Chart
        if (barChartContainer) {
            const barData = google.visualization.arrayToDataTable([
                ['Building','Clashes'],
                ['N28', buildingCount.N28],
                ['N28A', buildingCount.N28A]
            ]);
            const barOptions = {
                title: 'Clash Count by Building', 
                legend: {position: 'none'}, 
                colors: ['#dc3545','#fd7e14'], 
                height: 300,
                backgroundColor: 'transparent',
                chartArea: {width: '80%', height: '70%'}
            };
            const barChart = new google.visualization.ColumnChart(barChartContainer);
            barChart.draw(barData, barOptions);
        }

        // Pie Chart
        if (pieChartContainer) {
            const pieData = google.visualization.arrayToDataTable([
                ['Building','Clashes'],
                ['N28', buildingCount.N28],
                ['N28A', buildingCount.N28A]
            ]);
            const pieOptions = {
                title: 'Clash Distribution by Building', 
                colors: ['#dc3545','#fd7e14'], 
                height: 300,
                backgroundColor: 'transparent',
                chartArea: {width: '80%', height: '70%'}
            };
            const pieChart = new google.visualization.PieChart(pieChartContainer);
            pieChart.draw(pieData, pieOptions);
        }

        // Day Chart
        if (dayChartContainer) {
            const dayData = google.visualization.arrayToDataTable([
                ['Day','Clashes'],
                ['ISNIN', dayCount[1]],
                ['SELASA', dayCount[2]],
                ['RABU', dayCount[3]],
                ['KHAMIS', dayCount[4]],
                ['JUMAAT', dayCount[5]]
            ]);
            const dayOptions = {
                title: 'Clash Count per Day', 
                legend: {position: 'none'}, 
                colors: ['#0d6efd'], 
                height: 300,
                backgroundColor: 'transparent',
                chartArea: {width: '80%', height: '70%'}
            };
            const dayChart = new google.visualization.ColumnChart(dayChartContainer);
            dayChart.draw(dayData, dayOptions);
        }
        
        console.log("✅ Charts rendered successfully");
    }
}

// -----------------------
// INITIALIZATION
// -----------------------

// Single initialization function to avoid conflicts
function initializeClashDetection() {
    console.log("📊 TTMS Clash Detection Initializing...");
    
    // Check if we're on the clash page
    const isClashPage = document.getElementById('totalClashes') || 
                        document.getElementById('barChart') || 
                        document.getElementById('clashTable');
    
    if (!isClashPage) {
        console.log("Not on clash page, skipping initialization");
        return;
    }
    
    // Load Google Charts
    if (typeof google !== 'undefined') {
        google.charts.load('current', { packages: ['corechart'] });
        console.log("Google Charts loaded");
    } else {
        console.error("Google Charts not available");
        return;
    }
    
    // Add a button click handler if button exists
    const loadButton = document.querySelector('button[onclick*="loadAllSubjects"]');
    if (loadButton) {
        loadButton.onclick = loadAllSubjects;
    }
    
    // Auto-load after a delay
    setTimeout(() => {
        if (allRecords.length === 0) {
            console.log("Auto-loading TTMS data...");
            loadAllSubjects();
        }
    }, 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClashDetection);
} else {
    initializeClashDetection();
}

// Make functions available globally
window.loadAllSubjects = loadAllSubjects;
window.detectClashes = detectClashes;
window.renderCharts = renderCharts;
window.initializeClashDetection = initializeClashDetection;

console.log("✅ TTMS Clash Detection loaded");