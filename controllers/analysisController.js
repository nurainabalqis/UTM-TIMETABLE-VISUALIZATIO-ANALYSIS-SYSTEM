// controllers/analysisController.js
class AnalysisController {
    constructor() {
        this.charts = {};
        this.isInitializing = false;
        this.isDrawingDaily = false;
    }
    
    // Initialize all charts
    async initDashboardCharts() {

        if (this.isInitializing) {
            
            console.log('⚠️ Chart initialization already in progress, skipping...');
            return;
        }

        this.isInitializing = true;

        console.log('AnalysisController: Initializing dashboard charts...');

        try {
            // Ensure Google Charts is loaded
            if (!window.google || !window.google.charts) {
                console.log('AnalysisController: Loading Google Charts...');
                await new Promise((resolve) => {
                    google.charts.load('current', { packages: ['corechart', 'bar'] });
                    google.charts.setOnLoadCallback(resolve);
                });
            }
            
            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Load charts
            await Promise.all([
                this.loadWorkloadChart(),
                this.loadPeakHoursChart()
            ]);

            

            if (typeof Chart === 'undefined') {
                console.error('❌ Chart.js is not loaded!');
                return;
            }

            await this.drawDailyDistributionChart();

            console.log('AnalysisController: All charts loaded successfully');
        } catch (error) {
            console.error('AnalysisController: Error initializing charts:', error);
        } finally {
            this.isInitializing = false;
        }
    }
    
    // Load workload chart
    // controllers/analysisController.js
    // Load workload chart
    async loadWorkloadChart() {
    const showLoader = () => {
        const el = document.getElementById('workloadLoading');
        if (el) el.style.display = 'block';
    };

    const hideLoader = () => {
        const el = document.getElementById('workloadLoading');
        if (el) el.style.display = 'none';
    };

    const chartEl = document.getElementById('workloadChart');

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;

        showLoader();
        if (chartEl) chartEl.innerHTML = '';

        const lecturerKey =
        user.no_pekerja || user.kod_pensyarah || user.login_name || user.username;
        const lecturerName = user.name || user.nama || "";

        const workloadData = await TTMS.fetchLecturerCourseWorkload(
        lecturerKey,
        lecturerName
        );

        if (!workloadData || workloadData.length === 0) {
        if (chartEl) {
            chartEl.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                No teaching workload found for this session.
            </div>
            `;
        }
        return;
        }

        google.charts.setOnLoadCallback(() => {
        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Course');
        data.addColumn('number', 'Hours/Week');

        workloadData.forEach(item => {
            data.addRow([`${item.courseCode} (${item.section})`, item.hours]);
        });

        const options = {
            chartArea: { width: '90%', height: '80%' },
            backgroundColor: 'transparent'
        };

        const chart = new google.visualization.PieChart(chartEl);
        chart.draw(data, options);

        // ✅ Hide loader AFTER chart successfully draws
        hideLoader();

        this.charts.workload = chart;
        });

    } catch (err) {
        console.error('Workload chart error:', err);
    } finally {
        // ✅ Also hide loader here (covers errors/early exits)
        hideLoader();
    }
    }


    getSessionCategory(jenis) {
        if (!jenis) return 'other';

        const j = String(jenis).toLowerCase();

        // lecture
        if (j.includes('kuliah') || j.includes('lecture') || j.includes('kul') || j.includes('lec')) return 'lecture';

        // tutorial
        if (j.includes('tutorial') || j.includes('tutor') || j.includes('tut')) return 'tutorial';
        
        // lab / practical
        if (j.includes('amali') || j.includes('amal') || j.includes('lab') || j.includes('makmal') || j.includes('practical')) return 'lab';

        return 'other';
    }

    inferSessionCategory(slot, subject) {
  // 1) Try explicit activity/type fields FIRST (most accurate)
  const primaryText = [
    slot?.jenis,
    slot?.jenis_kelas,
    slot?.kod_aktiviti,
    slot?.nama_aktiviti,
    slot?.kod_kelas
  ].filter(Boolean).join(' ').toLowerCase();

  const byPrimary = this.getSessionCategory(primaryText);
  if (byPrimary !== 'other') return byPrimary;

  // 2) Try section pattern SECOND (if your data uses this)
  // Examples: L01, T02, A03
  const section = String(subject?.seksyen || slot?.seksyen || '').toUpperCase();
  if (section.startsWith('L')) return 'lecture';
  if (section.startsWith('T')) return 'tutorial';
  if (section.startsWith('A') || section.startsWith('M')) return 'lab';

  // 3) Room name is NOT reliable for lecture vs lab, so only tag lab
  // when the room name very explicitly says lab/amali.
  const roomText = [
    slot?.ruang?.nama_ruang,
    slot?.ruang?.nama_ruang_singkatan,
    slot?.ruang?.kod_ruang
  ].filter(Boolean).join(' ').toLowerCase();

  if (roomText.includes('amali') || roomText.includes('lab')) return 'lab';

  // 4) Default: lecture (better than dumping into "other")
  return 'lecture';
}


    // ===============================
    // TIME BLOCK HELPER (REAL TTMS)
    // ===============================
    getTimeBlock(masa, jam) {
        let hour = null;

        // Prefer jam if exists
        if (jam) {
            hour = parseInt(jam.split(':')[0]);
        }
        // Fallback to TTMS slot
        else if (masa) {
            const slotToHour = {
                1: 7, 2: 8, 3: 9, 4: 10, 5: 11,
                6: 12, 7: 13, 8: 14, 9: 15, 10: 16
            };
            hour = slotToHour[masa];
    }

        if (hour >= 8 && hour <= 11) return 'morning';
        if (hour >= 12 && hour <= 16) return 'afternoon';
        return null;
    }

    // Daily Distribution (REAL TTMS, HOURS by class type)
    async getDailyDistribution(user, dayNumber) {
    const result = { lecture: 0, tutorial: 0, lab: 0, other: 0 };
    const { sesi, semester } = TTMS.getCurrentSession();

    let subjects = [];

    // ✅ Use supported TTMS entities only
    if (user.role === 'student') {
        subjects = await TTMS.fetchMyCourses(user.username); // pelajar_subjek ✅
    } else if (user.role === 'lecturer') {
        subjects = await TTMS.fetchLecturerSubjects(user.username); // pensyarah_subjek ✅
    } else {
        return result;
    }

    const currentSubjects = subjects.filter(s =>
        s.sesi === sesi && String(s.semester) === String(semester)
    );

    for (const subject of currentSubjects) {
        if (!subject.kod_subjek || !subject.seksyen) continue;

        const timetable = await TTMS.fetchCourseSchedule(
            subject.kod_subjek,
            sesi,
            semester,
            subject.seksyen
        ); // jadual_subjek ✅

        if (!Array.isArray(timetable)) continue;

        timetable.forEach(slot => {
            if (Number(slot.hari) !== dayNumber) return;

            // ✅ Use stronger inference (room name etc.)
            const type = this.inferSessionCategory(slot, subject);

            result[type] = (result[type] || 0) + 1;
        });
    }

    return result;
}


    // DRAW DAILY DISTRIBUTION CHART

    async drawDailyDistributionChart() {
        const user = JSON.parse(localStorage.getItem("user"));
        if (!user) {
            console.warn("User not found in localStorage");
            return;
        }

        const canvas = document.getElementById("dailyDistributionChart");
        if (!canvas) {
            console.warn("dailyDistributionChart canvas not found");
            return;
        }

        if (typeof Chart === "undefined") {
            console.error("❌ Chart.js is not available");
            canvas.parentElement.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Chart.js library is not loaded. Please refresh the page.
            </div>
            `;
            return;
        }

        if (this.isDrawingDaily) {
            console.warn("⏳ Daily distribution chart already drawing, skipping...");
            return;
        }
        this.isDrawingDaily = true;

        try {
            // Destroy old chart
            if (this.charts?.daily) {
            this.charts.daily.destroy();
            this.charts.daily = null;
            }

            // TTMS weekday mapping
            const days = [
            { num: 2, label: "Monday" },
            { num: 3, label: "Tuesday" },
            { num: 4, label: "Wednesday" },
            { num: 5, label: "Thursday" },
            { num: 6, label: "Friday" },
            ];

            const labels = [];

            // ===============================
            // 🔥 FETCH TTMS DATA ONCE
            // ===============================
            const { sesi, semester } = TTMS.getCurrentSession();

            let subjects = [];
            if (user.role === "student") {
                subjects = await TTMS.fetchMyCourses(user.username);
            } else if (user.role === "lecturer") {
            const lecturerIdRaw =
                user.no_pekerja || user.kod_pensyarah || user.login_name || user.username || "";
                subjects = await TTMS.fetchLecturerSubjects(lecturerIdRaw);
            } else {
            // admin/others: do nothing (or return)
            return;
            }


            const currentSubjects = subjects.filter(
            (s) => s.sesi === sesi && String(s.semester) === String(semester)
            );

            // Daily accumulator (keep types internally for insights + tooltip details if needed)
            const dailyMap = {
            2: { lecture: 0, tutorial: 0, lab: 0, other: 0, classes: {} },
            3: { lecture: 0, tutorial: 0, lab: 0, other: 0, classes: {} },
            4: { lecture: 0, tutorial: 0, lab: 0, other: 0, classes: {} },
            5: { lecture: 0, tutorial: 0, lab: 0, other: 0, classes: {} },
            6: { lecture: 0, tutorial: 0, lab: 0, other: 0, classes: {} },
            };

            // ===============================
            // 🔥 AGGREGATE LOCALLY (NO RACES)
            // ===============================
            for (const subject of currentSubjects) {
            if (!subject.kod_subjek || !subject.seksyen) continue;

            const timetable = await TTMS.fetchCourseSchedule(
                subject.kod_subjek,
                sesi,
                semester,
                subject.seksyen
            );

            if (!Array.isArray(timetable)) continue;

            timetable.forEach((slot) => {
                const day = Number(slot.hari);
                if (!dailyMap[day]) return;

                const type = this.inferSessionCategory(slot, subject); // 'lecture'|'tutorial'|'lab'|'other'

                // total sessions (hours) by type (still tracked internally)
                dailyMap[day][type]++;

                // per-class hours
                const classKey = `${subject.kod_subjek} (${subject.seksyen})`;
                dailyMap[day].classes[classKey] = (dailyMap[day].classes[classKey] || 0) + 1;
            });
            }

            // Labels
            for (const day of days) labels.push(day.label);

            // ===============================
            // ✅ BUILD TOTALS ONLY (single dataset)
            // ===============================
            const totalsByDay = days.map((d) => {
            const x = dailyMap[d.num];
            return (x.lecture || 0) + (x.tutorial || 0) + (x.lab || 0) + (x.other || 0);
            });

            // ===============================
            // AUTOMATED INSIGHTS (updated to use totalsByDay)
            // ===============================
            const busiestIndex = totalsByDay.indexOf(Math.max(...totalsByDay));

            const nonZeroTotals = totalsByDay
            .map((v, i) => ({ v, i }))
            .filter((o) => o.v > 0);

            const lightestIndex = nonZeroTotals.length
            ? nonZeroTotals.reduce((a, b) => (b.v < a.v ? b : a)).i
            : -1;

            const freeEl = document.getElementById("insight-free");
            const freeDays = labels
            .map((day, i) => ({ day, total: totalsByDay[i] }))
            .filter((x) => x.total === 0)
            .map((x) => x.day);

            if (freeEl) {
            freeEl.textContent = freeDays.length
                ? `No-class day(s): ${freeDays.join(", ")}`
                : "No-class day(s): —";
            }

            // If you still want dominantType insight, keep it (optional)
            const totalsByType = {
            Lecture: days.reduce((sum, d) => sum + (dailyMap[d.num].lecture || 0), 0),
            Tutorial: days.reduce((sum, d) => sum + (dailyMap[d.num].tutorial || 0), 0),
            Lab: days.reduce((sum, d) => sum + (dailyMap[d.num].lab || 0), 0),
            Others: days.reduce((sum, d) => sum + (dailyMap[d.num].other || 0), 0),
            };

            const dominantType = Object.entries(totalsByType).reduce(
            (a, b) => (b[1] > a[1] ? b : a),
            ["—", 0]
            )[0];

            const busiestEl = document.getElementById("insight-busiest");
            const lightestEl = document.getElementById("insight-lightest");
            const dominantEl = document.getElementById("insight-dominant");

            if (busiestEl) {
            busiestEl.innerHTML = `<i class="fas fa-circle text-danger me-2"></i>
                Busiest Day: ${labels[busiestIndex]} (highest total sessions)`;
            }

            if (lightestEl) {
            lightestEl.innerHTML =
                lightestIndex >= 0
                ? `<i class="fas fa-circle text-success me-2"></i>
                    Lightest Day: ${labels[lightestIndex]} (lowest total sessions)`
                : `<i class="fas fa-circle text-success me-2"></i>
                    Lightest Day: —`;
            }

            if (dominantEl) {
            dominantEl.textContent = `Primary Workload Type: ${dominantType} (largest weekly contribution)`;
            }

            // ===============================
            // ✅ RENDER CHART (single dataset, no legend, one color)
            // ===============================
            this.charts.daily = new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                {
                    data: totalsByDay,
                    backgroundColor: "#1976D2", // one color
                    borderRadius: 6,
                },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                x: { stacked: false },
                y: {
                    stacked: false,
                    beginAtZero: true,
                    max: 8,
                    title: { display: true, text: "Total Hours per Day" },
                },
                },
                plugins: {
                title: {
                    display: true,
                    text:
                    user.role === "student"
                        ? "My Daily Class Workload (Total Sessions)"
                        : "My Daily Teaching Workload (Total Sessions)",
                },
                legend: {
                    display: false, // ✅ removes label box completely
                },
                tooltip: {
                    callbacks: {
                    label: (ctx) => {
                        const dayIndex = ctx.dataIndex;
                        const dayNum = days[dayIndex].num;

                        const totalHours = ctx.raw;
                        const classesObj = dailyMap[dayNum].classes;
                        const classLines = Object.entries(classesObj).map(
                        ([name, hrs]) => `• ${name}: ${hrs} hr(s)`
                        );

                        return [`Total: ${totalHours} hr(s)`, ...classLines];
                    },
                    },
                },
                },
            },
            });

            console.log("✅ Daily total chart rendered (single dataset)");
        } catch (err) {
            console.error("❌ Daily distribution chart error:", err);
        } finally {
            this.isDrawingDaily = false;
        }
    }

    async getPeakHoursFromMyTimetable(user) {
    const { sesi, semester } = TTMS.getCurrentSession();

    const subjects = user.role === 'student'
        ? await TTMS.fetchMyCourses(user.username)
        : await TTMS.fetchLecturerSubjects(user.username);

    const currentSubjects = subjects.filter(s =>
        s.sesi === sesi && String(s.semester) === String(semester)
    );

    const hourMap = {}; // { '8': count, '9': count, ... }

    for (const subject of currentSubjects) {
        if (!subject.kod_subjek || !subject.seksyen) continue;

        const timetable = await TTMS.fetchCourseSchedule(
            subject.kod_subjek,
            sesi,
            semester,
            subject.seksyen
        );

        if (!Array.isArray(timetable)) continue;

        timetable.forEach(slot => {
            let hour = null;

// Prefer real time if exists
if (slot.jam) {
    hour = parseInt(slot.jam.split(':')[0]);
}
// Otherwise derive from TTMS masa slot
else if (slot.masa) {
    const slotToHour = {
        1: 7,
        2: 8,   // ✅ THIS is why 8 AM returns
        3: 9,
        4: 10,
        5: 11,
        6: 12,
        7: 13,
        8: 14,
        9: 15,
        10: 16
    };

    hour = slotToHour[slot.masa];
}

if (!hour) return;

hourMap[hour] = (hourMap[hour] || 0) + 1;

        });
    }

    return Object.entries(hourMap)
        .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
}

    
    // Load peak hours chart (FROM MY TIMETABLE)
async loadPeakHoursChart() {
    try {
        console.log('📊 Loading Peak Hours chart (from My Timetable)');

        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;

        const titleEl = document.getElementById('peakHoursTitle');
        const container = document.getElementById('peakHoursChart');
        if (!container) return;

        container.innerHTML = '';

        if (titleEl) {
            titleEl.innerHTML = `
                <i class="fas fa-fire text-warning me-2"></i>
                ${user.role === 'student'
                    ? 'Busiest Study Hours (My Timetable)'
                    : 'Busiest Teaching Hours (My Timetable)'}
            `;
        }

        // ✅ CORRECT DATA SOURCE
        const peakData = await this.getPeakHoursFromMyTimetable(user);

        if (!Array.isArray(peakData) || peakData.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-info-circle fa-2x mb-2"></i><br>
                    No timetable data available.
                </div>
            `;
            return;
        }

        const maxCount = Math.max(...peakData.map(p => p.count));
        const peakSlots = peakData.filter(p => p.count === maxCount);
        const totalSlots = peakData.reduce((sum, p) => sum + p.count, 0);

        google.charts.setOnLoadCallback(() => {
            const data = new google.visualization.DataTable();
            data.addColumn('string', 'Hour of Day');
            data.addColumn('number', 'Occupied Slots');
            data.addColumn({ role: 'tooltip', type: 'string', p: { html: true } });
            data.addColumn({ role: 'style' });
            data.addColumn({ role: 'annotation' });

            peakData.forEach(item => {
                const isPeak = item.count === maxCount;
                const percentage = ((item.count / totalSlots) * 100).toFixed(1);

                const tooltip = `
                    <div style="padding:8px 10px;">
                        <strong>Hour:</strong> ${item.hour}<br>
                        <strong>Occupied slots:</strong> ${item.count}<br>
                        <strong>Weekly share:</strong> ${percentage}%<br>
                        <strong>Intensity:</strong> ${isPeak ? 'Peak' : 'Normal'}
                    </div>
                `;

                data.addRow([
                    item.hour,
                    item.count,
                    tooltip,
                    isPeak
                        ? 'color: #D32F2F; font-weight: bold;'
                        : 'color: #E0E0E0;',
                    isPeak ? 'Peak' : null
                ]);
            });

            const options = {
                backgroundColor: 'transparent',
                width: '100%',
                height: 320,
                tooltip: { isHtml: true },
                chartArea: {
                    left: 60,
                    right: 30,
                    top: 50,
                    bottom: 60,
                    width: '100%',
                    height: '65%'
                },
                hAxis: {
                    title: 'Hour of Day',
                    textStyle: { fontSize: 12 }
                },
                vAxis: {
                    title: 'Number of Occupied Slots per Week',
                    minValue: 0,
                    maxValue: 4,
                    format: '0',
                    textStyle: { fontSize: 12 }
                },
                legend: { position: 'none' }
            };

            // 🔔 Info text
            let infoBox = document.getElementById('peakHoursInfo');
            if (!infoBox) {
                infoBox = document.createElement('div');
                infoBox.id = 'peakHoursInfo';
                infoBox.style.textAlign = 'center';
                infoBox.style.marginBottom = '10px';
                infoBox.style.fontWeight = '600';
                container.parentElement.insertBefore(infoBox, container);
            }

            infoBox.innerText =
                `Busiest hour(s): ${peakSlots.map(p => p.hour).join(', ')} (${maxCount} occupied slots/week)`;

            let explanationEl = document.getElementById('peakHoursExplanation');
            if (!explanationEl) {
                explanationEl = document.createElement('div');
                explanationEl.id = 'peakHoursExplanation';
                explanationEl.style.textAlign = 'center';
                explanationEl.style.fontSize = '13px';
                explanationEl.style.color = '#444';
                explanationEl.style.marginTop = '6px';
                container.parentElement.after(explanationEl);
            }

            explanationEl.innerText =
                'This chart shows how often you are scheduled at each hour across your weekly timetable.';

            let insightEl = document.getElementById('peakHoursInsight');
            if (!insightEl) {
                insightEl = document.createElement('div');
                insightEl.id = 'peakHoursInsight';
                insightEl.style.textAlign = 'center';
                insightEl.style.marginTop = '6px';
                insightEl.style.fontSize = '13px';
                insightEl.style.color = '#666';
                container.parentElement.after(insightEl);
            }

            const peakShare = ((maxCount / totalSlots) * 100).toFixed(1);

            insightEl.innerText =
                user.role === 'student'
                    ? `Around ${peakShare}% of your weekly classes occur during peak hours.`
                    : `Around ${peakShare}% of your weekly teaching load occurs during peak hours.`;

            const chart = new google.visualization.ColumnChart(container);
            chart.draw(data, options);
            this.charts.peak = chart;
        });

    } catch (error) {
        console.error('Error loading peak hours chart:', error);
    }
}


    
    // Refresh all charts
    refreshAllCharts() {
        this.charts = {};
        this.initDashboardCharts();
    }
}

// Global instance
window.analysisController = new AnalysisController();

// Auto-initialize when Google Charts is loaded
if (typeof google !== 'undefined' && google.charts) {
    google.charts.load('current', { packages: ['corechart', 'bar'] });
}