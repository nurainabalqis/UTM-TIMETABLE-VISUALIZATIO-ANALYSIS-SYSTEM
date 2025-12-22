// controllers/sessionController.js - COMPLETE VERSION
function loadSessions() {
    if (!isAuthenticated()) {
        window.location.href = "views/start.html";
        return;
    }
    
    const user = getCurrentUser();
    console.log(`Loading sessions for ${user.name}`);
    
    // Show loading
    const tbody = $("#sessionBody");
    tbody.html(`
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-success"></div>
                Loading sessions from TTMS...
            </td>
        </tr>
    `);
    
    // Fetch from TTMS
    TTMS.fetchSessions().then(data => {
        tbody.empty();
        
        if (data && data.length > 0) {
            console.log(`Loaded ${data.length} sessions from TTMS`);
            
            // Get current session
            const currentSession = TTMS.getCurrentSession();
            
            // Sort by session (newest first)
            data.sort((a, b) => {
                const aSession = `${a.sesi}-${a.semester}`;
                const bSession = `${b.sesi}-${b.semester}`;
                return bSession.localeCompare(aSession);
            });
            
            data.forEach((s, index) => {
                const isCurrent = s.sesi === currentSession.sesi && 
                                 s.semester.toString() === currentSession.semester;
                
                tbody.append(`
                    <tr class="${isCurrent ? 'table-success' : ''}">
                        <td>
                            <strong>${s.sesi || ''}-${s.semester || ''}</strong>
                            ${isCurrent ? '<span class="badge bg-success ms-2">Current</span>' : ''}
                        </td>
                        <td>${formatDate(s.tarikh_mula) || 'N/A'}</td>
                        <td>${formatDate(s.tarikh_tamat) || 'N/A'}</td>
                        <td>
                            ${isCurrent ? 
                                '<span class="badge bg-primary">Active</span>' : 
                                '<span class="badge bg-secondary">Archived</span>'
                            }
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-success" 
                                    onclick="selectSession('${s.sesi}', '${s.semester}')">
                                <i class="fas fa-calendar-alt"></i> Select
                            </button>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-info" 
                                    onclick="viewSessionCourses('${s.sesi}', '${s.semester}')">
                                <i class="fas fa-list"></i> Courses
                            </button>
                        </td>
                    </tr>
                `);
            });
            
            // Update session count
            $('#totalSessions').text(data.length);
            
        } else {
            tbody.append(`
                <tr>
                    <td colspan="6" class="text-center text-muted py-5">
                        <i class="fas fa-calendar-times fa-2x mb-3"></i>
                        <h6>No sessions found</h6>
                        <p class="small">No session data available from TTMS</p>
                    </td>
                </tr>
            `);
        }
    }).catch(error => {
        console.error("Error loading sessions:", error);
        tbody.html(`
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>Failed to load sessions</h6>
                    <p class="small">${error.message || 'Network error'}</p>
                    <button class="btn btn-sm btn-outline-success mt-2" onclick="loadSessions()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td>
            </tr>
        `);
    });
}

function selectSession(sesi, semester) {
    TTMS.setCurrentSession(sesi, semester);
    showAlert(`Session changed to ${sesi}-${semester}`, 'success');
    
    // Reload course data if on course page
    if (typeof loadCourses === 'function') {
        setTimeout(() => loadCourses(), 500);
    }
    
    // Reload my courses if on my courses page
    if (typeof loadMyCourses === 'function') {
        setTimeout(() => loadMyCourses(), 500);
    }
}

function viewSessionCourses(sesi, semester) {
    // Save session temporarily
    const oldSession = TTMS.getCurrentSession();
    TTMS.setCurrentSession(sesi, semester);
    
    // Show loading and switch to timetable view
    showAlert(`Loading courses for ${sesi}-${semester}...`, 'info');
    
    setTimeout(() => {
        UTM_TVAS.loadView('timetable');
        
        // Restore original session after 2 seconds
        setTimeout(() => {
            TTMS.setCurrentSession(oldSession.sesi, oldSession.semester);
        }, 2000);
    }, 1000);
}