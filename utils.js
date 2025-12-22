// utils.js - Essential utilities
function getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
}

function isAuthenticated() {
    return getCurrentUser() !== null;
}

function showAlert(message, type = 'info') {
    // Remove any existing alerts
    $('.alert-dismissible').remove();
    
    // Create new alert
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999;">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    $('body').append(alertHtml);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        $('.alert-dismissible').alert('close');
    }, 5000);
}

function logout() {
    localStorage.removeItem("user");
    localStorage.removeItem("currentSession");
    window.location.href = "views/start.html";
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.getCurrentUser = getCurrentUser;
    window.isAuthenticated = isAuthenticated;
    window.showAlert = showAlert;
    window.logout = logout;
}