// controllers/roomController.js - UPDATE with chart functions

const RoomController = {

    // Modal navigation stack (LIST -> SCHEDULE -> BACK)
_modalStack: [],
_getModalEls() {
  return {
    titleEl: document.getElementById("roomListModalTitle"),
    bodyEl: document.getElementById("roomListModalBody"),
    modalEl: document.getElementById("roomListModal"),
  };
},
_openModal(title, bodyHtml) {
  const { titleEl, bodyEl, modalEl } = this._getModalEls();
  if (!titleEl || !bodyEl || !modalEl) {
    console.warn("roomListModal not found in HTML");
    return;
  }
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
},
_pushModalState() {
  const { titleEl, bodyEl } = this._getModalEls();
  if (!titleEl || !bodyEl) return;
  this._modalStack.push({
    title: titleEl.textContent,
    html: bodyEl.innerHTML,
  });
},
modalBack() {
  const prev = this._modalStack.pop();
  if (!prev) return;
  this._openModal(prev.title, prev.html);
},
    
    // Draw comprehensive room utilization dashboard
    async drawRoomUtilizationDashboard() {
        try {
            console.log('📊 Drawing room utilization dashboard...');
            
            // Load Google Charts
            if (!window.google || !window.google.charts) {
                await new Promise((resolve) => {
                    google.charts.load('current', { packages: ['corechart', 'bar'] });
                    google.charts.setOnLoadCallback(resolve);
                });
            }
            
            // Fetch analysis data
            const user = AuthController.getCurrentUser();
            if (!user) return;
            
            const analysis = await TTMS.fetchRoomUtilizationAnalysis();
            if (!analysis.analysis || !analysis.charts) {
                console.warn('No room analysis data available');
                return;
            }

            const has = (id) => !!document.getElementById(id);

            const rooms = await TTMS.fetchRooms();

            /*await Promise.all([
                this.drawRoomTypeChart(analysis.charts.roomTypeDistribution),
                this.drawTopRoomsChart(analysis.charts.topRoomsByUsage),
                this.drawCapacityChart(analysis.charts.capacityDistribution),
                this.drawPeakHoursChart(analysis.charts.peakHoursData),
                this.drawRoomTypeChartByBuilding(
                'n28TypeChart',
                    'n28RoomList',
                    rooms,
                    'N28'
                ),

                this.drawRoomTypeChartByBuilding(
                    'n28aTypeChart',
                    'n28aRoomList',
                    rooms,
                    'N28A'
                )
            ]);*/

            const tasks = [];

            /* Main charts */
            if (has('roomTypeChart')) {
                tasks.push(
                    this.drawRoomTypeChart(analysis.charts.roomTypeDistribution)
                );
            }

            if (has('topRoomsChart')) {
                tasks.push(
                    this.drawTopRoomsChart(analysis.charts.topRoomsByUsage)
                );
            }

            if (has('capacityChart')) {
                tasks.push(
                    this.drawCapacityChart(analysis.charts.capacityDistribution)
                );
            }

            if (has('peakHoursChart')) {
                tasks.push(
                    this.drawPeakHoursChart(analysis.charts.peakHoursData)
                );
            }

            /* Building-specific charts */
            if (has('n28TypeChart')) {
                tasks.push(
                    this.drawRoomTypeChartByBuilding(
                        'n28TypeChart',
                        'n28RoomList',
                        rooms,
                        'N28'
                    )
                );
            }

            if (has('n28aTypeChart')) {
                tasks.push(
                    this.drawRoomTypeChartByBuilding(
                        'n28aTypeChart',
                        'n28aRoomList',
                        rooms,
                        'N28A'
                    )
                );
            }

            await Promise.all(tasks);
        
            console.log('✅ Room utilization dashboard drawn');
            
        } catch (error) {
            console.error('ERROR drawing room dashboard:', error);
        }
    },
    
    // Draw room type distribution chart
    drawRoomTypeChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('roomTypeChart');
                /*if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No room type data available</div>';
                    resolve();
                    return;
                }*/

                if (!container) {
                    resolve();
                    return;
                }
                if (!data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No room type data available</div>';
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Room Type');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.type,
                        item.count,
                        `<div class="chart-tooltip">
                            <strong>${item.type}</strong><br>
                            Count: ${item.count}<br>
                            ${Math.round((item.count / data.reduce((s, i) => s + i.count, 0)) * 100)}% of total
                         </div>`
                    ]);
                });
                
                const options = {
                    title: 'Room Distribution by Type',
                    is3D: false,
                    pieHole: 0.4,
                    colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#8E44AD', '#16A085'],
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'labeled' },
                    tooltip: { isHtml: true }
                };
                
                const chart = new google.visualization.PieChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw usage level chart
    drawUsageLevelChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('usageLevelChart');
                if (!container || !data) {
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Usage Level');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'style' });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.level,
                        item.count,
                        `color: ${item.color}`
                    ]);
                });
                
                const options = {
                    title: 'Room Utilization Levels',
                    legend: 'none',
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Usage Level' },
                    vAxis: { title: 'Number of Rooms', minValue: 0 },
                    chartArea: { width: '80%', height: '70%' }
                };
                
                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw top rooms by usage chart (STACKED BAR CHART like your example)
    drawTopRoomsChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('topRoomsChart');
                /*if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No room usage data available</div>';
                    resolve();
                    return;
                }*/
                if (!container) {
                    resolve();
                    return;
                }
                if (!data || data.length === 0) {
                   container.innerHTML = '<div class="text-muted p-3">No room usage data available</div>';
                   resolve();
                   return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Room');
                chartData.addColumn('number', 'Subjects');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                chartData.addColumn('number', 'Hours/Week');
                chartData.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
                
                data.forEach(room => {
                    const tooltipSubjects = `
                        <div class="tooltip-content">
                            <strong>${room.shortName}</strong><br>
                            Type: ${room.type}<br>
                            Subjects: ${room.subjectCount}<br>
                            Capacity: ${room.capacity}
                        </div>
                    `;
                    
                    const tooltipHours = `
                        <div class="tooltip-content">
                            <strong>${room.shortName}</strong><br>
                            Type: ${room.type}<br>
                            Hours/Week: ${room.usageHours}<br>
                            ${room.usageHours > 20 ? 'High Usage' : room.usageHours > 10 ? 'Medium Usage' : 'Low Usage'}
                        </div>
                    `;
                    
                    chartData.addRow([
                        room.shortName,
                        room.subjectCount,
                        tooltipSubjects,
                        room.usageHours,
                        tooltipHours
                    ]);
                });
                
                const options = {
                    title: 'Top Rooms by Weekly Usage',
                    isStacked: true,
                    legend: { position: 'top', maxLines: 3 },
                    colors: ['#FF69B4', '#457E96'], // Pink and blue like your example
                    backgroundColor: 'transparent',
                    hAxis: {
                        title: 'Room',
                        slantedText: true,
                        slantedTextAngle: 45
                    },
                    vAxis: {
                        title: 'Hours/Week & Subjects',
                        minValue: 0
                    },
                    chartArea: {
                        width: '80%',
                        height: '65%',
                        left: 100,
                        right: 50,
                        top: 60,
                        bottom: 120
                    },
                    bar: { groupWidth: '65%' },
                    tooltip: { isHtml: true },
                    height: 500
                };
                
                const chart = new google.visualization.ColumnChart(container);
                chart.draw(chartData, options);
                
                // Add click handler
                google.visualization.events.addListener(chart, 'select', function() {
                    const selection = chart.getSelection();
                    if (selection.length > 0) {
                        const row = selection[0].row;
                        const roomCode = data[row].roomCode;
                        RoomController.viewRoomDetails(roomCode);
                    }
                });
                resolve();
            });
        });
    },
    
    // Draw peak hours chart
    drawPeakHoursChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('peakHoursChart');
                /*if (!container || !data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No peak hours data available</div>';
                    resolve();
                    return;
                }*/
                if (!container) {
                  resolve();
                   return;
                }
                if (!data || data.length === 0) {
                    container.innerHTML = '<div class="text-muted p-3">No peak hours data available</div>';
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Time Slot');
                chartData.addColumn('number', 'Sessions');
                
                data.forEach(item => {
                    chartData.addRow([item.slot, item.count]);
                });
                
                const options = {
                    title: 'Peak Room Usage Hours',
                    curveType: 'function',
                    colors: ['#D32F2F'],
                    backgroundColor: 'transparent',
                    hAxis: { title: 'Time of Day', slantedText: true },
                    vAxis: { title: 'Number of Sessions', minValue: 0 },
                    chartArea: { width: '85%', height: '70%' },
                    pointSize: 5,
                    lineWidth: 3
                };
                
                const chart = new google.visualization.LineChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },
    
    // Draw capacity distribution chart
    drawCapacityChart(data) {
        return new Promise((resolve) => {
            google.charts.setOnLoadCallback(() => {
                const container = document.getElementById('capacityChart');
                if (!container || !data) {
                    resolve();
                    return;
                }
                
                const chartData = new google.visualization.DataTable();
                chartData.addColumn('string', 'Capacity Range');
                chartData.addColumn('number', 'Count');
                chartData.addColumn({ type: 'string', role: 'style' });
                
                data.forEach(item => {
                    chartData.addRow([
                        item.category,
                        item.count,
                        `color: ${item.color}`
                    ]);
                });
                
                const options = {
                    title: 'Room Capacity Distribution',
                    pieHole: 0.4,
                    backgroundColor: 'transparent',
                    chartArea: { width: '90%', height: '80%' },
                    legend: { position: 'labeled' }
                };
                
                const chart = new google.visualization.PieChart(container);
                chart.draw(chartData, options);
                resolve();
            });
        });
    },

    drawRoomTypeChartByBuilding(canvasId, listId, rooms, building) {
        const canvas = document.getElementById(canvasId);
        const list = document.getElementById(listId);
        if (!canvas || !list) return;

        const filtered = rooms.filter(r =>
            TTMS.getBuildingFromRoomCode(r.kod_ruang) === building
        );

        const grouped = {};
        filtered.forEach(r => {
            const type = r.jenis || 'Others';
            grouped[type] = grouped[type] || [];
            grouped[type].push(r);
        });

        const labels = Object.keys(grouped);
        const counts = labels.map(l => grouped[l].length);

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Number of Rooms',
                    data: counts,
                    backgroundColor: '#4CAF50'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                onClick: (_, elements) => {
                    if (!elements.length) return;

                    const idx = elements[0].index;
                    const type = labels[idx];

                    const roomsForType = grouped[type] || [];

                    // Open modal tab like your screenshot
                    this.showRoomListModal(`${building} — ${type} (${roomsForType.length})`, roomsForType);
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    },

    renderRoomList(containerId, rooms, type, building) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <h6 class="mb-2">
                ${type} in ${building} (${rooms.length})
            </h6>
            <ul class="list-group">
                ${rooms.map(r => `
                    <li class="list-group-item d-flex justify-content-between">
                        ${r.nama_ruang}
                        <span class="badge bg-secondary">
                            ${r.kod_ruang}
                        </span>
                    </li>
                `).join('')}
            </ul>
        `;
    },
    
    // View room details (now opens modal schedule instead of alert)
async viewRoomDetails(roomCode) {
  return this.showRoomScheduleModal(roomCode);
},

    async searchAvailableRooms() {
        this.isLoading = true;

        try {
            const rooms = await TTMS.fetchAvailableStudySpaces({
                timeBlock: this.searchTime,
                roomType: this.searchType
            });

            this.availableRooms = rooms;
        } catch (err) {
            console.error('Search failed:', err);
            this.availableRooms = [];
        } finally {
            this.isLoading = false;
        }
    },

    showRoomListModal(title, rooms) {
        const titleEl = document.getElementById("roomListModalTitle");
        const bodyEl  = document.getElementById("roomListModalBody");
        const modalEl = document.getElementById("roomListModal");

        if (!titleEl || !bodyEl || !modalEl) {
            console.warn("roomListModal not found in HTML");
            return;
        }

        titleEl.textContent = title;

        if (!rooms || rooms.length === 0) {
            bodyEl.innerHTML = `<div class="text-muted">No rooms found.</div>`;
        } else {
            bodyEl.innerHTML = `
  <div class="list-group">
    ${rooms.map(r => `
      <div class="list-group-item d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold">${r.nama_ruang || "-"}</div>
          <div class="text-muted small">
            ${r.kod_ruang || ""} · ${(r.jenis || "Others")} · Capacity: ${(r.kapasiti || "-")}
          </div>
        </div>

        <div class="d-flex gap-2">
          <span class="badge bg-success align-self-start">
            ${TTMS.getBuildingFromRoomCode(r.kod_ruang) || ""}
          </span>
          <button class="btn btn-outline-secondary btn-sm"
                  onclick="RoomController.showRoomScheduleModal('${r.kod_ruang}')">
            View Schedule
          </button>
        </div>
      </div>
    `).join("")}
  </div>
`;
        }

        // Bootstrap 5 modal show
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    },

async showRoomScheduleModal(roomCode) {
  // Save current modal view so Back works
  this._pushModalState();

  // Loading view
  this._openModal(
    `Room Schedule — ${roomCode}`,
    `
      <button class="btn btn-outline-secondary btn-sm mb-3" onclick="RoomController.modalBack()">
        ← Back
      </button>
      <div class="text-center py-4">
        <div class="spinner-border"></div>
        <div class="text-muted mt-2">Loading schedule…</div>
      </div>
    `
  );

  const dayMap = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
  };

  // ✅ include Slot 11–15 (your screenshot shows them)
  const timeMap = {
    1: "07:00–07:50",
    2: "08:00–08:50",
    3: "09:00–09:50",
    4: "10:00–10:50",
    5: "11:00–11:50",
    6: "12:00–12:50",
    7: "13:00–13:50",
    8: "14:00–14:50",
    9: "15:00–15:50",
    10: "16:00–16:50",
    11: "17:00–17:50",
    12: "18:00–18:50",
    13: "19:00–19:50",
    14: "20:00–20:50",
    15: "21:00–21:50",
  };

  const isObject = (v) => v && typeof v === "object";

  // ✅ Extract course string even if TTMS returns object/nested object
  const pickCourse = (s) => {
    const candidates = [
      s.kod_subjek,
      s.kod_kursus,
      s.subjek,
      s.course_code,
      s.nama_subjek,
      s.course_name,

      // nested common shapes
      isObject(s.subjek) ? (s.subjek.kod_subjek || s.subjek.nama_subjek || s.subjek.kod_kursus) : null,
      isObject(s.course) ? (s.course.kod_subjek || s.course.nama_subjek || s.course.course_code) : null,
      isObject(s.kursus) ? (s.kursus.kod_subjek || s.kursus.nama_subjek) : null,
    ];

    const val = candidates.find((x) => typeof x === "string" && x.trim());
    return val ? val.trim() : "-";
  };

  // ✅ Extract section safely (sometimes nested)
  const pickSection = (s) => {
    const candidates = [
      s.seksyen,
      s.section,
      s.kod_seksyen,
      s.seksyen_kelas,

      isObject(s.seksyen) ? (s.seksyen.seksyen || s.seksyen.section || s.seksyen.kod_seksyen) : null,
      isObject(s.section) ? (s.section.seksyen || s.section.section || s.section.kod) : null,
    ];

    const val = candidates.find((x) => (typeof x === "string" || typeof x === "number") && String(x).trim());
    return val != null ? String(val).trim() : "-";
  };

  // ✅ Remove placeholder/empty rows so you don’t see tons of "-"
  const isMeaningfulRow = (course, section) => {
    // keep only rows that actually have a course/section
    return (course && course !== "-" && course !== "[object Object]") ||
           (section && section !== "-");
  };

  const normalizeSchedule = (rows) => {
    return (rows || [])
      .map((s) => {
        const hariNum = s.hari ?? s.day ?? s.hari_num ?? null;
        const masaNum = s.masa ?? s.slot ?? s.time_slot ?? null;

        const day =
          s.nama_hari ||
          s.hari_name ||
          (hariNum != null ? (dayMap[Number(hariNum)] || `Day ${hariNum}`) : "-");

        const time =
          s.masa_label ||
          s.time_label ||
          s.jam || // sometimes already "09:00–09:50"
          (masaNum != null ? (timeMap[Number(masaNum)] || `Slot ${masaNum}`) : "-");

        const course = pickCourse(s);
        const section = pickSection(s);

        return {
          _hariNum: hariNum != null ? Number(hariNum) : 99,
          _masaNum: masaNum != null ? Number(masaNum) : 999,
          day,
          time,
          course,
          section,
        };
      })
      .filter((r) => isMeaningfulRow(r.course, r.section)) // ✅ drop empty placeholders
      .sort((a, b) => (a._hariNum - b._hariNum) || (a._masaNum - b._masaNum));
  };

  try {
    // Room info header (optional)
    const rooms = await TTMS.fetchRooms();
    const room = (rooms || []).find((r) => r.kod_ruang === roomCode);

    const scheduleRaw = await TTMS.fetchRoomSchedule(roomCode);
    const rows = Array.isArray(scheduleRaw) ? scheduleRaw : [];

    const normalized = normalizeSchedule(rows);

    const detailsHeader = room
      ? `
        <div class="mb-3">
          <div class="fw-bold">${room.kod_ruang} — ${room.nama_ruang || "-"}</div>
          <div class="text-muted small">
            ${room.jenis || "Others"} · Capacity: ${room.kapasiti || "-"} · Faculty: ${room.kod_fakulti || "-"}
          </div>
        </div>
      `
      : ``;

    const table =
      normalized.length === 0
        ? `<div class="alert alert-info">No scheduled classes found for this room.</div>`
        : `
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                ${normalized
                  .map(
                    (s) => `
                      <tr>
                        <td>${s.day}</td>
                        <td>${s.time}</td>
                        <td>${s.course}</td>
                        <td>${s.section}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `;

    this._openModal(
      `Room Schedule — ${roomCode}`,
      `
        <button class="btn btn-outline-secondary btn-sm mb-3" onclick="RoomController.modalBack()">
          ← Back
        </button>
        ${detailsHeader}
        ${table}
      `
    );
  } catch (e) {
    console.error(e);
    this._openModal(
      `Room Schedule — ${roomCode}`,
      `
        <button class="btn btn-outline-secondary btn-sm mb-3" onclick="RoomController.modalBack()">
          ← Back
        </button>
        <div class="alert alert-danger">Failed to load schedule.</div>
      `
    );
  }
},

// ✅ Filter rooms that are actually FREE at a chosen (hari, masa)
async filterRoomsFreeAtSlot(rooms, hari, masa) {
  const HARI = Number(hari);
  const MASA = Number(masa);

  const toNum = (v) => (v == null ? null : Number(v));

  // Detect whether a schedule row is a "real class" row
  const isMeaningful = (s) => {
    const course =
      s.kod_subjek ||
      s.nama_subjek ||
      (typeof s.subjek === "object" ? (s.subjek?.kod_subjek || s.subjek?.nama_subjek) : s.subjek) ||
      (typeof s.course === "object" ? (s.course?.kod_subjek || s.course?.course_code) : s.course);

    const section = s.seksyen || s.section || (typeof s.seksyen === "object" ? s.seksyen?.seksyen : null);

    return Boolean(
      (typeof course === "string" && course.trim() && course.trim() !== "-") ||
      (typeof section === "string" && section.trim() && section.trim() !== "-") ||
      (typeof section === "number")
    );
  };

  // Simple concurrency limiter (avoid spamming TTMS)
  const mapLimit = async (list, limit, fn) => {
    const out = [];
    let i = 0;

    const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        out[idx] = await fn(list[idx], idx);
      }
    });

    await Promise.all(workers);
    return out;
  };

  const results = await mapLimit(rooms || [], 8, async (r) => {
    const code = r.kod_ruang || r.kod_bilik || r.code;
    if (!code) return null;

    try {
      const schedRaw = await TTMS.fetchRoomSchedule(code);
      const sched = Array.isArray(schedRaw) ? schedRaw : [];

      // occupied if ANY meaningful row matches the chosen hari+masa
      const occupied = sched.some((s) => {
        const h = toNum(s.hari ?? s.day ?? s.hari_num);
        const m = toNum(s.masa ?? s.slot ?? s.time_slot);
        if (h !== HARI || m !== MASA) return false;
        return isMeaningful(s);
      });

      return occupied ? null : r;
    } catch (e) {
      // If schedule fetch fails, be conservative: treat as NOT available (or change to "return r" if you prefer)
      console.warn("Schedule fetch failed for", code, e);
      return null;
    }
  });

  return results.filter(Boolean);
}


};

document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById("roomListModal");

    modalEl?.addEventListener('hide.bs.modal', () => {
        if (modalEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    });
});

// Make globally available
window.RoomController = RoomController;