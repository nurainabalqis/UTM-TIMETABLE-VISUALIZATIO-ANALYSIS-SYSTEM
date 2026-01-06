const { createApp } = Vue;


createApp({
data() {
return { view: "login" };
},
async created() {
try {
await auth.loadUser();
this.view = "dashboard";
} catch {
this.view = "login";
}
},
template: `
<Login v-if="view === 'login'" @success="view='dashboard'" />
<Dashboard v-if="view === 'dashboard'" />
`
})
.component("Login", Login)
.component("Dashboard", Dashboard)
.component("SessionFilter", SessionFilter)
.component("CourseList", CourseList)
.mount("#app");