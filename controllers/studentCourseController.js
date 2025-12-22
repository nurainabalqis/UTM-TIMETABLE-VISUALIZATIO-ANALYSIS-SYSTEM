// controllers/studentCourseController.js
function loadMyCourses() {
    if (!isAuthenticated()) {
        window.location.href = "views/start.html";
        return;
    }
    
    const user = getCurrentUser();
    console.log(`Loading registered courses for ${user.name} (${user.username})`);
    
    // Show loading
    const tbody = $("#myCoursesBody");
    tbody.html(`
        <tr>
            <td colspan="7" class="text-center py-4">
                <div class="spinner-border spinner-border-sm text-success"></div>
                Loading your registered courses...
            </td>
        </tr>
    `);
    
    // Get current session for filtering
    const currentSession = TTMS.getCurrentSession();
    const currentSesi = currentSession.sesi;
    const currentSemester = currentSession.semester.toString();
    
    // Fetch courses from TTMS
    TTMS.fetchMyCourses().then(courses => {
        tbody.empty();
        
        if (courses && courses.length > 0) {
            console.log(`Loaded ${courses.length} registered courses`);
            
            // Filter for current session if needed
            const currentCourses = courses.filter(course => 
                course.sesi === currentSesi && 
                course.semester.toString() === currentSemester
            );
            
            const displayCourses = currentCourses.length > 0 ? currentCourses : courses;
            
            if (displayCourses.length === 0) {
                tbody.append(`
                    <tr>
                        <td colspan="7" class="text-center text-muted py-4">
                            <i class="fas fa-calendar-times fa-2x mb-3"></i>
                            <h6>No courses registered for current session</h6>
                            <p class="small">Try changing the session filter</p>
                        </td>
                    </tr>
                `);
                return;
            }
            
            // Display courses
            displayCourses.forEach((course, index) => {
                const isCurrentSession = course.sesi === currentSesi && 
                                       course.semester.toString() === currentSemester;
                
                tbody.append(`
                    <tr class="${isCurrentSession ? 'table-success' : ''}">
                        <td>${index + 1}</td>
                        <td>
                            <strong>${course.kod_subjek || 'N/A'}</strong>
                            ${isCurrentSession ? '<span class="badge bg-success ms-1">Current</span>' : ''}
                        </td>
                        <td>${course.nama_subjek || 'N/A'}</td>
                        <td>
                            <span class="badge bg-info">Section ${course.seksyen || 'N/A'}</span>
                        </td>
                        <td>${course.sesi || 'N/A'}-${course.semester || 'N/A'}</td>
                        <td>${course.tahun_kursus || 'N/A'}</td>
                        <td>
                            <span class="badge ${course.status === 'UM' ? 'bg-success' : 'bg-secondary'}">
                                ${course.status || 'Registered'}
                            </span>
                        </td>
                    </tr>
                `);
            });
            
            // Update summary
            $('#totalMyCourses').text(displayCourses.length);
            $('#currentSessionCourses').text(
                displayCourses.filter(c => 
                    c.sesi === currentSesi && 
                    c.semester.toString() === currentSemester
                ).length
            );
            
        } else {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-5">
                        <i class="fas fa-book-open fa-3x mb-3"></i>
                        <h6>No registered courses found</h6>
                        <p class="small">You are not registered for any courses yet.</p>
                    </td>
                </tr>
            `);
            $('#totalMyCourses').text('0');
            $('#currentSessionCourses').text('0');
        }
    }).catch(error => {
        console.error("Error loading student courses:", error);
        tbody.html(`
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h6>Failed to load registered courses</h6>
                    <p class="small">${error.message || 'Please try again'}</p>
                    <button class="btn btn-sm btn-outline-success mt-2" onclick="loadMyCourses()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </td>
            </tr>
        `);
    });
}

// Export functions if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadMyCourses };
}

// Add to controllers/studentCourseController.js
function exportMyCourses() {
    const user = getCurrentUser();
    const currentSession = TTMS.getCurrentSession();
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "My Registered Courses\n";
    csvContent += `Student: ${user.name}, Matric: ${user.username}\n`;
    csvContent += `Session: ${currentSession.sesi}-${currentSession.semester}\n\n`;
    csvContent += "No,Course Code,Course Name,Section,Session,Year,Status\n";
    
    // Get table data
    $("#myCoursesBody tr").each(function(index) {
        const cols = $(this).find("td");
        if (cols.length >= 7) {
            const row = [
                index + 1,
                $(cols[1]).text().replace('Current', '').trim(),
                $(cols[2]).text(),
                $(cols[3]).text().replace('Section ', ''),
                $(cols[4]).text(),
                $(cols[5]).text(),
                $(cols[6]).text()
            ].join(",");
            csvContent += row + "\n";
        }
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `my_courses_${user.username}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert("Courses exported successfully!", "success");
}

function printMyCourses() {
    const printContent = document.getElementById("content").innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>My Registered Courses - ${getCurrentUser().name}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print {
                    .no-print { display: none !important; }
                    body { font-size: 12pt; }
                    .badge { border: 1px solid #000; }
                }
            </style>
        </head>
        <body>
            ${printContent}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.location.reload();
                    }, 500);
                };
            <\/script>
        </body>
        </html>
    `;
}

// Helper function to show alerts
function showAlert(message, type = 'info') {
    // Remove existing alerts
    $('.alert-dismissible').remove();
    
    // Create new alert
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    $('body').append(alertHtml);
}