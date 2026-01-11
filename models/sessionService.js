// services/sessionService.js
console.log('sessionService.js loaded');

window.getEffectiveSession = getEffectiveSession;

window.getEffectiveSession = function () {
    const admin = localStorage.getItem("adminSession");
    if (admin) return admin;

    const user = JSON.parse(localStorage.getItem("user"));
    return user?.session_id;
};
