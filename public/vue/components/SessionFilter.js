const SessionFilter = {
template: `
<select v-model="selected" @change="emitFilter">
<option value="">All Sessions</option>
<option v-for="s in sessions" :value="s.id">
{{ s.name }}
</option>
</select>
`,
data() {
return { sessions: [], selected: "" };
},
methods: {
emitFilter() {
this.$emit("filter", this.selected);
}
},
async mounted() {
const res = await api.getSessions();
this.sessions = res.data;
}
};