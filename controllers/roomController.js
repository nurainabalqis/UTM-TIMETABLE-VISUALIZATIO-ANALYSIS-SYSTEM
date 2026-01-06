// controllers/roomController.js
const RoomController = {
    // Load all rooms
    async loadRooms() {
        try {
            const user = AuthController.getCurrentUser();
            if (!user) return null;
            
            // Check if user has access (students don't have access)
            if (user.role === 'student') {
                AuthController.showAlert('Room utilization is not available for students', 'warning');
                return null;
            }
            
            const rooms = await TTMS.fetchRooms();
            const utilizationStats = await TTMS.fetchRoomUtilizationStats();
            
            return {
                rooms: rooms,
                utilizationStats: utilizationStats,
                total: rooms.length
            };
            
        } catch (error) {
            console.error('Error loading rooms:', error);
            AuthController.showAlert('Failed to load room data: ' + error.message, 'danger');
            return null;
        }
    },

    // Filter rooms
    filterRooms(rooms, filters = {}) {
        const {
            buildingFilter = 'all',
            typeFilter = 'all',
            capacityMin = 0,
            capacityMax = 1000
        } = filters;
        
        return rooms.filter(room => {
            let buildingMatch = true;
            let typeMatch = true;
            let capacityMatch = true;
            
            // Building filter
            if (buildingFilter !== 'all') {
                buildingMatch = room.blok === buildingFilter;
            }
            
            // Type filter
            if (typeFilter !== 'all') {
                typeMatch = room.jenis_bilik === typeFilter;
            }
            
            // Capacity filter
            const capacity = parseInt(room.kapasiti) || 0;
            capacityMatch = capacity >= capacityMin && capacity <= capacityMax;
            
            return buildingMatch && typeMatch && capacityMatch;
        });
    },

    // Get room statistics
    getRoomStatistics(rooms, utilizationStats) {
        const stats = {
            total: rooms.length,
            byType: {},
            byBuilding: {},
            byCapacity: { small: 0, medium: 0, large: 0 },
            averageUtilization: 0
        };
        
        // Count by type
        rooms.forEach(room => {
            const type = room.jenis_bilik || 'Unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // Count by building
            const building = room.blok || 'Unknown';
            stats.byBuilding[building] = (stats.byBuilding[building] || 0) + 1;
            
            // Count by capacity
            const capacity = parseInt(room.kapasiti) || 0;
            if (capacity <= 30) stats.byCapacity.small++;
            else if (capacity <= 100) stats.byCapacity.medium++;
            else stats.byCapacity.large++;
        });
        
        // Calculate average utilization
        if (utilizationStats && utilizationStats.length > 0) {
            const totalUtilization = utilizationStats.reduce((sum, item) => 
                sum + (item.utilization || 0), 0
            );
            stats.averageUtilization = Math.round(totalUtilization / utilizationStats.length);
        }
        
        return stats;
    },

    // Get room details
    async getRoomDetails(roomCode) {
        try {
            const rooms = await TTMS.fetchRooms();
            const room = rooms.find(r => r.kod_bilik === roomCode);
            
            if (room) {
                // Get courses scheduled in this room
                const courses = await TTMS.fetchCourses();
                const roomCourses = courses.filter(course => 
                    course.kod_bilik === roomCode
                );
                
                return {
                    ...room,
                    scheduledCourses: roomCourses.length,
                    weeklyHours: this.calculateWeeklyHours(roomCourses),
                    utilizationRate: this.calculateRoomUtilization(room, roomCourses)
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting room details:', error);
            return null;
        }
    },

    // Calculate weekly hours for a room
    calculateWeeklyHours(roomCourses) {
        // Simple calculation: assume 3 hours per course per week
        return roomCourses.length * 3;
    },

    // Calculate room utilization
    calculateRoomUtilization(room, roomCourses) {
        const capacity = parseInt(room.kapasiti) || 1;
        const totalStudents = roomCourses.reduce((sum, course) => 
            sum + (parseInt(course.bil_pelajar) || 0), 0
        );
        
        return Math.min(100, Math.round((totalStudents / (capacity * roomCourses.length || 1)) * 100));
    },

    // Get building list
    getBuildingList(rooms) {
        const buildings = new Set();
        rooms.forEach(room => {
            if (room.blok) {
                buildings.add(room.blok);
            }
        });
        return Array.from(buildings).sort();
    },

    // Get room type list
    getRoomTypeList(rooms) {
        const types = new Set();
        rooms.forEach(room => {
            if (room.jenis_bilik) {
                types.add(room.jenis_bilik);
            }
        });
        return Array.from(types).sort();
    },

    // Export rooms to CSV
    exportToCSV(rooms, filename = 'rooms_export.csv') {
        if (rooms.length === 0) {
            AuthController.showAlert('No rooms to export', 'warning');
            return;
        }
        
        const headers = ['Room Code', 'Type', 'Building', 'Capacity', 'Status', 'Facilities'];
        
        const csvContent = [
            headers.join(','),
            ...rooms.map(room => [
                `"${room.kod_bilik || ''}"`,
                `"${room.jenis_bilik || ''}"`,
                `"${room.blok || ''}"`,
                `"${room.kapasiti || '0'}"`,
                `"${room.status || 'Available'}"`,
                `"${room.facilities || 'Standard'}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        
        AuthController.showAlert(`Exported ${rooms.length} rooms to CSV`, 'success');
    },

    // Get peak hours for rooms
    async getPeakHours() {
        try {
            const courses = await TTMS.fetchCourses();
            const timeSlots = {
                '8-9 AM': 0, '9-10 AM': 0, '10-11 AM': 0, '11-12 PM': 0,
                '12-1 PM': 0, '2-3 PM': 0, '3-4 PM': 0, '4-5 PM': 0, '5-6 PM': 0
            };
            
            courses.forEach(course => {
                if (course.masa) {
                    const hour = this.extractHourFromTime(course.masa);
                    const slot = this.getTimeSlot(hour);
                    if (timeSlots[slot] !== undefined) {
                        timeSlots[slot]++;
                    }
                }
            });
            
            return Object.entries(timeSlots).map(([slot, count]) => ({
                slot: slot,
                count: count
            }));
            
        } catch (error) {
            console.error('Error getting peak hours:', error);
            return [];
        }
    },

    // Extract hour from time string
    extractHourFromTime(timeStr) {
        if (!timeStr) return null;
        const match = timeStr.match(/(\d{1,2}):/);
        return match ? parseInt(match[1]) : null;
    },

    // Get time slot from hour
    getTimeSlot(hour) {
        if (hour === null) return '8-9 AM';
        if (hour >= 8 && hour < 9) return '8-9 AM';
        if (hour >= 9 && hour < 10) return '9-10 AM';
        if (hour >= 10 && hour < 11) return '10-11 AM';
        if (hour >= 11 && hour < 12) return '11-12 PM';
        if (hour >= 12 && hour < 13) return '12-1 PM';
        if (hour >= 14 && hour < 15) return '2-3 PM';
        if (hour >= 15 && hour < 16) return '3-4 PM';
        if (hour >= 16 && hour < 17) return '4-5 PM';
        if (hour >= 17 && hour < 18) return '5-6 PM';
        return '8-9 AM';
    },

    // Get underutilized rooms
    getUnderutilizedRooms(rooms, utilizationStats, threshold = 30) {
        const underutilized = [];
        
        utilizationStats.forEach(stat => {
            if (stat.utilization < threshold) {
                const roomTypeRooms = rooms.filter(r => r.jenis_bilik === stat.type);
                underutilized.push({
                    type: stat.type,
                    utilization: stat.utilization,
                    rooms: roomTypeRooms.length,
                    sampleRooms: roomTypeRooms.slice(0, 3).map(r => r.kod_bilik)
                });
            }
        });
        
        return underutilized;
    },

    // Get room recommendations
    getRoomRecommendations(rooms, utilizationStats) {
        const recommendations = [];
        const underutilized = this.getUnderutilizedRooms(rooms, utilizationStats, 40);
        
        if (underutilized.length > 0) {
            recommendations.push({
                type: 'underutilized',
                message: `${underutilized.length} room types are underutilized (<40%)`,
                action: 'Consider redistributing classes to these rooms'
            });
        }
        
        // Check for room types with high utilization
        const overutilized = utilizationStats.filter(stat => stat.utilization > 80);
        if (overutilized.length > 0) {
            recommendations.push({
                type: 'overutilized',
                message: `${overutilized.length} room types are overutilized (>80%)`,
                action: 'Consider adding more sessions or expanding facilities'
            });
        }
        
        return recommendations;
    },

    // Draw room utilization chart
    drawUtilizationChart(containerId, utilizationStats) {
        if (!utilizationStats || utilizationStats.length === 0) {
            document.getElementById(containerId).innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-door-closed fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No room utilization data available</p>
                </div>
            `;
            return;
        }
        
        google.charts.setOnLoadCallback(() => {
            const data = new google.visualization.DataTable();
            data.addColumn('string', 'Room Type');
            data.addColumn('number', 'Utilization %');
            
            utilizationStats.forEach(item => {
                data.addRow([item.type, item.utilization || 0]);
            });
            
            const options = {
                title: 'Room Utilization by Type',
                pieHole: 0.4,
                colors: ['#1976D2', '#2196F3', '#64B5F6', '#90CAF9', '#BBDEFB'],
                backgroundColor: 'transparent',
                chartArea: { width: '90%', height: '80%' }
            };
            
            const chart = new google.visualization.PieChart(document.getElementById(containerId));
            chart.draw(data, options);
        });
    }
};

// Make globally available
window.RoomController = RoomController;