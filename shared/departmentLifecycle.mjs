export function changeDepartmentLifecycle(configuration, name, action, people) {
  if (!name || name === 'General' || !['archive', 'restore', 'delete'].includes(action)) throw new Error('Choose a department and a valid action. Company leadership cannot be removed.');
  const records = configuration.departments || [];
  const record = records.find(row => row.name === name);
  if (!record && !people.some(person => person.department === name)) throw new Error('Department not found.');
  if (action === 'delete') {
    if (people.some(person => person.department === name) || record?.temporaryMembers?.length) throw new Error('Move all permanent and temporary members before deleting this department. You can archive it instead.');
    return { ...configuration, departments: records.filter(row => row.name !== name), departmentChart: (configuration.departmentChart || []).filter(row => row.name !== name), policies: configuration.policies.filter(row => row.department !== name) };
  }
  const next = { head: '', targets: '', responsibilities: '', ...record, name, archived: action === 'archive' };
  return { ...configuration, departments: [...records.filter(row => row.name !== name), next] };
}
