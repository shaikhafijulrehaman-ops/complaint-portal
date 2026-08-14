const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_BASE = API_BASE.endsWith('/api') ? API_BASE.slice(0, -4) : API_BASE;

// Helper to get headers with JWT token
const getHeaders = (isMultipart = false) => {
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('mic_grievance_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Helper to read file as Base64 DataURL
const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const Api = {
  // Authentication
  async registerStudent(email, password, acceptsToS) {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password, acceptsToS })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      return data;
    } catch (err) {
      // Return student-friendly error when network fails or raw database error occurs
      throw new Error(err.message || 'Unable to register account. Please try again.');
    }
  },

  async authenticateUser(email, password, role) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Authentication failed');
    
    // Store token and details
    if (data.token) {
      localStorage.setItem('mic_grievance_token', data.token);
      localStorage.setItem('mic_grievance_user', JSON.stringify({
        email: data.email,
        role: data.role,
        id: data.id
      }));
    }
    return data;
  },

  async checkStudentEmailExists(email) {
    const res = await fetch(`${API_BASE}/auth/check-email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Check email failed');
    return data.exists;
  },

  async sendPasswordResetOtp(email, otp) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to dispatch OTP');
    return data;
  },

  async resetStudentPassword(email, password) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password');
    return data;
  },

  // Complaints
  async createGrievance(category, complaintType, description, attachmentFile, studentEmail, extraFields = {}) {
    let attachmentData = null;
    let attachmentName = null;

    if (attachmentFile) {
      attachmentName = attachmentFile.name;
      attachmentData = await readFileAsBase64(attachmentFile);
    }

    const payload = {
      category,
      complaintType,
      description,
      attachmentName,
      attachmentData,
      busNumber: extraFields.busNumber || '',
      busRoute: extraFields.busRoute || ''
    };

    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Grievance submission failed');
      
      const complaint = data.complaint;
      return {
        id: complaint.complaint_id,
        mongo_id: complaint._id,
        studentEmail: complaint.student_email,
        category: complaint.category,
        complaintType: complaint.complaint_type,
        description: complaint.description,
        attachmentUrl: complaint.attachment_url ? `${BACKEND_BASE}${complaint.attachment_url}` : null,
        attachmentName: attachmentName,
        status: complaint.status,
        priority: complaint.priority,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
        assignedDepartment: complaint.assigned_department,
        resolutionNotes: complaint.resolution_notes,
        statusHistory: complaint.statusHistory || [],
        busNumber: complaint.bus_number,
        busRoute: complaint.bus_route
      };
    } catch (err) {
      throw new Error(err.message || 'Unable to submit your complaint right now. Please try again.');
    }
  },

  async syncComplaints() {
    const res = await fetch(`${API_BASE}/complaints`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync complaints');
    
    // Map database shape to standard React state shape
    return data.map(complaint => ({
      id: complaint.complaint_id,
      mongo_id: complaint._id,
      studentEmail: complaint.student_email,
      category: complaint.category,
      complaintType: complaint.complaint_type,
      description: complaint.description,
      attachmentUrl: complaint.attachment_url ? `${BACKEND_BASE}${complaint.attachment_url}` : null,
      status: complaint.status,
      priority: complaint.priority,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      assignedDepartment: complaint.assigned_department,
      resolutionNotes: complaint.resolution_notes,
      statusHistory: complaint.statusHistory || [],
      busNumber: complaint.bus_number,
      busRoute: complaint.bus_route
    }));
  },

  async trackGrievance(trackerId) {
    const res = await fetch(`${API_BASE}/complaints/track/${trackerId}`, {
      method: 'GET',
      headers: getHeaders()
    });
    const complaint = await res.json();
    if (!res.ok) throw new Error(complaint.message || 'Failed to track grievance');

    return {
      id: complaint.complaint_id,
      mongo_id: complaint._id,
      studentEmail: complaint.student_email,
      category: complaint.category,
      complaintType: complaint.complaint_type,
      description: complaint.description,
      attachmentUrl: complaint.attachment_url ? `${BACKEND_BASE}${complaint.attachment_url}` : null,
      status: complaint.status,
      priority: complaint.priority,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      assignedDepartment: complaint.assigned_department,
      resolutionNotes: complaint.resolution_notes,
      statusHistory: complaint.statusHistory || [],
      busNumber: complaint.bus_number,
      busRoute: complaint.bus_route
    };
  },

  async updateGrievance(id, updates) {
    const res = await fetch(`${API_BASE}/complaints/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update grievance');
    return data.complaint;
  },

  // Category Configuration CRUD
  async getCategories() {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load categories');
    return data;
  },

  async createCategory(name) {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create category');
    return data;
  },

  async updateCategory(id, updates) {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update category');
    return data;
  },

  async deleteCategory(id) {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete category');
    return data;
  },

  // Complaint Types Configuration CRUD
  async getComplaintTypes() {
    const res = await fetch(`${API_BASE}/complaint-types`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load complaint types');
    return data;
  },

  async createComplaintType(category, name) {
    const res = await fetch(`${API_BASE}/complaint-types`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ category, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add issue type');
    return data;
  },

  async updateComplaintType(id, updates) {
    const res = await fetch(`${API_BASE}/complaint-types/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update issue type');
    return data;
  },

  async deleteComplaintType(id) {
    const res = await fetch(`${API_BASE}/complaint-types/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete issue type');
    return data;
  },

  // Admin Dashboard aggregations
  async getAdminDashboard() {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load statistics.');
    return data;
  },

  // Change Admin Password
  async changeAdminPassword(currentPassword, newPassword) {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update credentials.');
    return data;
  },

  // Email Logs
  async syncEmailLogs() {
    const res = await fetch(`${API_BASE}/admin/email-logs`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync outbox logs');
    return data.map(log => ({
      id: log._id,
      timestamp: log.createdAt,
      recipient: log.recipient,
      subject: log.subject,
      body: log.body,
      complaintId: log.complaintId,
      category: log.category || 'General',
      status: log.status || 'Sent',
      failureReason: log.failureReason || ''
    }));
  },

  // Contact Helpline mappings
  async getContacts() {
    const res = await fetch(`${API_BASE}/contacts`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load contact listings');
    return data;
  },

  async updateContact(category, phone) {
    const res = await fetch(`${API_BASE}/contacts/${encodeURIComponent(category)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update department contact');
    return data.contacts;
  },

  // Session utility
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem('mic_grievance_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem('mic_grievance_token');
    localStorage.removeItem('mic_grievance_user');
  }
};

export { API_BASE, BACKEND_BASE };
