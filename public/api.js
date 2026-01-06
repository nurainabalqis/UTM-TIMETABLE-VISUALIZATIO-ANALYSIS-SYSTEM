axios.defaults.baseURL = "http://localhost:3000";
axios.defaults.withCredentials = true;


const api = {
login(data) {
return axios.post("/login", data);
},


getCurrentUser() {
return axios.get("/me");
},


getSessions() {
return axios.get("/sessions");
},


getCourses(sessionId) {
let url = "/courses";
if (sessionId) url += `?session_id=${sessionId}`;
return axios.get(url);
}
};