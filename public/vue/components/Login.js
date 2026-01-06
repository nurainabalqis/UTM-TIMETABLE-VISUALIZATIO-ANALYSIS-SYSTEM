
/*const Login = {
template: `
<div>
<h2>Login</h2>
<input v-model="email" placeholder="Email" />
<br><br>
<input v-model="password" type="password" placeholder="Password" />
<br><br>
<button @click="submit">Login</button>
</div>
`,
data() {
return { email: "", password: "" };
},
methods: {
async submit() {
await api.login({ email: this.email, password: this.password });
this.$emit("success");
}
}
};

*/