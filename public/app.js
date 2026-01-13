const { createApp } = Vue;

const app = createApp({
  setup() {
    const state = store;

    function init() {
      // Load logged-in user
      const user = AuthController.getCurrentUser();

      if (!user) {
        state.user = null;
        return;
      }

      state.user = user;

      // Load current academic session
      const currentSession = TTMS.getCurrentSession();
      state.currentSession = currentSession;
    }

    init();

    return { state };
  },

  template: `
    <!-- LOGIN -->
    <Login v-if="!state.user" />

    <!-- STUDENT -->
    <Dashboard
      v-else-if="state.user.role === 'student'"
    />

    <!-- LECTURER -->
    <RoomUtilization
      v-else-if="state.user.role === 'lecturer'"
    />

    <!-- ADMIN -->
    <Dashboard
      v-else-if="state.user.role === 'admin'"
    />
  `
});

/* ===============================
   REGISTER COMPONENTS
   =============================== */

app.component("Login", Login);
app.component("Dashboard", Dashboard);
app.component("SessionFilter", SessionFilter);
app.component("CourseList", CourseList);

app.mount("#app");

console.log("✅ Vue app mounted (TTMS-consistent)");
