import React, { useState, useEffect, useRef } from 'react';
import { Api } from './api.js?v=1.3';
import { Icon } from './components/Icon.jsx';
import { DEFAULT_CATEGORIES, DEFAULT_COMPLAINT_TYPES, DEFAULT_CONTACTS } from './js/state.js?v=1.3';

export default function App() {
  // Navigation & Session States
  const [view, setView] = useState('landing'); // landing, login, privacy, student-dashboard, raise-complaint, success, track, admin
  const [currentUser, setCurrentUser] = useState(null);
  
  // Auth Modes & Form Values
  const [authMode, setAuthMode] = useState('login'); // login, register, forgot, otp, reset
  const [authRole, setAuthRole] = useState('student'); // student, admin
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authToS, setAuthToS] = useState(false);
  const [authOtp, setAuthOtp] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Recovery verification states
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Student Dashboard State
  const [studentComplaints, setStudentComplaints] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);

  // Raise Complaint Form State
  const [raiseCategory, setRaiseCategory] = useState('');
  const [raiseType, setRaiseType] = useState('');
  const [raiseDescription, setRaiseDescription] = useState('');
  const [raiseBusNumber, setRaiseBusNumber] = useState('');
  const [raiseBusRoute, setRaiseBusRoute] = useState('');
  const [raiseFile, setRaiseFile] = useState(null);
  const [raiseSubmitLoading, setRaiseSubmitLoading] = useState(false);

  // Success Screen Context
  const [successComplaint, setSuccessComplaint] = useState(null);

  // Tracking View State
  const [trackSearchId, setTrackSearchId] = useState('');
  const [trackedComplaint, setTrackedComplaint] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);

  // Admin Dashboard State
  const [adminTab, setAdminTab] = useState('dashboard'); // dashboard, complaints, contacts, email-logs
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [allComplaints, setAllComplaints] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [contactsMap, setContactsMap] = useState({});

  // Admin Filters
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterCategory, setAdminFilterCategory] = useState('all');
  const [adminFilterStatus, setAdminFilterStatus] = useState('all');
  const [adminFilterPriority, setAdminFilterPriority] = useState('all');

  // Complaint Details Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [updatePriority, setUpdatePriority] = useState('');
  const [updateResolution, setUpdateResolution] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // Helpline Edit Contacts
  const [editingContacts, setEditingContacts] = useState({});

  // Email Log Preview Selection
  const [selectedEmailLog, setSelectedEmailLog] = useState(null);

  // Auto-refresh timer for Admin dashboard (realtime polling fallback)
  useEffect(() => {
    let interval;
    if (currentUser && currentUser.role === 'admin' && view === 'admin') {
      interval = setInterval(() => {
        loadAdminData(true); // Silent reload
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [currentUser, view]);

  // Load session on startup
  useEffect(() => {
    const user = Api.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === 'admin') {
        setView('admin');
        loadAdminData();
      } else {
        setView('student-dashboard');
        loadStudentComplaints(user.email);
      }
    }
  }, []);

  // Global Toast Dispatcher
  const showToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // ----------------------------------------------------
  // API Core Action Handlers
  // ----------------------------------------------------

  const loadStudentComplaints = async (email) => {
    setStudentLoading(true);
    try {
      const list = await Api.syncComplaints();
      setStudentComplaints(list);
    } catch (err) {
      showToast('Sync Error', err.message, 'error');
    } finally {
      setStudentLoading(false);
    }
  };

  const loadAdminData = async (silent = false) => {
    if (!silent) setAdminLoading(true);
    try {
      const [list, logs, contacts] = await Promise.all([
        Api.syncComplaints(),
        Api.syncEmailLogs(),
        Api.getContacts()
      ]);
      setAllComplaints(list);
      setEmailLogs(logs);
      setContactsMap(contacts);
      setEditingContacts(contacts);
      
      // Auto-select first email log if none selected
      if (logs.length > 0 && !selectedEmailLog) {
        setSelectedEmailLog(logs[0]);
      }
    } catch (err) {
      if (!silent) showToast('Dashboard Sync Error', err.message, 'error');
    } finally {
      if (!silent) setAdminLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const user = await Api.authenticateUser(authEmail, authPassword, authRole);
        setCurrentUser(user);
        showToast('Login Successful', `Welcome back ${roleLabel(user.role)}.`, 'success');
        
        // Reset login form fields
        setAuthPassword('');
        
        if (user.role === 'admin') {
          setView('admin');
          loadAdminData();
        } else {
          setView('privacy');
        }
      } 
      else if (authMode === 'register') {
        if (authPassword !== authConfirmPassword) {
          throw new Error('Passwords do not match. Please verify.');
        }
        if (!authToS) {
          throw new Error('You must accept the Terms of Service to register.');
        }
        await Api.registerStudent(authEmail, authPassword, authToS);
        showToast('Account Created', 'Registration successful. You can now log in.', 'success');
        setAuthMode('login');
        setAuthPassword('');
        setAuthConfirmPassword('');
      } 
      else if (authMode === 'forgot') {
        const exists = await Api.checkStudentEmailExists(authEmail);
        if (!exists) {
          throw new Error('No account found with this email. Please sign up.');
        }
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        setResetEmail(authEmail);
        setResetOtp(generatedOtp);

        await Api.sendPasswordResetOtp(authEmail, generatedOtp);
        showToast('OTP Dispatched', 'A 6-digit verification code has been logged to the outbox.', 'success');
        setAuthMode('otp');
        setAuthOtp('');
      } 
      else if (authMode === 'otp') {
        if (authOtp.trim() !== resetOtp) {
          throw new Error('Invalid OTP code. Please verify and try again.');
        }
        showToast('Code Verified', 'Please set your new account password.', 'success');
        setAuthMode('reset');
        setAuthPassword('');
        setAuthConfirmPassword('');
      } 
      else if (authMode === 'reset') {
        if (authPassword !== authConfirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await Api.resetStudentPassword(resetEmail, authPassword);
        showToast('Password Updated', 'You can now log in using your new credentials.', 'success');
        setAuthMode('login');
        setResetEmail('');
        setResetOtp('');
        setAuthPassword('');
        setAuthConfirmPassword('');
      }
    } catch (err) {
      setAuthError(err.message);
      showToast('Access Error', err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGrievanceSubmit = async (e) => {
    e.preventDefault();
    if (!raiseCategory || !raiseType || !raiseDescription) {
      showToast('Validation Error', 'Please complete all required fields.', 'warning');
      return;
    }
    setRaiseSubmitLoading(true);

    try {
      const extraFields = {};
      if (raiseCategory === 'Bus Issues') {
        extraFields.busNumber = raiseBusNumber;
        extraFields.busRoute = raiseBusRoute;
      }

      const complaint = await Api.createGrievance(
        raiseCategory,
        raiseType,
        raiseDescription,
        raiseFile,
        currentUser.email,
        extraFields
      );

      setSuccessComplaint(complaint);
      showToast('Grievance Logged', `Grievance submitted successfully. ID: ${complaint.id}`, 'success');
      
      // Reset form values
      setRaiseCategory('');
      setRaiseType('');
      setRaiseDescription('');
      setRaiseBusNumber('');
      setRaiseBusRoute('');
      setRaiseFile(null);

      setView('success');
    } catch (err) {
      showToast('Submission Failed', err.message, 'error');
    } finally {
      setRaiseSubmitLoading(false);
    }
  };

  const handleTrackingSearch = async (e) => {
    e.preventDefault();
    if (!trackSearchId.trim()) return;
    setTrackError('');
    setTrackLoading(true);
    setTrackedComplaint(null);

    try {
      const complaint = await Api.trackGrievance(trackSearchId.trim());
      setTrackedComplaint(complaint);
      showToast('Record Synced', 'Complaint details retrieved.', 'success');
    } catch (err) {
      setTrackError(err.message);
      showToast('Search Failed', err.message, 'error');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleUpdateComplaintSubmit = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);

    try {
      const updates = {
        status: updateStatus,
        priority: updatePriority,
        resolutionNotes: updateResolution
      };
      await Api.updateGrievance(selectedComplaint.mongo_id, updates);
      showToast('Update Successful', 'Complaint record modified.', 'success');
      setSelectedComplaint(null);
      loadAdminData(true); // Reload lists
    } catch (err) {
      showToast('Update Failed', err.message, 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdateContactSubmit = async (category, phone) => {
    try {
      const updatedContacts = await Api.updateContact(category, phone);
      setContactsMap(updatedContacts);
      setEditingContacts(updatedContacts);
      showToast('Contact Saved', `Helpline settings updated for ${category}.`, 'success');
    } catch (err) {
      showToast('Save Failed', err.message, 'error');
    }
  };

  const handleLogout = () => {
    Api.logout();
    setCurrentUser(null);
    setView('landing');
    setAuthEmail('');
    setAuthPassword('');
    showToast('Session Ended', 'Logged out securely.', 'success');
  };

  const roleLabel = (role) => (role === 'admin' ? 'Administrator' : 'Student');

  // ----------------------------------------------------
  // Dropdown Helpers
  // ----------------------------------------------------
  const handleCategoryChange = (val) => {
    setRaiseCategory(val);
    setRaiseType('');
  };

  const subIssueTypes = DEFAULT_COMPLAINT_TYPES[raiseCategory] || [];

  // File picker handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Size Exceeded', 'Evidence file must be smaller than 5MB.', 'warning');
        return;
      }
      setRaiseFile(file);
    }
  };

  // ----------------------------------------------------
  // Computed Statistics (Admin Panel Dashboard)
  // ----------------------------------------------------
  const totalCount = allComplaints.length;
  const pendingCount = allComplaints.filter((c) => ['Submitted', 'Under Review', 'Assigned'].includes(c.status)).length;
  const resolvedCount = allComplaints.filter((c) => ['Resolved', 'Closed'].includes(c.status)).length;
  const todayCount = allComplaints.filter((c) => new Date(c.createdAt).toDateString() === new Date().toDateString()).length;

  const categoryCounts = {};
  DEFAULT_CATEGORIES.forEach((cat) => {
    categoryCounts[cat] = allComplaints.filter((c) => c.category === cat).length;
  });

  const maxCategoryCount = Math.max(...Object.values(categoryCounts), 1);

  // ----------------------------------------------------
  // Admin Complaint List Filtering
  // ----------------------------------------------------
  const filteredComplaints = allComplaints.filter((c) => {
    const matchesSearch =
      c.id.toLowerCase().includes(adminSearch.toLowerCase()) ||
      c.studentEmail.toLowerCase().includes(adminSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(adminSearch.toLowerCase());

    const matchesCategory = adminFilterCategory === 'all' || c.category === adminFilterCategory;
    const matchesStatus = adminFilterStatus === 'all' || c.status === adminFilterStatus;
    const matchesPriority = adminFilterPriority === 'all' || c.priority === adminFilterPriority;

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item ${t.type} animate-fade-in`}>
            <div className="toast-title">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor:
                    t.type === 'error'
                      ? 'var(--danger-light)'
                      : t.type === 'warning'
                      ? 'var(--warning-light)'
                      : 'var(--success-light)',
                  color:
                    t.type === 'error'
                      ? 'var(--danger)'
                      : t.type === 'warning'
                      ? 'var(--warning)'
                      : 'var(--success)',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}
              >
                {t.type === 'error' ? '✕' : t.type === 'warning' ? '!' : '✓'}
              </span>
              <span>{t.title}</span>
            </div>
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
        ))}
      </div>

      {/* Global Header */}
      {view !== 'admin' && (
        <header className="site-header">
          <div className="logo-container" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
            <img src="/assets/mic-logo.png" alt="DVR & Dr. HS MIC College Logo" className="college-logo" onError={(e) => { e.target.src = 'https://via.placeholder.com/48?text=MIC'; }} />
            <div className="college-names">
              <span className="college-name-main">DVR & Dr. HS MIC</span>
              <span className="college-name-sub">College of Technology</span>
            </div>
          </div>
          <div className="header-actions">
            {currentUser ? (
              <>
                <span className="text-sm font-semibold text-muted mr-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="avatar" size={16} /> {currentUser.email.split('@')[0].toUpperCase()}
                </span>
                <button className="btn btn-outline" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <button className="btn btn-outline" onClick={() => { setAuthMode('login'); setView('login'); }}>Login</button>
            )}
          </div>
        </header>
      )}

      {/* Dynamic SPA Viewport */}
      <main className="flex-1 w-full">

        {/* 1. LANDING VIEW */}
        {view === 'landing' && (
          <div>
            <section className="hero-section animate-slide-up">
              <div className="hero-tag">DVR & Dr. HS MIC College of Technology</div>
              <h1 className="hero-title">Student Grievance Portal</h1>
              <p className="hero-subtitle">
                A secure and confidential platform where every student can raise concerns without fear. 
                Your identity remains protected, your information is securely encrypted, and every complaint 
                is reviewed only by authorized grievance officers.
              </p>
              <div className="hero-buttons">
                <button className="btn btn-primary btn-lg hover-lift" onClick={() => {
                  if (currentUser) {
                    setView('privacy');
                  } else {
                    setAuthMode('register');
                    setView('login');
                  }
                }}>
                  <Icon name="plus" size={18} /> File New Grievance
                </button>
                <button className="btn btn-secondary btn-lg hover-lift" onClick={() => setView('track')}>
                  <Icon name="search" size={18} /> Track Grievance Status
                </button>
              </div>
            </section>

            {/* Feature Highlights Grid */}
            <section className="landing-section">
              <h2 className="landing-section-title">Confidentiality & Fast Resolution</h2>
              <p className="landing-section-subtitle">
                Built to match international data privacy and security benchmarks for academic complaint management.
              </p>
              
              <div className="trust-grid">
                <div className="trust-card">
                  <div className="trust-icon-wrapper">
                    <Icon name="shield" size={24} />
                  </div>
                  <h3 className="trust-title">Confidential Submissions</h3>
                  <p className="trust-description">
                    Your details are encrypted and viewable only by authorized discipline committees. Other students or staff have zero access.
                  </p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon-wrapper">
                    <Icon name="mail" size={24} />
                  </div>
                  <h3 className="trust-title">Automated Email Routing</h3>
                  <p className="trust-description">
                    Grievances are auto-assigned and forwarded directly to the personal inboxes of respective heads based on issue categories.
                  </p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon-wrapper">
                    <Icon name="clock" size={24} />
                  </div>
                  <h3 className="trust-title">Active Timeline Tracking</h3>
                  <p className="trust-description">
                    Every complaint receives an alphanumeric tracking ID. You can query its resolution stages in real-time.
                  </p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon-wrapper">
                    <Icon name="check-circle" size={24} />
                  </div>
                  <h3 className="trust-title">Dynamic Resolutions</h3>
                  <p className="trust-description">
                    Discipline heads can modify priority settings, state status updates, and attach written resolution summaries directly.
                  </p>
                </div>
              </div>
            </section>

            {/* Process Timeline */}
            <section className="landing-section" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
              <h2 className="landing-section-title">How It Works</h2>
              <p className="landing-section-subtitle">A simple three-step process to file, route, and resolve grievances.</p>
              
              <div className="how-it-works-timeline">
                <div className="how-line"></div>
                <div className="how-step">
                  <div className="how-node">1</div>
                  <h4 className="how-step-title">File Your Grievance</h4>
                  <p className="how-step-desc">Accept privacy terms, select category, specify concern details, and upload optional evidence files.</p>
                </div>
                <div className="how-step">
                  <div className="how-node">2</div>
                  <h4 className="how-step-title">Auto-Department Routing</h4>
                  <p className="how-step-desc">The engine forwards logs to relevant heads (Hostel, Canteen, HOD, Academic Board) instantly.</p>
                </div>
                <div className="how-step">
                  <div className="how-node">3</div>
                  <h4 className="how-step-title">Resolve and Review</h4>
                  <p className="how-step-desc">Review progress updates on the portal and verify resolution comments upon completion.</p>
                </div>
              </div>
            </section>

            {/* FAQs Accordion */}
            <section className="landing-section">
              <h2 className="landing-section-title">Frequently Asked Questions</h2>
              <p className="landing-section-subtitle">Quick guides explaining data privacy, response times, and portal operations.</p>
              
              <div className="faq-list">
                <div className="faq-item">
                  <h4 className="faq-question">Will my college lecturers know I submitted a complaint?</h4>
                  <p className="faq-answer">
                    No. The grievance portal utilizes end-to-end encryption. Staff or faculty members cannot inspect dashboard records. Reports are routed exclusively to the respective head or HOD for that category.
                  </p>
                </div>
                <div className="faq-item">
                  <h4 className="faq-question">How do I track my submitted grievance?</h4>
                  <p className="faq-answer">
                    On successful submission, the portal generates a tracking ID (e.g. CMP-A5B2F9). You can input this code in the "Track Grievance Status" section anytime without logging in.
                  </p>
                </div>
                <div className="faq-item">
                  <h4 className="faq-question">How long does it take for a complaint to be resolved?</h4>
                  <p className="faq-answer">
                    As per DVR & Dr. HS MIC College policies, urgent matters (e.g. water shortage or bus breakdowns) are reviewed within 24 hours. General matters are resolved within 3-5 academic days.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. AUTHENTICATION (LOGIN / REGISTER / FORGOT / RESET) */}
        {view === 'login' && (
          <div className="auth-container animate-slide-up">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  {authMode === 'login' && 'Portal Access'}
                  {authMode === 'register' && 'Student Registration'}
                  {authMode === 'forgot' && 'Reset Password'}
                  {authMode === 'otp' && 'Verify Code'}
                  {authMode === 'reset' && 'Set New Password'}
                </h2>
                <p className="text-sm text-muted">
                  {authMode === 'login' && 'Identify yourself to access college grievance resources'}
                  {authMode === 'register' && 'Create your secure credentials to submit complaints'}
                  {authMode === 'forgot' && 'Verify your email to recover student credentials'}
                  {authMode === 'otp' && 'Enter the 6-digit OTP code sent to your email'}
                  {authMode === 'reset' && 'Enter your new credentials below'}
                </p>
              </div>

              {authMode === 'login' && (
                <div className="auth-tabs">
                  <button className={`auth-tab-btn ${authRole === 'student' ? 'active' : ''}`} onClick={() => setAuthRole('student')}>Student Access</button>
                  <button className={`auth-tab-btn ${authRole === 'admin' ? 'active' : ''}`} onClick={() => setAuthRole('admin')}>Administrator</button>
                </div>
              )}

              {authError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-xs font-semibold">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                
                {/* Email (Shown in login, register, forgot modes) */}
                {['login', 'register', 'forgot'].includes(authMode) && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-email">College Email Address</label>
                    <div className="input-icon-container">
                      <span className="input-icon"><Icon name="mail" size={18} /></span>
                      <input className="form-control" type="email" id="auth-email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder={authRole === 'student' ? 'rollnumber@mictech.ac.in' : 'admin@mictech.ac.in'} required />
                    </div>
                    <span className="text-xs text-muted mt-1.5 block">
                      {authRole === 'student' ? 'Must be a verified college address (ends with @mictech.ac.in).' : 'Use your administrative credentials.'}
                    </span>
                  </div>
                )}

                {/* Password (Shown in login, register, reset modes) */}
                {['login', 'register', 'reset'].includes(authMode) && (
                  <div className="form-group">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0" htmlFor="auth-password">Password</label>
                      {authMode === 'login' && authRole === 'student' && (
                        <button type="button" className="text-secondary font-semibold text-xs bg-transparent border-0 cursor-pointer p-0" onClick={() => setAuthMode('forgot')}>Forgot Password?</button>
                      )}
                    </div>
                    <div className="input-icon-container">
                      <span className="input-icon"><Icon name="lock" size={18} /></span>
                      <input className="form-control" type="password" id="auth-password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                  </div>
                )}

                {/* Confirm Password (register, reset modes) */}
                {['register', 'reset'].includes(authMode) && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-confirm">Confirm Password</label>
                    <div className="input-icon-container">
                      <span className="input-icon"><Icon name="lock" size={18} /></span>
                      <input className="form-control" type="password" id="auth-confirm" value={authConfirmPassword} onChange={(e) => setAuthConfirmPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                  </div>
                )}

                {/* Terms of Service Checkbox (register mode only) */}
                {authMode === 'register' && (
                  <div className="form-group">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-normal">
                      <input type="checkbox" checked={authToS} onChange={(e) => setAuthToS(e.target.checked)} className="mt-1" required />
                      <span>I accept the Terms of Service & Privacy Policy, confirming my grievance rights.</span>
                    </label>
                  </div>
                )}

                {/* OTP Code Input (otp mode only) */}
                {authMode === 'otp' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="auth-otp">6-Digit Verification Code</label>
                    <div className="input-icon-container">
                      <span className="input-icon"><Icon name="shield" size={18} /></span>
                      <input className="form-control text-center tracking-widest font-bold text-lg" type="text" id="auth-otp" maxLength="6" value={authOtp} onChange={(e) => setAuthOtp(e.target.value)} placeholder="123456" required />
                    </div>
                    <span className="text-xs text-muted mt-1.5 block">
                      Check the Email Logs in the Admin Panel if testing locally.
                    </span>
                  </div>
                )}

                {/* Submit button */}
                <button className="btn btn-primary w-full mt-4" type="submit" disabled={authLoading}>
                  {authLoading ? (
                    <span className="skeleton-row h-5 w-24 inline-block m-0"></span>
                  ) : (
                    <>
                      {authMode === 'login' && 'Proceed Securely'}
                      {authMode === 'register' && 'Create Account'}
                      {authMode === 'forgot' && 'Send Verification OTP'}
                      {authMode === 'otp' && 'Verify Code'}
                      {authMode === 'reset' && 'Reset Password'}
                    </>
                  )}
                </button>

                {/* Toggles */}
                <div className="text-center mt-5 text-sm text-slate-500">
                  {authMode === 'login' && authRole === 'student' && (
                    <>
                      Don't have an account?{' '}
                      <button type="button" className="text-primary font-bold underline bg-transparent border-0 cursor-pointer p-0" onClick={() => setAuthMode('register')}>Sign Up</button>
                    </>
                  )}
                  {authMode === 'register' && (
                    <>
                      Already have an account?{' '}
                      <button type="button" className="text-primary font-bold underline bg-transparent border-0 cursor-pointer p-0" onClick={() => setAuthMode('login')}>Log In</button>
                    </>
                  )}
                  {['forgot', 'otp', 'reset'].includes(authMode) && (
                    <>
                      Back to{' '}
                      <button type="button" className="text-primary font-bold underline bg-transparent border-0 cursor-pointer p-0" onClick={() => setAuthMode('login')}>Log In</button>
                    </>
                  )}
                </div>

              </form>
            </div>
          </div>
        )}

        {/* 3. PRIVACY NOTICE CHECK */}
        {view === 'privacy' && (
          <div className="privacy-container animate-slide-up">
            <div className="card">
              <div className="card-header">
                <div className="success-icon-badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Icon name="shield" size={36} />
                </div>
                <h2 className="card-title">Student Privacy Notice</h2>
                <p className="text-sm text-muted">Please read and confirm the data protection parameters</p>
              </div>

              <div className="privacy-notice-box">
                <h4 className="font-semibold text-primary">Confidential Grievance Rules</h4>
                <p className="text-sm text-slate-600 mt-1">This portal enforces absolute student protection: </p>
              </div>

              <ul className="privacy-points">
                <li>Your submission is protected under College Code 12-A for Student Security.</li>
                <li>Your name and credentials are NOT sent to HODs or professors during email routing. Only the grievance details and category options are dispatched.</li>
                <li>We do NOT track your device IP address or browser details inside the complaints record.</li>
                <li>Filing a report will not impact your academic attendance, marks, or assessment scores.</li>
              </ul>

              <div className="flex gap-4">
                <button className="btn btn-outline flex-1" onClick={() => setView('student-dashboard')}>Decline</button>
                <button className="btn btn-primary flex-1" onClick={() => {
                  setRaiseCategory('');
                  setRaiseType('');
                  setView('raise-complaint');
                }}>I Accept & File</button>
              </div>
            </div>
          </div>
        )}

        {/* 4. STUDENT DASHBOARD */}
        {view === 'student-dashboard' && (
          <div className="main-content animate-slide-up">
            <div className="section-title-bar">
              <div>
                <h1 className="text-2xl font-bold">Student Dashboard</h1>
                <p className="text-sm text-muted">Manage your grievances and verify status updates</p>
              </div>
              <button className="btn btn-primary" onClick={() => setView('privacy')}>
                <Icon name="plus" size={16} /> File New Grievance
              </button>
            </div>

            {/* Metric Summary Cards */}
            <div className="dashboard-grid">
              <div className="action-card">
                <div className="action-card-icon"><Icon name="list" size={24} /></div>
                <h4 className="action-card-title">Total Logged</h4>
                <p className="stat-widget-val font-bold text-2xl mt-1">{studentComplaints.length}</p>
              </div>
              <div className="action-card">
                <div className="action-card-icon"><Icon name="clock" size={24} /></div>
                <h4 className="action-card-title">Active Reviews</h4>
                <p className="stat-widget-val font-bold text-2xl mt-1">
                  {studentComplaints.filter(c => ['Submitted', 'Under Review', 'Assigned'].includes(c.status)).length}
                </p>
              </div>
              <div className="action-card">
                <div className="action-card-icon"><Icon name="check-circle" size={24} /></div>
                <h4 className="action-card-title">Resolved</h4>
                <p className="stat-widget-val font-bold text-2xl mt-1">
                  {studentComplaints.filter(c => ['Resolved', 'Closed'].includes(c.status)).length}
                </p>
              </div>
            </div>

            {/* List of Student's own complaints */}
            <div className="section-card">
              <h3 className="text-lg font-bold mb-4">Grievance Submission History</h3>
              {studentLoading ? (
                <div>
                  <div className="skeleton-row"></div>
                  <div className="skeleton-row"></div>
                  <div className="skeleton-row"></div>
                </div>
              ) : studentComplaints.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon"><Icon name="file" size={48} /></span>
                  <h4 className="empty-state-title">No Grievances Lodged</h4>
                  <p className="empty-state-desc">You have not submitted any complaints yet. Your history is clean!</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Grievance ID</th>
                        <th>Category</th>
                        <th>Grievance Type</th>
                        <th>Submission Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentComplaints.map((c) => (
                        <tr key={c.id}>
                          <td className="font-semibold">{c.id}</td>
                          <td>{c.category}</td>
                          <td>{c.complaintType}</td>
                          <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge badge-${c.status.toLowerCase().replace(' ', '-')}`}>
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setTrackSearchId(c.id);
                              setTrackedComplaint(c);
                              setView('track');
                            }}>
                              <Icon name="eye" size={14} /> Track
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. RAISE COMPLAINT FORM */}
        {view === 'raise-complaint' && (
          <div className="main-content animate-slide-up" style={{ maxWidth: 800, paddingBottom: 60 }}>
            <div className="flex items-center gap-4 mb-8">
              <button className="btn btn-outline btn-sm" onClick={() => setView('student-dashboard')}>
                <Icon name="arrow-left" size={16} /> Back
              </button>
              <div>
                <h1 className="text-2xl font-bold">Raise Confidential Complaint</h1>
                <p className="text-xs text-muted">All details are routed anonymously. Identity is restricted.</p>
              </div>
            </div>

            <div className="card">
              <form onSubmit={handleGrievanceSubmit}>
                
                {/* Category Dropdown */}
                <div className="form-group">
                  <label className="form-label" htmlFor="grv-category">Select Complaint Category</label>
                  <select className="form-control" id="grv-category" value={raiseCategory} onChange={(e) => handleCategoryChange(e.target.value)} required>
                    <option value="" disabled>Choose a category...</option>
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory dropdown (cascading) */}
                {raiseCategory && (
                  <div className="form-group animate-fade-in">
                    <label className="form-label" htmlFor="grv-type">Select Specific Issue Type</label>
                    <select className="form-control" id="grv-type" value={raiseType} onChange={(e) => setRaiseType(e.target.value)} required>
                      <option value="" disabled>Select issue...</option>
                      {subIssueTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Bus Specific Fields */}
                {raiseCategory === 'Bus Issues' && (
                  <div className="animate-fade-in">
                    <div className="form-group">
                      <label className="form-label" htmlFor="grv-bus-number">Bus Number (Required)</label>
                      <input type="text" className="form-control" id="grv-bus-number" value={raiseBusNumber} onChange={(e) => setRaiseBusNumber(e.target.value)} placeholder="e.g. AP16 XX 1234" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="grv-bus-route">Bus Route / Area (Required)</label>
                      <input type="text" className="form-control" id="grv-bus-route" value={raiseBusRoute} onChange={(e) => setRaiseBusRoute(e.target.value)} placeholder="e.g. Vijayawada → College" required />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="form-group">
                  <label className="form-label" htmlFor="grv-description">Detailed Description of Concern</label>
                  <textarea className="form-control" id="grv-description" value={raiseDescription} onChange={(e) => setRaiseDescription(e.target.value)} placeholder="Explain details of the problem clearly. Include date, details, and specifics. Do NOT type your personal name or roll number here, your session details will automatically authenticate you for administrators." required></textarea>
                </div>

                {/* File Attachment Upload */}
                <div className="form-group">
                  <label className="form-label">Supporting Evidence / Document (Optional)</label>
                  <label className="file-upload-zone block" htmlFor="grv-file-input">
                    <div className="upload-icon flex justify-center">
                      <Icon name="file" size={32} />
                    </div>
                    <h4 className="font-semibold text-sm">Drag & Drop file here, or click to browse</h4>
                    <p className="text-xs text-muted mt-1">Supports JPG, PNG, PDF files (Max 5MB)</p>
                    <input type="file" id="grv-file-input" className="file-upload-input" onChange={handleFileChange} accept="image/jpeg,image/png,application/pdf" />
                  </label>
                  
                  {raiseFile && (
                    <div className="file-preview-card">
                      <div className="flex items-center gap-2">
                        <Icon name="file" size={18} />
                        <span>{raiseFile.name} ({(raiseFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button type="button" className="text-danger font-semibold bg-transparent border-0 cursor-pointer" onClick={() => setRaiseFile(null)}>Remove</button>
                    </div>
                  )}
                </div>

                <button className="btn btn-primary btn-lg w-full mt-4" type="submit" disabled={raiseSubmitLoading}>
                  {raiseSubmitLoading ? (
                    <span className="skeleton-row h-6 w-32 inline-block m-0"></span>
                  ) : (
                    'Submit Complaint Securely'
                  )}
                </button>

              </form>
            </div>
          </div>
        )}

        {/* 6. COMPLAINT SUCCESS SCREEN */}
        {view === 'success' && successComplaint && (
          <div className="main-content animate-slide-up">
            <div className="card success-screen">
              <div className="success-icon-badge">
                <Icon name="check-circle" size={40} />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Complaint Submitted Successfully</h1>
              <p className="text-sm text-muted mt-2">
                Your concern has been registered securely. To protect your data, your email has been omitted from the notifications sent to department authorities.
              </p>

              <div className="success-id-box">
                <span className="success-id-label">Tracking ID</span>
                <span className="success-id-val">{successComplaint.id}</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-left text-sm mb-6 leading-relaxed">
                <h4 className="font-bold text-primary mb-2">Automated Routing Dispatch:</h4>
                <p>The grievance has been securely forwarded to the <strong>{successComplaint.assignedDepartment}</strong>.</p>
                
                {successComplaint.category === "Hostel Issues" && (
                  <p className="mt-2 text-danger font-bold">Hostel Emergency helpline: 9959593027</p>
                )}
                {successComplaint.category === "Food Issues" && (
                  <p className="mt-2 text-danger font-bold">Canteen helpline: 9391781748</p>
                )}
                {successComplaint.category === "Bus Issues" && (
                  <p className="mt-2 text-danger font-bold">Bus helpline: 7330820239</p>
                )}
              </div>

              <div className="flex gap-4">
                <button className="btn btn-outline flex-1" onClick={() => {
                  setTrackSearchId(successComplaint.id);
                  setTrackedComplaint(successComplaint);
                  setView('track');
                }}>Track Status</button>
                <button className="btn btn-primary flex-1" onClick={() => {
                  if (currentUser) {
                    loadStudentComplaints(currentUser.email);
                    setView('student-dashboard');
                  } else {
                    setView('landing');
                  }
                }}>Dashboard</button>
              </div>
            </div>
          </div>
        )}

        {/* 7. TRACK GRIVANCE VIEW (PUBLIC SEARCH) */}
        {view === 'track' && (
          <div className="main-content animate-slide-up">
            <div className="section-title-bar">
              <div>
                <h1 className="text-2xl font-bold">Track Complaint Status</h1>
                <p className="text-sm text-muted">Track resolutions in real-time using alphanumeric tracking codes</p>
              </div>
              <button className="btn btn-outline" onClick={() => {
                if (currentUser) {
                  setView('student-dashboard');
                } else {
                  setView('landing');
                }
              }}>
                <Icon name="arrow-left" size={16} /> Dashboard
              </button>
            </div>

            {/* Search Input Box */}
            <div className="card track-search-card">
              <form onSubmit={handleTrackingSearch} className="flex gap-3">
                <div className="input-icon-container flex-1">
                  <span className="input-icon"><Icon name="search" size={18} /></span>
                  <input className="form-control" type="text" placeholder="Enter Tracking ID (e.g. CMP-A8C3D2)" value={trackSearchId} onChange={(e) => setTrackSearchId(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={trackLoading}>
                  {trackLoading ? 'Searching...' : 'Track'}
                </button>
              </form>
              {trackError && <div className="mt-3 text-red-600 text-xs font-semibold">{trackError}</div>}
            </div>

            {/* Timeline Progress details */}
            {trackedComplaint && (
              <div className="section-card animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
                <h3 className="text-lg font-bold text-center mb-6">Tracking Timeline - ID: {trackedComplaint.id}</h3>
                
                <div className="track-timeline">
                  <div className="timeline-progress-bar">
                    <div className="timeline-progress-fill" style={{
                      width: 
                        trackedComplaint.status === 'Submitted' ? '0%' :
                        trackedComplaint.status === 'Under Review' ? '25%' :
                        trackedComplaint.status === 'Assigned' ? '50%' :
                        trackedComplaint.status === 'Resolved' ? '75%' : '100%'
                    }}></div>
                  </div>

                  <div className="timeline-steps">
                    {/* Step 1 */}
                    <div className={`timeline-step ${['Submitted', 'Under Review', 'Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? 'active' : ''} ${['Under Review', 'Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? 'completed' : ''}`}>
                      <div className="timeline-step-node">
                        {['Under Review', 'Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? '✓' : '1'}
                      </div>
                      <span className="timeline-step-label">Submitted</span>
                    </div>

                    {/* Step 2 */}
                    <div className={`timeline-step ${['Under Review', 'Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? 'active' : ''} ${['Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? 'completed' : ''}`}>
                      <div className="timeline-step-node">
                        {['Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? '✓' : '2'}
                      </div>
                      <span className="timeline-step-label">Under Review</span>
                    </div>

                    {/* Step 3 */}
                    <div className={`timeline-step ${['Assigned', 'Resolved', 'Closed'].includes(trackedComplaint.status) ? 'active' : ''} ${['Resolved', 'Closed'].includes(trackedComplaint.status) ? 'completed' : ''}`}>
                      <div className="timeline-step-node">
                        {['Resolved', 'Closed'].includes(trackedComplaint.status) ? '✓' : '3'}
                      </div>
                      <span className="timeline-step-label">Assigned</span>
                    </div>

                    {/* Step 4 */}
                    <div className={`timeline-step ${['Resolved', 'Closed'].includes(trackedComplaint.status) ? 'active' : ''} ${trackedComplaint.status === 'Closed' ? 'completed' : ''}`}>
                      <div className="timeline-step-node">
                        {trackedComplaint.status === 'Closed' ? '✓' : '4'}
                      </div>
                      <span className="timeline-step-label">Resolved</span>
                    </div>

                    {/* Step 5 */}
                    <div className={`timeline-step ${trackedComplaint.status === 'Closed' ? 'active' : ''}`}>
                      <div className="timeline-step-node">5</div>
                      <span className="timeline-step-label">Closed</span>
                    </div>
                  </div>
                </div>

                <div className="timeline-details mt-8">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4 bg-white p-4 rounded border border-slate-200">
                    <div>
                      <strong className="text-slate-500">Category:</strong>
                      <p className="text-slate-800 font-semibold">{trackedComplaint.category}</p>
                    </div>
                    <div>
                      <strong className="text-slate-500">Routing Department:</strong>
                      <p className="text-slate-800 font-semibold">{trackedComplaint.assignedDepartment}</p>
                    </div>
                    <div>
                      <strong className="text-slate-500">Priority Setting:</strong>
                      <p className="mt-1"><span className={`badge badge-priority-${trackedComplaint.priority.toLowerCase()}`}>{trackedComplaint.priority}</span></p>
                    </div>
                    <div>
                      <strong className="text-slate-500">Submission Date:</strong>
                      <p className="text-slate-800 font-semibold">{new Date(trackedComplaint.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <strong className="text-slate-500 text-sm">Complaint Description:</strong>
                    <p className="text-slate-800 text-sm mt-1 p-3 bg-white border border-slate-200 rounded leading-relaxed">{trackedComplaint.description}</p>
                  </div>

                  {trackedComplaint.resolutionNotes && (
                    <div className="grv-resolution-box animate-fade-in">
                      <h4 className="font-bold flex items-center gap-1.5"><Icon name="check-circle" size={16} /> Resolution Comments</h4>
                      <p className="text-sm mt-1 leading-relaxed">{trackedComplaint.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* 8. ADMINISTRATOR PANEL */}
      {view === 'admin' && currentUser && currentUser.role === 'admin' && (
        <div className="admin-layout animate-fade-in w-full">
          
          {/* Sidebar */}
          <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="admin-sidebar-header">
              <div className="admin-logo-wrapper">
                <img src="/assets/mic-logo.png" alt="MIC" />
                <span>MIC Admin</span>
              </div>
              <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                <Icon name="menu" size={20} />
              </button>
            </div>
            
            <nav className="admin-sidebar-menu">
              <button className={`admin-menu-item ${adminTab === 'dashboard' ? 'active' : ''}`} onClick={() => setAdminTab('dashboard')}>
                <Icon name="dashboard" size={18} /> <span>Dashboard</span>
              </button>
              <button className={`admin-menu-item ${adminTab === 'complaints' ? 'active' : ''}`} onClick={() => setAdminTab('complaints')}>
                <Icon name="list" size={18} /> <span>Active Complaints</span>
              </button>
              <button className={`admin-menu-item ${adminTab === 'contacts' ? 'active' : ''}`} onClick={() => setAdminTab('contacts')}>
                <Icon name="phone" size={18} /> <span>Helpline Numbers</span>
              </button>
              <button className={`admin-menu-item ${adminTab === 'email-logs' ? 'active' : ''}`} onClick={() => setAdminTab('email-logs')}>
                <Icon name="mail" size={18} /> <span>Email Outbox Logs</span>
              </button>
              <hr style={{ border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '15px 0' }} />
              <button className="admin-menu-item logout-item" onClick={handleLogout}>
                <Icon name="logout" size={18} /> <span>Exit Admin Portal</span>
              </button>
            </nav>
          </aside>

          {/* Main Content Pane */}
          <div className={`admin-main-viewport ${sidebarCollapsed ? 'expanded' : ''}`}>
            
            <header className="admin-top-bar">
              <div>
                <h2 className="text-lg font-bold text-slate-800" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                  {adminTab === 'dashboard' && 'Analytics Overview'}
                  {adminTab === 'complaints' && 'Grievance Directory'}
                  {adminTab === 'contacts' && 'Routing Helplines'}
                  {adminTab === 'email-logs' && 'Dispatched Outbox Logs'}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted font-semibold bg-slate-100 py-1 px-3 rounded-full">
                  Admin session active
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => loadAdminData(true)}>
                  <Icon name="refresh" size={14} /> Refresh
                </button>
              </div>
            </header>

            <div className="admin-viewport-content">
              
              {/* Tab Content A: Analytics Dashboard */}
              {adminTab === 'dashboard' && (
                <div>
                  
                  {/* KPI card row */}
                  <div className="admin-stats-grid">
                    <div className="stat-widget">
                      <div className="stat-widget-info">
                        <span className="stat-widget-label">Total Logs</span>
                        <span className="stat-widget-val">{totalCount}</span>
                      </div>
                      <div className="stat-widget-icon"><Icon name="list" size={20} /></div>
                    </div>
                    <div className="stat-widget">
                      <div className="stat-widget-info">
                        <span className="stat-widget-label">Pending Review</span>
                        <span className="stat-widget-val">{pendingCount}</span>
                      </div>
                      <div className="stat-widget-icon"><Icon name="clock" size={20} /></div>
                    </div>
                    <div className="stat-widget">
                      <div className="stat-widget-info">
                        <span className="stat-widget-label">Resolved</span>
                        <span className="stat-widget-val">{resolvedCount}</span>
                      </div>
                      <div className="stat-widget-icon"><Icon name="check-circle" size={20} /></div>
                    </div>
                    <div className="stat-widget">
                      <div className="stat-widget-info">
                        <span className="stat-widget-label">Submitted Today</span>
                        <span className="stat-widget-val">{todayCount}</span>
                      </div>
                      <div className="stat-widget-icon"><Icon name="plus" size={20} /></div>
                    </div>
                  </div>

                  {/* Split Pane: Category counts & Recent submissions */}
                  <div className="analytics-section">
                    
                    {/* Charts Card */}
                    <div className="chart-card">
                      <div className="chart-header">
                        <h3 className="text-base font-bold text-slate-800">Category-wise Analytics</h3>
                        <span className="text-xs text-muted">Dynamically computed from live DB</span>
                      </div>
                      
                      <div className="bar-chart-container">
                        {DEFAULT_CATEGORIES.map((cat) => {
                          const count = categoryCounts[cat] || 0;
                          const percent = totalCount > 0 ? (count / maxCategoryCount) * 100 : 0;
                          return (
                            <div key={cat} className="bar-row">
                              <span className="bar-label" title={cat}>{cat}</span>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${percent}%` }}></div>
                              </div>
                              <span className="bar-val">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick overview Contacts list */}
                    <div className="chart-card">
                      <h3 className="text-base font-bold text-slate-800 mb-4">Emergency Directory</h3>
                      <ul className="flex flex-col gap-3 text-sm">
                        {DEFAULT_CATEGORIES.filter(cat => ['Hostel Issues', 'Food Issues', 'Bus Issues'].includes(cat)).map((cat) => (
                          <li key={cat} className="flex justify-between py-2 border-b border-slate-100">
                            <span className="font-semibold text-slate-600">{cat}</span>
                            <span className="text-slate-800 font-bold">{contactsMap[cat] || 'N/A'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  {/* Recent Activity Table */}
                  <div className="section-card">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Recent Submissions</h3>
                    {adminLoading ? (
                      <div className="skeleton-row"></div>
                    ) : allComplaints.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-sm">No complaints recorded in the database.</div>
                    ) : (
                      <div className="table-container">
                        <table className="table-custom">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Category</th>
                              <th>Submission Date</th>
                              <th>Status</th>
                              <th>Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allComplaints.slice(0, 5).map((c) => (
                              <tr key={c.id}>
                                <td className="font-semibold">{c.id}</td>
                                <td>{c.category}</td>
                                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                                <td><span className={`badge badge-${c.status.toLowerCase().replace(' ', '-')}`}>{c.status}</span></td>
                                <td><span className={`badge badge-priority-${c.priority.toLowerCase()}`}>{c.priority}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Tab Content B: Complaints Directory */}
              {adminTab === 'complaints' && (
                <div className="section-card">
                  
                  {/* Filters header bar */}
                  <div className="flex flex-wrap gap-4 mb-6 items-center">
                    <div className="input-icon-container flex-1" style={{ minWidth: 200 }}>
                      <span className="input-icon"><Icon name="search" size={16} /></span>
                      <input className="form-control py-2 text-sm" type="text" placeholder="Search ID, student email, description..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} />
                    </div>

                    <select className="form-control py-2 text-sm w-44" value={adminFilterCategory} onChange={(e) => setAdminFilterCategory(e.target.value)}>
                      <option value="all">All Categories</option>
                      {DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>

                    <select className="form-control py-2 text-sm w-40" value={adminFilterStatus} onChange={(e) => setAdminFilterStatus(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>

                    <select className="form-control py-2 text-sm w-40" value={adminFilterPriority} onChange={(e) => setAdminFilterPriority(e.target.value)}>
                      <option value="all">All Priorities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  {/* List View */}
                  {adminLoading ? (
                    <div>
                      <div className="skeleton-row"></div>
                      <div className="skeleton-row"></div>
                      <div className="skeleton-row"></div>
                    </div>
                  ) : filteredComplaints.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon"><Icon name="file" size={48} /></span>
                      <h4 className="empty-state-title">No Matching Records</h4>
                      <p className="empty-state-desc">Try clearing your filters or search keywords.</p>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table-custom">
                        <thead>
                          <tr>
                            <th>Complaint ID</th>
                            <th>Student College Email</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredComplaints.map((c) => (
                            <tr key={c.id}>
                              <td className="font-semibold">{c.id}</td>
                              <td className="font-semibold text-xs text-slate-600">{c.studentEmail}</td>
                              <td>{c.category}</td>
                              <td>{c.complaintType}</td>
                              <td><span className={`badge badge-${c.status.toLowerCase().replace(' ', '-')}`}>{c.status}</span></td>
                              <td><span className={`badge badge-priority-${c.priority.toLowerCase()}`}>{c.priority}</span></td>
                              <td>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                  setSelectedComplaint(c);
                                  setUpdateStatus(c.status);
                                  setUpdatePriority(c.priority);
                                  setUpdateResolution(c.resolutionNotes || '');
                                }}>
                                  Inspect Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}

              {/* Tab Content C: Contacts helpline editing */}
              {adminTab === 'contacts' && (
                <div className="section-card">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Grievance Category Helpline Directory</h3>
                  <p className="text-xs text-muted mb-6">Update contact helpline numbers saved in the database. These numbers render directly on success receipts.</p>
                  
                  <div className="table-container">
                    <table className="table-custom contacts-table">
                      <thead>
                        <tr>
                          <th>Complaint Category</th>
                          <th>Assigned Department / Action Unit</th>
                          <th>Contact Helpline Number</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEFAULT_CATEGORIES.map((cat) => (
                          <tr key={cat}>
                            <td className="font-semibold">{cat}</td>
                            <td className="text-xs text-slate-500">
                              {cat === 'Hostel Issues' && 'Hostel Management / Discipline Head'}
                              {cat === 'Food Issues' && 'Canteen / Food Management'}
                              {cat === 'Bus Issues' && 'Bus Management'}
                              {cat === 'Campus Issues' && 'Respective HOD'}
                              {cat === 'Complaint Against Student' && 'Discipline Committee'}
                              {cat === 'Complaint Against Faculty' && 'Discipline Committee'}
                            </td>
                            <td>
                              <input type="text" className="form-control py-1 px-3 text-xs w-48 font-bold" value={editingContacts[cat] || ''} onChange={(e) => {
                                const val = e.target.value;
                                setEditingContacts(prev => ({ ...prev, [cat]: val }));
                              }} />
                            </td>
                            <td>
                              <button className="btn btn-primary btn-sm" onClick={() => handleUpdateContactSubmit(cat, editingContacts[cat])}>
                                Save Changes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab Content D: Email logs inbox preview */}
              {adminTab === 'email-logs' && (
                <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
                  
                  {emailLogs.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-sm">No email transmission logs captured yet.</div>
                  ) : (
                    <div className="email-log-layout">
                      
                      {/* Left list sidebar */}
                      <div className="email-log-sidebar">
                        <div className="email-log-sidebar-header">Outbox Dispatches</div>
                        <div className="email-log-list">
                          {emailLogs.map((log) => (
                            <div key={log.id} className={`email-log-item-card ${selectedEmailLog && selectedEmailLog.id === log.id ? 'active' : ''}`} onClick={() => setSelectedEmailLog(log)}>
                              <h4 className="email-log-item-title">{log.complaintId}</h4>
                              <p className="email-log-item-meta font-semibold truncate" title={log.recipient}>To: {log.recipient}</p>
                              <p className="email-log-item-meta" style={{ marginTop: 2 }}>{new Date(log.timestamp).toLocaleTimeString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right preview window */}
                      <div className="email-log-viewer">
                        <div className="email-log-viewer-header">
                          {selectedEmailLog ? (
                            <>
                              <h3 className="font-bold text-slate-800">{selectedEmailLog.subject}</h3>
                              <p className="text-xs text-muted mt-1 font-semibold">Recipient: {selectedEmailLog.recipient} | Logged: {new Date(selectedEmailLog.timestamp).toLocaleString()}</p>
                            </>
                          ) : (
                            <span className="text-sm text-slate-400">Select log to review content</span>
                          )}
                        </div>
                        
                        <div className="email-log-viewer-pane">
                          {selectedEmailLog && (
                            <div className="email-iframe-container p-6 bg-white overflow-y-auto leading-relaxed shadow-sm w-full" dangerouslySetInnerHTML={{ __html: selectedEmailLog.body }}></div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Admin Complaint Detail & Actions */}
      {selectedComplaint && (
        <div className="modal-overlay show">
          <div className="modal-window">
            
            <div className="modal-header">
              <h3 className="modal-title">Inspect Grievance Details</h3>
              <button className="modal-close-btn" onClick={() => setSelectedComplaint(null)}>✕</button>
            </div>

            <div className="modal-body text-slate-800">
              
              {/* Meta Grid */}
              <div className="grv-details-meta">
                <div className="grv-meta-item">
                  <label>Grievance tracking ID</label>
                  <span>{selectedComplaint.id}</span>
                </div>
                <div className="grv-meta-item">
                  <label>Category</label>
                  <span>{selectedComplaint.category}</span>
                </div>
                <div className="grv-meta-item">
                  <label>Submitted Date</label>
                  <span>{new Date(selectedComplaint.createdAt).toLocaleString()}</span>
                </div>
                <div className="grv-meta-item">
                  <label>Student Email Address</label>
                  <span className="font-bold text-xs text-slate-600">{selectedComplaint.studentEmail}</span>
                </div>
                {selectedComplaint.category === 'Bus Issues' && (
                  <>
                    <div className="grv-meta-item">
                      <label>Bus Number</label>
                      <span>{selectedComplaint.busNumber || 'N/A'}</span>
                    </div>
                    <div className="grv-meta-item">
                      <label>Bus Route / Area</label>
                      <span>{selectedComplaint.busRoute || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Concern description */}
              <div className="grv-desc-box">
                <h4 className="font-bold text-primary">Detailed Concern description:</h4>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded mt-1 font-medium leading-relaxed">
                  {selectedComplaint.description}
                </p>
              </div>

              {/* Attachment link if uploaded */}
              {selectedComplaint.attachmentUrl && (
                <div className="mb-6 p-3 border border-dashed border-slate-300 rounded bg-slate-50 text-sm">
                  <span className="text-slate-500 font-semibold">Supporting Document:</span>{' '}
                  <a href={selectedComplaint.attachmentUrl} target="_blank" rel="noreferrer" className="text-secondary underline font-bold">
                    View Uploaded File Attachment
                  </a>
                </div>
              )}

              {/* Form to update details */}
              <form onSubmit={handleUpdateComplaintSubmit} className="border-t border-slate-100 pt-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group mb-4">
                    <label className="form-label text-slate-600 font-semibold" htmlFor="modal-status">Assess Status</label>
                    <select className="form-control py-2" id="modal-status" value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)}>
                      <option value="Submitted">Submitted</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label text-slate-600 font-semibold" htmlFor="modal-priority">Set Priority</label>
                    <select className="form-control py-2" id="modal-priority" value={updatePriority} onChange={(e) => setUpdatePriority(e.target.value)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label text-slate-600 font-semibold" htmlFor="modal-resolution">Resolution Summary Notes</label>
                  <textarea className="form-control text-sm" id="modal-resolution" value={updateResolution} onChange={(e) => setUpdateResolution(e.target.value)} placeholder="Type resolution details here. Students will see these notes in real-time when they track their complaint."></textarea>
                </div>

                <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedComplaint(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={updateLoading}>
                    {updateLoading ? 'Saving...' : 'Apply Modifications'}
                  </button>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}

      {/* Global Footer (shown on landing and other student views) */}
      {view !== 'admin' && (
        <footer className="site-footer">
          <div className="footer-container">
            <div className="footer-brand">
              <h3>DVR & Dr. HS MIC College of Technology</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Empowering college students with transparent, secure, and confidential grievance redressal structures.
              </p>
            </div>
            <div className="footer-links">
              <h4>Grievance Portal</h4>
              <ul>
                <li><button className="bg-transparent border-0 text-slate-300 hover:text-white cursor-pointer p-0 text-sm text-left" onClick={() => setView('landing')}>Home Landing</button></li>
                <li><button className="bg-transparent border-0 text-slate-300 hover:text-white cursor-pointer p-0 text-sm text-left" onClick={() => setView('track')}>Track Grievance</button></li>
                <li><button className="bg-transparent border-0 text-slate-300 hover:text-white cursor-pointer p-0 text-sm text-left" onClick={() => { setAuthMode('login'); setView('login'); }}>Access Login</button></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>Privacy & Support</h4>
              <ul>
                <li><span className="text-slate-300 text-sm">SECURE END-TO-END CRYPTO</span></li>
                <li><span className="text-slate-300 text-sm">CONFIDENTIAL COMMITTEE</span></li>
                <li><span className="text-slate-300 text-sm">Campus helpline: 08678-273535</span></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 DVR & Dr. HS MIC College of Technology - Kanchikacherla. All Rights Reserved.</p>
            <p>Designed for student security and transparency.</p>
          </div>
        </footer>
      )}

    </div>
  );
}
