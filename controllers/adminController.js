const AdminController = {

    // =========================
    // EXPORT HELPERS
    // =========================
    exportToCSV(filename, rows) {
        if (!rows || rows.length === 0) {
            alert('No data available to export.');
            return;
        }

        const headers = Object.keys(rows[0]);
        const csvContent = [
            headers.join(','),
            ...rows.map(row =>
                headers.map(h => `"${row[h] ?? ''}"`).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    },

    // =========================
    // COURSES (SYSTEM-WIDE)
    // =========================
    async exportAllCourses() {
        const courses = await TTMS.fetchCourses();

        const data = courses.map(c => ({
            course_code: c.kod_subjek,
            course_name: c.nama_subjek,
            session: c.sesi,
            semester: c.semester,
            lecturer_code: c.kod_pensyarah,
            lecturer_name: c.nama_pensyarah,
            students: c.bil_pelajar,
            room: c.kod_bilik,
            day: c.hari,
            time: c.masa
        }));

        this.exportToCSV('ttms_all_courses.csv', data);
    },

    // =========================
    // STUDENT TIMETABLE
    // =========================
    async exportStudentTimetable(matric) {
        if (!matric) {
            alert('Please enter student matric number');
            return;
        }

        const courses = await TTMS.fetchMyCourses(matric);

        const data = courses.map(c => ({
            matric: matric,
            course_code: c.kod_subjek,
            course_name: c.nama_subjek,
            section: c.seksyen,
            session: c.sesi,
            semester: c.semester,
            day: c.hari,
            time: c.masa,
            room: c.kod_bilik
        }));

        this.exportToCSV(`student_${matric}_timetable.csv`, data);
    },

    // =========================
    // LECTURER TIMETABLE
    // =========================
    async exportLecturerTimetable(lecturerCode) {
        if (!lecturerCode) {
            alert('Please enter lecturer staff ID');
            return;
        }

        const courses = await TTMS.fetchCourses();
        const lecturerCourses = courses.filter(
            c => c.kod_pensyarah === lecturerCode
        );

        const data = lecturerCourses.map(c => ({
            lecturer: lecturerCode,
            course_code: c.kod_subjek,
            course_name: c.nama_subjek,
            session: c.sesi,
            semester: c.semester,
            day: c.hari,
            time: c.masa,
            room: c.kod_bilik,
            students: c.bil_pelajar
        }));

        this.exportToCSV(`lecturer_${lecturerCode}_timetable.csv`, data);
    },

    // =========================
    // CLASH REPORT (SYSTEM)
    // =========================
    async exportSystemClashes() {
        const result = await TTMS.detectSystemClashes();

        if (!result || result.clashes.length === 0) {
            alert('No clashes detected.');
            return;
        }

        const data = result.clashes.map(c => ({
            type: c.type,
            description: c.description,
            course_1: c.courses[0]?.code,
            course_2: c.courses[1]?.code,
            severity: c.severity
        }));

        this.exportToCSV('ttms_system_clashes.csv', data);
    }
};

window.AdminController = AdminController;
