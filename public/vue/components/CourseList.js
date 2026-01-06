const CourseList = {
props: ["courses"],
template: `
<ul>
<li v-for="c in courses" :key="c.id">
{{ c.code }} - {{ c.name }}
</li>
</ul>
`
};