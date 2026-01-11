// controllers/studentCountController.js
// Controller for student population analytics (major / year distribution)

const stats = await TTMS.fetchStudentStatistics({
    sesi: "2025/2026",
    semester: 1
});

StudentCountController.drawMajorityMinorityMajorChart(stats.majorPercentages);
StudentCountController.drawMajorityMinorityYearChart(stats.byYear);


const StudentCountController = {

    // ================= ENTRY POINT =================
    async drawStudentCountDashboard() {
        try {
            console.log("📊 Drawing student count dashboard...");

            // 1. Ensure Google Charts is loaded
            await this.loadCharts();

            // 2. Get admin session
            const adminSession = AuthController.getAdminSession?.();
            if (!adminSession || !adminSession.session_id) {
                console.warn("⚠️ Admin session not available");
                this.showError("Admin access required to view student statistics.");
                return;
            }

            // 3. Get current academic session
            const { sesi, semester } = TTMS.getCurrentSession();

            // 4. Fetch analytics data (MODEL handles pagination & aggregation)
            const stats = await TTMS.fetchStudentStatistics({
                session_id: adminSession.session_id,
                sesi,
                semester
            });

            if (!stats || stats.total === 0) {
                this.showError("No student data available for this session.");
                return;
            }

            // 5. Draw charts
            await Promise.all([
                this.drawMajorDistributionChart(stats.majorPercentages),
                this.drawYearDistributionChart(stats.byYear),
                this.drawMajorYearChart(stats.byMajorAndYear)
            ]);

            // 6. Update summary indicators
            this.updateSummary(stats);

            console.log("✅ Student count dashboard rendered");

        } catch (error) {
            console.error("ERROR drawing student count dashboard:", error);
            this.showError("Failed to load student analytics.");
        }
    },

    // ================= CHART LOADER =================
    loadCharts() {
        return new Promise((resolve) => {
            if (window.google && google.charts) {
                google.charts.load("current", { packages: ["corechart", "bar"] });
                google.charts.setOnLoadCallback(resolve);
            } else {
                const script = document.createElement("script");
                script.src = "https://www.gstatic.com/charts/loader.js";
                script.onload = () => {
                    google.charts.load("current", { packages: ["corechart", "bar"] });
                    google.charts.setOnLoadCallback(resolve);
                };
                document.head.appendChild(script);
            }
        });
    },

    // ================= MAJOR DISTRIBUTION =================
    drawMajorDistributionChart(percentages) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById("majorDistributionChart");
                if (!container || !percentages) {
                    resolve();
                    return;
                }

                const chartData = new google.visualization.DataTable();
                chartData.addColumn("string", "Major");
                chartData.addColumn("number", "Students");
                chartData.addColumn({ type: "string", role: "tooltip", p: { html: true } });

                Object.entries(percentages).forEach(([major, data]) => {
                    chartData.addRow([
                        major,
                        data.count,
                        `<div class="chart-tooltip">
                            <strong>${major}</strong><br>
                            Students: ${data.count}<br>
                            Percentage: ${data.percent}%
                         </div>`
                    ]);
                });

                const options = {
                    title: "Student Distribution by Major",
                    pieHole: 0.4,
                    backgroundColor: "transparent",
                    chartArea: { width: "90%", height: "80%" },
                    legend: { position: "labeled" },
                    tooltip: { isHtml: true }
                };

                const chart = new google.visualization.PieChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },

    // ================= YEAR DISTRIBUTION =================
    drawYearDistributionChart(byYear) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById("yearDistributionChart");
                if (!container || !byYear) {
                    resolve();
                    return;
                }

                const chartData = new google.visualization.DataTable();
                chartData.addColumn("string", "Year");
                chartData.addColumn("number", "Students");

                Object.entries(byYear).forEach(([year, count]) => {
                    chartData.addRow([`Year ${year}`, count]);
                });

                const options = {
                    title: "Student Distribution by Year",
                    legend: "none",
                    backgroundColor: "transparent",
                    hAxis: { title: "Year of Study" },
                    vAxis: { title: "Number of Students", minValue: 0 },
                    chartArea: { width: "80%", height: "70%" }
                };

                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },

    // ================= MAJOR × YEAR =================
    drawMajorYearChart(byMajorAndYear) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById("majorYearChart");
                if (!container || !byMajorAndYear) {
                    resolve();
                    return;
                }

                const majors = Object.keys(byMajorAndYear);
                const years = Object.keys(byMajorAndYear[majors[0]] || {});

                const chartData = new google.visualization.DataTable();
                chartData.addColumn("string", "Year");

                majors.forEach(m => chartData.addColumn("number", m));

                years.forEach(year => {
                    chartData.addRow([
                        `Year ${year}`,
                        ...majors.map(m => byMajorAndYear[m][year] || 0)
                    ]);
                });

                const options = {
                    title: "Student Distribution by Major and Year",
                    isStacked: true,
                    backgroundColor: "transparent",
                    hAxis: { title: "Year of Study" },
                    vAxis: { title: "Number of Students", minValue: 0 },
                    chartArea: { width: "80%", height: "70%" },
                    legend: { position: "top" }
                };

                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },

    // ================= SUMMARY =================
    updateSummary(stats) {
        const totalEl = document.getElementById("totalStudents");
        const majorityEl = document.getElementById("majorityMajor");
        const minorityEl = document.getElementById("minorityMajor");

        if (totalEl) totalEl.textContent = stats.total;

        const sorted = Object.entries(stats.majorPercentages)
            .sort((a, b) => b[1].count - a[1].count);

        if (majorityEl && sorted[0]) {
            majorityEl.textContent =
                `${sorted[0][0]} (${sorted[0][1].percent}%)`;
        }

        if (minorityEl && sorted[sorted.length - 1]) {
            minorityEl.textContent =
                `${sorted[sorted.length - 1][0]} (${sorted[sorted.length - 1][1].percent}%)`;
        }
    },

    // ================= ERROR HANDLER =================
    showError(message) {
        const container = document.getElementById("studentDashboard");
        if (container) {
            container.innerHTML =
                `<div class="alert alert-warning">${message}</div>`;
        }
    },

    drawMajorityMinorityMajorChart(majorPercentages) {
    return new Promise((resolve) => {
        google.charts.setOnLoadCallback(() => {
            const container = document.getElementById("majorMajorityChart");
            if (!container || !majorPercentages) {
                resolve();
                return;
            }

            // Sort majors by count
            const sorted = Object.entries(majorPercentages)
                .sort((a, b) => b[1].count - a[1].count);

            const majority = sorted[0];
            const minority = sorted[sorted.length - 1];

            const chartData = new google.visualization.DataTable();
            chartData.addColumn("string", "Category");
            chartData.addColumn("number", "Students");

            chartData.addRows([
                [`Majority (${majority[0]})`, majority[1].count],
                [`Minority (${minority[0]})`, minority[1].count]
            ]);

            const options = {
                title: "Majority vs Minority (By Major)",
                pieHole: 0.4,
                backgroundColor: "transparent",
                legend: { position: "bottom" }
            };

            const chart = new google.visualization.PieChart(container);
            chart.draw(chartData, options);
            resolve();
        });
    });
},

// YEAR OF STUDY
drawMajorityMinorityYearChart(byYear) {
    return new Promise((resolve) => {
        google.charts.setOnLoadCallback(() => {
            const container = document.getElementById("yearMajorityChart");
            if (!container || !byYear) {
                resolve();
                return;
            }

            const sorted = Object.entries(byYear)
                .sort((a, b) => b[1] - a[1]);

            const majority = sorted[0];
            const minority = sorted[sorted.length - 1];

            const chartData = new google.visualization.DataTable();
            chartData.addColumn("string", "Category");
            chartData.addColumn("number", "Students");

            chartData.addRows([
                [`Year ${majority[0]} (Majority)`, majority[1]],
                [`Year ${minority[0]} (Minority)`, minority[1]]
            ]);

            const options = {
                title: "Majority vs Minority (By Year)",
                pieHole: 0.4,
                backgroundColor: "transparent",
                legend: { position: "bottom" }
            };

            const chart = new google.visualization.PieChart(container);
            chart.draw(chartData, options);
            resolve();
        });
    });
}

};



// Make globally available
window.StudentCountController = StudentCountController;
