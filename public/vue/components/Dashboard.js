const Dashboard = {
  template: `
    <div>
      <h2>Dashboard</h2>
      <SessionFilter @filter="loadCourses" />
      <br><br>
      <CourseList :courses="courses" />
    </div>
  `,
  data() {
    return {
    courses: [],
    weeklyDistribution: null,
    isWeeklyLoading: false,
    weeklyChart: null
  };
},

  methods: {
    async loadCourses(sessionId) {
      const res = await api.getCourses(sessionId);
      this.courses = res.data;
    }
  },
  mounted() {
    this.loadCourses();
    this.loadWeeklyDistribution();
  }
};
