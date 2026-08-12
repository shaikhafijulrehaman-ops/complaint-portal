// Global State Management with LocalStorage persistence for instant testability
const STORAGE_KEYS = {
    COMPLAINTS: 'mic_grievance_complaints',
    CATEGORIES: 'mic_grievance_categories',
    COMPLAINT_TYPES: 'mic_grievance_types',
    CONTACTS: 'mic_grievance_contacts',
    USER: 'mic_grievance_current_user',
    EMAIL_LOGS: 'mic_grievance_email_logs'
};

// Initial dynamic categories
const DEFAULT_CATEGORIES = [
    "Hostel Issues",
    "Food Issues",
    "Campus Issues",
    "Complaint Against Student",
    "Complaint Against Faculty",
    "Bus Issues"
];

// Initial sub-categories (complaint types)
const DEFAULT_COMPLAINT_TYPES = {
    "Hostel Issues": [
        "Fan Not Working", "Light Not Working", "Water Problem", "Electricity Issue",
        "WiFi Issue", "Room Cleaning", "Washroom Cleaning", "Mess Hygiene",
        "Mess Timing", "Room Allocation", "Warden Behaviour", "Warden Harassment",
        "Security Issue", "Other"
    ],
    "Food Issues": [
        "Poor Food Quality", "High Prices", "Less Quantity", "Expired Food",
        "Mess Hygiene", "Dirty Utensils", "Canteen Behaviour", "Cafeteria Behaviour",
        "Other"
    ],
    "Campus Issues": [
        "Classroom Fan Not Working", "Projector Not Working", "Electrical Issue",
        "Water Not Available", "Broken Bench", "Campus Cleaning", "Parking Issue",
        "Internet Issue", "Laboratory Equipment", "Washroom Cleaning", "Other"
    ],
    "Complaint Against Student": [
        "Ragging", "Bullying", "Teasing", "Harassment", "Threatening",
        "Demanding Money", "Verbal Abuse", "Taking Photos Without Permission",
        "Asking Personal Information", "Other"
    ],
    "Complaint Against Faculty": [
        "Misbehavior", "Partiality", "Harassment", "Attendance Issue",
        "Marks Related Concern", "Mental Pressure", "Unprofessional Conduct",
        "Inappropriate Language", "Other"
    ],
    "Bus Issues": [
        "Driver Behaviour", "Rash Driving", "Bus Timing Issue", "Bus Not Arriving",
        "Bus Breakdown", "Bus Cleanliness", "Overcrowding", "Faculty Behaviour in Bus",
        "Bus Staff Behaviour", "Route Change", "Safety Issue", "Bus Condition", "Other"
    ]
};

// Initial Department Contacts
const DEFAULT_CONTACTS = {
    "Hostel Issues": "9959593027",
    "Food Issues": "9391781748",
    "Campus Issues": "9490123456", // Editable later
    "Complaint Against Student": "Discipline Committee (Email Only)",
    "Complaint Against Faculty": "Discipline Committee (Email Only)",
    "Bus Issues": "7330820239"
};

// Helper functions for storage
function getStorageItem(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

function setStorageItem(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Initial state fetchers
export function getCategories() {
    return getStorageItem(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
}

export function setCategories(categories) {
    setStorageItem(STORAGE_KEYS.CATEGORIES, categories);
}

export function getComplaintTypes() {
    return getStorageItem(STORAGE_KEYS.COMPLAINT_TYPES, DEFAULT_COMPLAINT_TYPES);
}

export function setComplaintTypes(types) {
    setStorageItem(STORAGE_KEYS.COMPLAINT_TYPES, types);
}

export function getContacts() {
    return getStorageItem(STORAGE_KEYS.CONTACTS, DEFAULT_CONTACTS);
}

export function setContacts(contacts) {
    setStorageItem(STORAGE_KEYS.CONTACTS, contacts);
}

export function getComplaints() {
    const list = getStorageItem(STORAGE_KEYS.COMPLAINTS, []);
    const seedIds = ["GRV-7294-A8", "GRV-1845-F2", "GRV-9821-C4", "GRV-4530-S9", "GRV-3129-D6"];
    const cleaned = list.filter(c => !seedIds.includes(c.id));
    if (cleaned.length !== list.length) {
        setStorageItem(STORAGE_KEYS.COMPLAINTS, cleaned);
    }
    return cleaned;
}

export function setComplaints(complaints) {
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);
}

export function getEmailLogs() {
    return getStorageItem(STORAGE_KEYS.EMAIL_LOGS, []);
}

export function setEmailLogs(logs) {
    setStorageItem(STORAGE_KEYS.EMAIL_LOGS, logs);
}

export function getCurrentUser() {
    return getStorageItem(STORAGE_KEYS.USER, null);
}

export function setCurrentUser(user) {
    setStorageItem(STORAGE_KEYS.USER, user);
}

// Real-time local state subscription listeners
const changeListeners = [];

export function subscribeToStateChanges(callback) {
    changeListeners.push(callback);
    return () => {
        const index = changeListeners.indexOf(callback);
        if (index !== -1) changeListeners.splice(index, 1);
    };
}

function notifyStateChange() {
    changeListeners.forEach(cb => {
        try {
            cb();
        } catch (e) {
            console.error("Error in state change listener:", e);
        }
    });
}

// State Mutation Helpers
export function addComplaint(complaint) {
    const complaints = getComplaints();
    complaints.unshift(complaint);
    setComplaints(complaints);
    notifyStateChange();
}

export function updateComplaint(id, updates) {
    const complaints = getComplaints();
    const updated = complaints.map(c => {
        if (c.id === id) {
            return { ...c, ...updates, updatedAt: new Date().toISOString() };
        }
        return c;
    });
    setComplaints(updated);
    notifyStateChange();
}

export function deleteComplaint(id) {
    const complaints = getComplaints();
    const filtered = complaints.filter(c => c.id !== id);
    setComplaints(filtered);
    notifyStateChange();
}

export function addCategory(categoryName) {
    if (!categoryName) return false;
    const categories = getCategories();
    if (categories.includes(categoryName)) return false;
    
    categories.push(categoryName);
    setCategories(categories);

    // Initialize types for this category
    const types = getComplaintTypes();
    types[categoryName] = ["Other"];
    setComplaintTypes(types);

    // Initialize contact
    const contacts = getContacts();
    contacts[categoryName] = "Discipline Committee (Email Only)";
    setContacts(contacts);

    return true;
}

export function deleteCategory(categoryName) {
    const categories = getCategories();
    const filtered = categories.filter(c => c !== categoryName);
    setCategories(filtered);

    // Cleanup types
    const types = getComplaintTypes();
    delete types[categoryName];
    setComplaintTypes(types);

    // Cleanup contacts
    const contacts = getContacts();
    delete contacts[categoryName];
    setContacts(contacts);

    return true;
}

export function addComplaintType(category, typeName) {
    const types = getComplaintTypes();
    if (!types[category]) types[category] = [];
    if (types[category].includes(typeName)) return false;

    // Insert before 'Other' if present
    const otherIdx = types[category].indexOf("Other");
    if (otherIdx !== -1) {
        types[category].splice(otherIdx, 0, typeName);
    } else {
        types[category].push(typeName);
    }
    setComplaintTypes(types);
    return true;
}

export function removeComplaintType(category, typeName) {
    const types = getComplaintTypes();
    if (!types[category]) return false;
    types[category] = types[category].filter(t => t !== typeName);
    setComplaintTypes(types);
    return true;
}

export function updateContact(category, contactVal) {
    const contacts = getContacts();
    contacts[category] = contactVal;
    setContacts(contacts);
}

export function logEmail(log) {
    const logs = getEmailLogs();
    logs.unshift({
        id: 'EML-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: new Date().toISOString(),
        ...log
    });
    setEmailLogs(logs);
}

export function getUserAccount(email) {
    return getStorageItem('mic_grievance_users', []).find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function saveUserAccount(email, password, acceptsToS) {
    const users = getStorageItem('mic_grievance_users', []);
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return false;
    }
    users.push({
        email: email,
        password: password,
        acceptsToS: acceptsToS,
        createdAt: new Date().toISOString()
    });
    localStorage.setItem('mic_grievance_users', JSON.stringify(users));
    return true;
}

export function updateUserPassword(email, newPassword) {
    const users = getStorageItem('mic_grievance_users', []);
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx !== -1) {
        users[idx].password = newPassword;
        localStorage.setItem('mic_grievance_users', JSON.stringify(users));
        return true;
    }
    return false;
}
