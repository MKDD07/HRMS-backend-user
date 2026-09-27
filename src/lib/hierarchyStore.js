// Enterprise Organizational Hierarchy Store (Strictly Keyed by user_id)
// Manages reporting lines, tree building, cycle detection, drag-and-drop reassignments,
// and enforces a hard ceiling of 5 stages (Levels 1 to 5).

const STORAGE_KEY = 'pulse_org_hierarchy_v1';

// Default corporate hierarchy configuration mapping live user_ids
export const DEFAULT_HIERARCHY_MAP = {
  'TYS-1021': {
    user_id: 'TYS-1021',
    reports_to: null, // Level 1 - Top Executive / Principal Architect
    job_title: 'Chief Technology Officer & Principal Architect',
    custom_notes: 'Executive Leadership Committee',
    order: 0
  },
  'TYS-1008': {
    user_id: 'TYS-1008',
    reports_to: 'TYS-1021', // Level 2 - Reports to Mohit Kataria
    job_title: 'VP of Engineering & Cloud Infrastructure',
    custom_notes: 'Reports to CTO',
    order: 0
  },
  'TYS-1003': {
    user_id: 'TYS-1003',
    reports_to: 'TYS-1021', // Level 2 - Reports to Mohit Kataria
    job_title: 'Head of People Operations & HR Director',
    custom_notes: 'Reports to CTO',
    order: 1
  },
  'TYS-1005': {
    user_id: 'TYS-1005',
    reports_to: 'TYS-1008', // Level 3 - Reports to Rajesh Sharma
    job_title: 'Lead Full Stack & Mobile Engineer',
    custom_notes: 'Reports to VP Engineering',
    order: 0
  }
};

export const STAGE_DESCRIPTIONS = {
  1: { label: 'Stage 1: Executive / C-Suite', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  2: { label: 'Stage 2: Director / VP', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  3: { label: 'Stage 3: Manager / Lead', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  4: { label: 'Stage 4: Senior / Staff', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  5: { label: 'Stage 5: Associate / Junior', color: 'bg-slate-100 text-slate-800 border-slate-200' }
};

export const MAX_STAGES = 5;

// Load hierarchy map from localStorage or default
export function getHierarchyMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading hierarchy map:', e);
  }
  saveHierarchyMap(DEFAULT_HIERARCHY_MAP);
  return { ...DEFAULT_HIERARCHY_MAP };
}

// Persist hierarchy map
export function saveHierarchyMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error writing hierarchy map:', e);
  }
}

// Compute stage level (1 to 5) for each user_id in the map
export function computeLevels(map) {
  const levels = {};

  const getLevel = (userId, visited = new Set()) => {
    if (visited.has(userId)) return 1; // Safeguard against circular reference
    visited.add(userId);

    const record = map[userId];
    if (!record || !record.reports_to || !map[record.reports_to]) {
      return 1;
    }
    return 1 + getLevel(record.reports_to, visited);
  };

  Object.keys(map).forEach((userId) => {
    levels[userId] = Math.min(MAX_STAGES, getLevel(userId));
  });

  return levels;
}

// Get the subtree height for a given user_id
export function getSubtreeHeight(map, userId) {
  const children = Object.values(map).filter((item) => item.reports_to === userId);
  if (children.length === 0) return 1;
  let maxHeight = 0;
  for (const child of children) {
    maxHeight = Math.max(maxHeight, getSubtreeHeight(map, child.user_id));
  }
  return 1 + maxHeight;
}

// Check if a move is permissible
export function canSetManager(map, targetUserId, newManagerId) {
  if (!targetUserId) {
    return { allowed: false, reason: 'Invalid target user ID.' };
  }

  // Same user
  if (targetUserId === newManagerId) {
    return { allowed: false, reason: 'An employee cannot report to themselves.' };
  }

  // If making them a top-level root (newManagerId === null)
  if (!newManagerId) {
    // Top-level root has level 1, its subtree will start at level 1.
    // That can only decrease or keep depths within limits, so always allowed.
    return { allowed: true };
  }

  // Check cycle: is newManagerId in targetUserId's subordinate chain?
  const isDescendant = (ancestorId, currentId, visited = new Set()) => {
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const item = map[currentId];
    if (!item || !item.reports_to) return false;
    if (item.reports_to === ancestorId) return true;
    return isDescendant(ancestorId, item.reports_to, visited);
  };

  if (isDescendant(targetUserId, newManagerId)) {
    return {
      allowed: false,
      reason: 'Circular hierarchy loop detected: The target person is already in this manager’s reporting chain.'
    };
  }

  // Check depth limit (Max 5 stages)
  const currentLevels = computeLevels(map);
  const managerLevel = currentLevels[newManagerId] || 1;
  const targetSubtreeHeight = getSubtreeHeight(map, targetUserId);

  const potentialMaxLevel = managerLevel + targetSubtreeHeight;
  if (potentialMaxLevel > MAX_STAGES) {
    return {
      allowed: false,
      reason: `Cannot assign reporting: Total depth would reach ${potentialMaxLevel} stages (Hierarchy allows maximum ${MAX_STAGES} stages).`
    };
  }

  return { allowed: true };
}

// Set reporting manager
export function setReportingManager(targetUserId, newManagerId, customJobTitle = null) {
  const map = getHierarchyMap();
  const check = canSetManager(map, targetUserId, newManagerId);

  if (!check.allowed) {
    return { success: false, reason: check.reason, map };
  }

  if (!map[targetUserId]) {
    map[targetUserId] = {
      user_id: targetUserId,
      reports_to: newManagerId,
      job_title: customJobTitle || 'Team Member',
      order: 0
    };
  } else {
    map[targetUserId].reports_to = newManagerId;
    if (customJobTitle) {
      map[targetUserId].job_title = customJobTitle;
    }
  }

  saveHierarchyMap(map);
  return { success: true, map };
}

// Update Job Title for a specific user_id
export function updateJobTitle(userId, newJobTitle) {
  const map = getHierarchyMap();
  if (!map[userId]) {
    map[userId] = {
      user_id: userId,
      reports_to: null,
      job_title: newJobTitle,
      order: 0
    };
  } else {
    map[userId].job_title = newJobTitle;
  }
  saveHierarchyMap(map);
  return map;
}

// Remove from hierarchy (detach and make top root)
export function makeTopLevelRoot(userId) {
  const map = getHierarchyMap();
  if (map[userId]) {
    map[userId].reports_to = null;
    saveHierarchyMap(map);
  }
  return map;
}

// Reset hierarchy to default official structure
export function resetHierarchyToDefault() {
  saveHierarchyMap(DEFAULT_HIERARCHY_MAP);
  return { ...DEFAULT_HIERARCHY_MAP };
}

// Build hierarchical tree nodes
export function buildHierarchyTree(employeesList, hierarchyMap) {
  const levels = computeLevels(hierarchyMap);

  // Map employee details by user_id
  const empLookup = {};
  employeesList.forEach((e) => {
    const uid = e.userid || e.user_id;
    empLookup[uid] = e;
  });

  // Ensure all employees are represented in map or as available
  const allNodes = {};

  // First create nodes for map entries
  Object.keys(hierarchyMap).forEach((uid) => {
    const h = hierarchyMap[uid];
    const emp = empLookup[uid] || {
      userid: uid,
      first_name: uid,
      last_name: '',
      department: 'Engineering & Technology',
      designation: h.job_title || 'Specialist',
      email: `${uid.toLowerCase()}@hrtiva.com`
    };

    allNodes[uid] = {
      id: uid,
      user_id: uid,
      employee: emp,
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || uid,
      job_title: h.job_title || emp.designation || 'Staff Member',
      department: emp.department || 'Corporate',
      profile_pic_url: emp.profile_pic_url,
      reports_to: h.reports_to,
      stage_level: levels[uid] || 1,
      children: []
    };
  });

  // Attach any employees not yet explicitly in the hierarchy map as roots or unassigned
  employeesList.forEach((emp) => {
    const uid = emp.userid || emp.user_id;
    if (!allNodes[uid]) {
      allNodes[uid] = {
        id: uid,
        user_id: uid,
        employee: emp,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || uid,
        job_title: emp.designation || 'Employee',
        department: emp.department || 'Corporate',
        profile_pic_url: emp.profile_pic_url,
        reports_to: null,
        stage_level: 1,
        children: []
      };
    }
  });

  // Wire up children
  const roots = [];
  Object.values(allNodes).forEach((node) => {
    if (node.reports_to && allNodes[node.reports_to]) {
      allNodes[node.reports_to].children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort roots and children by stage_level, then name
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      if (a.stage_level !== b.stage_level) return a.stage_level - b.stage_level;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };

  sortNodes(roots);

  return { roots, allNodes, levels };
}
