// controllers/authController.js - OPTIMIZED VERSION
let currentUser = null;

// Helper to show Bootstrap alert messages
function showMessage(elementId, message, type) {
    const el = $("#" + elementId);
    el.html(`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `);
}

function initLogin() {
    console.log("initLogin called");
    
    $("#loginForm").on("submit", function (e) {
        e.preventDefault();
        
        const username = $("#login").val().trim();
        const password = $("#password").val().trim();
        
        console.log("Login attempt:", username);
        
        // Basic validation
        if (!username || !password) {
            showMessage("loginMessage", "Please enter both Matric ID and IC number.", "warning");
            return;
        }
        
        // Show loading state
        const btn = $("#btnLogin");
        btn.prop("disabled", true).html(`
            <span class="spinner-border spinner-border-sm me-2"></span>
            Logging in...
        `);
        
        // Clear any previous messages
        $("#loginMessage").empty();
        
        TTMS.login(username, password)
            .then(response => {
                console.log("Login response:", response);
                
                if (response.status === "success") {
                    // Get role from URL
                    const params = new URLSearchParams(window.location.search);
                    const role = params.get("role") || "student";
                    
                    // Create user object
                    const user = {
                        username: username,
                        name: response.nama,
                        role: role,
                        description: response.description,
                        loginTime: new Date().toISOString()
                    };
                    
                    console.log("User created:", user);
                    
                    // Store in localStorage
                    localStorage.setItem("user", JSON.stringify(user));
                    currentUser = user;
                    
                    // Show success message
                    showMessage("loginMessage", "Login successful! Redirecting...", "success");
                    
                    // Redirect to main app immediately
                    setTimeout(() => {
                        window.location.href = "../index.html";
                    }, 500); // Reduced from 1500ms to 500ms
                    
                } else {
                    showMessage("loginMessage", 
                        response.message || "Invalid credentials. Please try again.", 
                        "danger");
                    btn.prop("disabled", false).html("Login to System");
                }
            })
            .catch(error => {
                console.error("Login catch error:", error);
                showMessage("loginMessage", 
                    "Unable to connect to TTMS server. Please check your connection.", 
                    "danger");
                btn.prop("disabled", false).html("Login to System");
            });
    });
}

// Authentication helpers
function isAuthenticated() {
    const userStr = localStorage.getItem("user");
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

function getCurrentUser() {
    if (!currentUser) {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            currentUser = JSON.parse(userStr);
        }
    }
    return currentUser;
}

function logout() {
    localStorage.removeItem("user");
    currentUser = null;
    window.location.href = "views/start.html";
}

// Optimized room utilization loading
function loadRoomUtilizationFast() {
    console.log("Loading room utilization (optimized)...");
    
    const container = $('#content');
    const currentSession = TTMS.getCurrentSession();
    
    // Show immediate loading state
    container.html(`
        <div class="container-fluid">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="text-success">
                    <i class="fas fa-door-open"></i> Room Utilization
                </h2>
                <div class="badge bg-success fs-6">
                    <i class="fas fa-calendar me-1"></i> ${currentSession.sesi}-${currentSession.semester}
                </div>
            </div>
            
            <!-- Fast loading layout -->
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header bg-success text-white">
                            <h5 class="mb-0"><i class="fas fa-chart-bar"></i> Room Utilization Analysis</h5>
                        </div>
                        <div class="card-body">
                            <div id="roomUtilizationChart" style="height: 400px;">
                                <div class="text-center py-4">
                                    <div class="spinner-border text-success spinner-border-sm"></div>
                                    <p class="mt-2 text-muted">Loading real-time room data from TTMS...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <h5 class="mb-0"><i class="fas fa-info-circle"></i> Quick Stats</h5>
                        </div>
                        <div class="card-body">
                            <div id="quickStats">
                                <div class="text-center py-3">
                                    <div class="spinner-border spinner-border-sm text-info"></div>
                                    <p class="mt-2 small text-muted">Loading statistics...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card mt-3">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="fas fa-filter"></i> Quick Filters</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label small">Building</label>
                                <select class="form-select form-select-sm" id="buildingFilter">
                                    <option value="all">All Buildings</option>
                                    <option value="FK">Faculty of Computing (FK)</option>
                                    <option value="FKE">Faculty of Electrical Engineering (FKE)</option>
                                    <option value="FKM">Faculty of Mechanical Engineering (FKM)</option>
                                </select>
                            </div>
                            <button class="btn btn-sm btn-success w-100" onclick="applyRoomFilters()">
                                <i class="fas fa-sync-alt"></i> Apply Filter
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    // Load data asynchronously
    setTimeout(() => {
        loadRealRoomUtilizationData();
    }, 100); // Reduced delay for faster loading
}

// Load real room utilization data
function loadRealRoomUtilizationData() {
    console.log("Fetching real room data from TTMS...");
    
    // Fetch room data
    TTMS.fetchRooms().then(rooms => {
        if (rooms.length === 0) {
            showNoRoomData();
            return;
        }
        
        // Fetch room utilization stats
        TTMS.fetchRoomUtilizationStats().then(stats => {
            updateRoomUtilizationUI(rooms, stats);
        }).catch(error => {
            console.error("Error fetching room stats:", error);
            updateRoomUtilizationUI(rooms, []);
        });
        
    }).catch(error => {
        console.error("Error fetching rooms:", error);
        showNoRoomData();
    });
}

// Update room utilization UI
function updateRoomUtilizationUI(rooms, stats) {
    console.log(`Updating UI with ${rooms.length} rooms`);
    
    // Update quick stats
    const totalRooms = rooms.length;
    const lectureHalls = rooms.filter(r => r.jenis_bilik && r.jenis_bilik.includes('Dewan')).length;
    const labs = rooms.filter(r => r.jenis_bilik && r.jenis_bilik.includes('Lab')).length;
    
    $('#quickStats').html(`
        <div class="list-group list-group-flush">
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Total Rooms</span>
                <span class="badge bg-primary rounded-pill">${totalRooms}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Lecture Halls</span>
                <span class="badge bg-success rounded-pill">${lectureHalls}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Laboratories</span>
                <span class="badge bg-warning rounded-pill">${labs}</span>
            </div>
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>Tutorial Rooms</span>
                <span class="badge bg-info rounded-pill">${totalRooms - lectureHalls - labs}</span>
            </div>
        </div>
    `);
    
    // Update chart
    if (stats.length > 0) {
        renderRoomUtilizationChart(stats);
    } else {
        renderBasicRoomChart(rooms);
    }
}

// Render room utilization chart
function renderRoomUtilizationChart(stats) {
    google.charts.setOnLoadCallback(() => {
        const chartData = [['Room Type', 'Utilization %']];
        
        stats.forEach(item => {
            chartData.push([item.type, item.utilization || 0]);
        });
        
        const data = google.visualization.arrayToDataTable(chartData);
        const options = {
            title: 'Room Utilization by Type - Real TTMS Data',
            pieHole: 0.4,
            colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9', '#BBDEFB'],
            backgroundColor: 'transparent',
            chartArea: { width: '90%', height: '80%' },
            legend: { position: 'right' }
        };
        
        const chart = new google.visualization.PieChart(
            document.getElementById('roomUtilizationChart')
        );
        chart.draw(data, options);
    });
}

// Render basic room chart if no detailed stats
function renderBasicRoomChart(rooms) {
    google.charts.setOnLoadCallback(() => {
        // Group rooms by type
        const roomTypes = {};
        rooms.forEach(room => {
            const type = room.jenis_bilik || 'Unknown';
            roomTypes[type] = (roomTypes[type] || 0) + 1;
        });
        
        const chartData = [['Room Type', 'Count']];
        Object.entries(roomTypes).forEach(([type, count]) => {
            chartData.push([type, count]);
        });
        
        const data = google.visualization.arrayToDataTable(chartData);
        const options = {
            title: 'Room Distribution by Type - Real TTMS Data',
            pieHole: 0.4,
            colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9'],
            backgroundColor: 'transparent',
            chartArea: { width: '90%', height: '80%' }
        };
        
        const chart = new google.visualization.PieChart(
            document.getElementById('roomUtilizationChart')
        );
        chart.draw(data, options);
    });
}

// Show no data message
function showNoRoomData() {
    $('#roomUtilizationChart').html(`
        <div class="text-center py-5">
            <i class="fas fa-door-closed fa-3x text-muted mb-3"></i>
            <h5 class="text-muted">No Room Data Available</h5>
            <p class="text-muted small">Could not load room data from TTMS</p>
            <button class="btn btn-sm btn-outline-success mt-2" onclick="loadRealRoomUtilizationData()">
                <i class="fas fa-redo"></i> Retry
            </button>
        </div>
    `);
    
    $('#quickStats').html(`
        <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>No Data Available</strong>
            <p class="small mb-0">Unable to fetch room statistics from TTMS</p>
        </div>
    `);
}

// Apply room filters
function applyRoomFilters() {
    const building = $('#buildingFilter').val();
    showAlert(`Filter applied: ${building === 'all' ? 'All Buildings' : building}`, 'info');
    
    // Refresh data with filter
    loadRealRoomUtilizationData();
}

// Auto-initialize on login page
$(document).ready(function() {
    console.log("Document ready, checking for login form...");
    if ($("#loginForm").length > 0) {
        console.log("Login form found, initializing...");
        initLogin();
    }
    
    // Make functions globally available
    if (typeof window !== 'undefined') {
        window.loadRoomUtilizationFast = loadRoomUtilizationFast;
        window.applyRoomFilters = applyRoomFilters;
    }
});