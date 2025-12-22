// controllers/courseController.js - COMPLETE VERSION
function loadCourses() {
    if (!isAuthenticated()) {
        window.location.href = "views/start.html";
        return;
    }
    
    const user = getCurrentUser();
    console.log(`Loading courses for ${user.name}`);
    
    // Get current session
    const currentSession = TTMS.getCurrentSession();
    
    // Show loading
    const tbody = $("#courseBody");
    tbody.html(`
        <tr>
            <td colspan="7" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-success"></div>
                Loading courses from TTMS for ${currentSession.sesi}-${currentSession.semester}...
            </td>
        </tr>
    `);
    
    // Fetch from TTMS
    TTMS.fetchCourses().then(data => {
        tbody.empty();
        
        if (data && data.length > 0) {
            console.log(`Loaded ${data.length} courses from TTMS`);
            
            data.forEach((c, index) => {
                tbody.append(`
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${c.kod_subjek || 'N/A'}</strong></td>
                        <td>${c.nama_subjek || 'N/A'}</td>
                        <td><span class="badge bg-info">${c.bil_seksyen || '0'} sections</span></td>
                        <td><span class="badge bg-warning">${c.bil_pensyarah || '0'} lecturers</span></td>
                        <td><span class="badge bg-success">${c.bil_pelajar || '0'} students</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewCourseDetails('${c.kod_subjek}')">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </td>
                    </tr>
                `);
            });
            
            // Update course count
            $('#totalCourses').text(data.length);
            $('#currentSessionInfo').text(`${currentSession.sesi}-${currentSession.semester}`);
            
        } else {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="fas fa-book-open fa-2x mb-3"></i>
                        <h6>No courses found</h6>
                        <p class="small">No courses available for ${currentSession.sesi}-${currentSession.semester}</p>
                    </td>
                </tr>
            `);
        }
    }).catch(error => {
        console.error("Error loading courses:", error);
        tbody.html(`
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>Failed to load courses from TTMS</h6>
                    <p class="small">${error.message || 'Please try again'}</p>
                    <button class="btn btn-sm btn-outline-success mt-2" onclick="loadCourses()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td>
            </tr>
        `);
    });
}

function viewCourseDetails(kod_subjek) {
    console.log("Viewing course details:", kod_subjek);
    
    // Show modal with course details
    TTMS.fetchCourseDetails(kod_subjek).then(data => {
        if (data && data.length > 0) {
            const course = data[0];
            const modalHtml = `
                <div class="modal fade" id="courseModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header bg-success text-white">
                                <h5 class="modal-title">${course.kod_subjek || ''} - ${course.nama_subjek || ''}</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Course Information</h6>
                                        <table class="table table-sm">
                                            <tr><th>Code:</th><td>${course.kod_subjek || 'N/A'}</td></tr>
                                            <tr><th>Name:</th><td>${course.nama_subjek || 'N/A'}</td></tr>
                                            <tr><th>Session:</th><td>${course.sesi || 'N/A'}-${course.semester || 'N/A'}</td></tr>
                                            <tr><th>Sections:</th><td>${course.bil_seksyen || '0'}</td></tr>
                                            <tr><th>Lecturers:</th><td>${course.bil_pensyarah || '0'}</td></tr>
                                            <tr><th>Students:</th><td>${course.bil_pelajar || '0'}</td></tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Sections</h6>
                                        ${course.seksyen_list && course.seksyen_list.length > 0 ? 
                                            `<ul class="list-group">
                                                ${course.seksyen_list.map(sec => 
                                                    `<li class="list-group-item d-flex justify-content-between">
                                                        <span>Section ${sec.seksyen || ''}</span>
                                                        <span class="badge bg-info">${sec.bil_pelajar || '0'} students</span>
                                                    </li>`
                                                ).join('')}
                                            </ul>` :
                                            '<p class="text-muted">No section details available</p>'
                                        }
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-success">View Timetable</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add modal to body and show it
            $('body').append(modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('courseModal'));
            modal.show();
            
            // Remove modal after hidden
            $('#courseModal').on('hidden.bs.modal', function () {
                $(this).remove();
            });
        } else {
            showAlert('No detailed information available for this course', 'warning');
        }
    }).catch(error => {
        console.error("Error fetching course details:", error);
        showAlert('Failed to load course details', 'danger');
    });
}