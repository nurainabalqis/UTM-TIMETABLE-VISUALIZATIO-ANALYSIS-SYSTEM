// auth.js
const auth = {
  user: null,

  async loadUser() {
    try {
      const res = await api.getCurrentUser();
      this.user = res.data;
      return this.user;
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  },

  hasRole(role) {
    return this.user && this.user.role === role;
  },

  isAuthenticated() {
    return this.user !== null;
  }
};