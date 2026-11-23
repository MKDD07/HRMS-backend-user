export function departmentMembers(name, people, temporaryMembers = []) {
  if (name === 'General') return people;
  const temporary = new Set(temporaryMembers);
  return people.filter(person => person.department === name || temporary.has(person.id || person.userid));
}
export function availableTeamPeople(people, members) {
  const ids = new Set(members.map(person => person.id || person.userid));
  return people.filter(person => !ids.has(person.id || person.userid));
}
