// Main SPA Application Router & View Controller
import { replaceIcons, getIcon } from './js/icons.js?v=1.3';
import * as State from './js/state.js?v=1.3';
import * as Api from './js/supabase.js?v=1.3';

// Application State
const AppState = {
    view: 'landing', // landing, login, privacy, student-dashboard, raise-complaint, success, track, admin
    currentStudent: null, // logged in student data
    currentAdmin: null, // logged in admin data
    privacyAccepted: false,
    
    // Admin specific navigation
    adminTab: 'dashboard', // dashboard, complaints, categories, types, contacts, email-logs, settings
    sidebarCollapsed: false,
    
    // Context variables
    lastSubmittedComplaint: null,
    searchId: '',
    selectedCategoryFilter: 'all',
    selectedStatusFilter: 'all',
    selectedPriorityFilter: 'all',
    adminSearchQuery: ''
};

// Global Toast Notification Helper (No Emojis)
function showToast(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    let icon = '✓';
    let iconColor = 'var(--success)';
    if (type === 'error') {
        icon = '✕';
        iconColor = 'var(--danger)';
    } else if (type === 'warning') {
        icon = '!';
        iconColor = 'var(--warning)';
    }
    
    toast.innerHTML = `
        <div class="toast-title" style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:0.92rem;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; background-color:${iconColor}22; color:${iconColor}; font-size:10px; font-weight:bold;">${icon}</span>
            <span>${title}</span>
        </div>
        <div class="toast-message" style="margin-top:4px; font-size:0.8rem; color:var(--text-muted); line-height:1.45;">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto fade out after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// ==========================================================================
// SPA ROUTER ENGINE
// ==========================================================================
const appViewport = document.getElementById('app-viewport');
const siteHeader = document.getElementById('site-header');
const headerActions = document.getElementById('header-user-actions');
const logoNav = document.getElementById('header-logo-nav');

// Handle home/logo clicks
logoNav.addEventListener('click', () => {
    if (AppState.currentAdmin) {
        AppState.view = 'admin';
    } else if (AppState.currentStudent) {
        AppState.view = 'student-dashboard';
    } else {
        AppState.view = 'landing';
    }
    navigate();
});

export function navigate(viewName = null, extra = null) {
    if (viewName) {
        AppState.view = viewName;
    }
    
    if (extra) {
        if (extra.complaint) AppState.lastSubmittedComplaint = extra.complaint;
        if (extra.searchId) AppState.searchId = extra.searchId;
    }
    
    // Hydrate user session from localStorage if present
    if (!AppState.currentStudent && !AppState.currentAdmin) {
        const cachedUser = State.getCurrentUser();
        if (cachedUser) {
            if (cachedUser.role === 'admin') {
                AppState.currentAdmin = cachedUser;
                if (AppState.view === 'landing' || AppState.view === 'login') {
                    AppState.view = 'admin';
                }
            } else {
                AppState.currentStudent = cachedUser;
                AppState.privacyAccepted = true; // assume accepted if cached session
                if (AppState.view === 'landing' || AppState.view === 'login') {
                    AppState.view = 'student-dashboard';
                }
            }
        }
    }

    render();
}

// Render dynamic elements
function render() {
    // 1. Manage Global Header Visibility
    if (AppState.view === 'admin') {
        siteHeader.style.display = 'none'; // Admin has its own custom dashboard header
    } else {
        siteHeader.style.display = 'flex';
        renderHeader();
    }

    // 2. Render View Content
    switch (AppState.view) {
        case 'landing':
            renderLanding();
            break;
        case 'login':
            renderLogin();
            break;
        case 'privacy':
            renderPrivacyNotice();
            break;
        case 'student-dashboard':
            if (!AppState.currentStudent) {
                AppState.view = 'login';
                renderLogin();
            } else if (!AppState.privacyAccepted) {
                AppState.view = 'privacy';
                renderPrivacyNotice();
            } else {
                renderStudentDashboard();
            }
            break;
        case 'raise-complaint':
            if (!AppState.currentStudent) {
                AppState.view = 'login';
                renderLogin();
            } else {
                renderRaiseComplaint();
            }
            break;
        case 'success':
            renderSuccessScreen();
            break;
        case 'track':
            renderTrackComplaint();
            break;
        case 'admin':
            if (!AppState.currentAdmin) {
                AppState.view = 'login';
                renderLogin();
            } else {
                renderAdminPortal();
            }
            break;
        default:
            renderLanding();
    }

    // 3. Replace data-icons
    replaceIcons(appViewport);
    replaceIcons(siteHeader);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render header details
function renderHeader() {
    if (AppState.currentStudent) {
        headerActions.innerHTML = `
            <div style="display:flex; align-items:center; gap:16px;">
                <span class="text-sm font-medium text-muted" style="display:inline-block; max-width: 180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${AppState.currentStudent.email}
                </span>
                <button class="btn btn-primary btn-sm" id="btn-hdr-dashboard">Dashboard</button>
                <button class="btn btn-outline btn-sm logout-btn">Logout</button>
            </div>
        `;
        document.getElementById('btn-hdr-dashboard').addEventListener('click', () => navigate('student-dashboard'));
    } else {
        headerActions.innerHTML = `
            <button class="btn btn-primary" id="btn-hdr-login">Login</button>
        `;
        document.getElementById('btn-hdr-login').addEventListener('click', () => navigate('login'));
    }
    
    // Bind global logout button
    const logoutBtn = headerActions.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            State.setCurrentUser(null);
            AppState.currentStudent = null;
            AppState.currentAdmin = null;
            AppState.privacyAccepted = false;
            navigate('landing');
        });
    }
}

// ==========================================================================
// VIEW RENDERING FUNCTIONS
// ==========================================================================

// 1. Landing View
function renderLanding() {
    appViewport.innerHTML = `
        <!-- HERO SECTION -->
        <div class="hero-section animate-slide-up">
            <div class="hero-tag">Official Student Portal</div>
            <h1 class="hero-title">Student Grievance Portal</h1>
            <p class="hero-subtitle">
                A secure and confidential platform where every student can raise concerns without fear. 
                Your identity remains protected, your information is securely encrypted, and every complaint 
                is reviewed only by authorized disciplinary authorities. Speak freely, your voice matters, 
                and your decisions are respected.
            </p>
            <div class="hero-buttons">
                <button class="btn btn-primary btn-lg" id="landing-btn-raise">
                    <span data-icon="plus" data-size="20"></span> Raise Complaint
                </button>
                <button class="btn btn-secondary btn-lg" id="landing-btn-track">
                    <span data-icon="search" data-size="20"></span> Track Complaint
                </button>
            </div>
        </div>

        <!-- TRUST SECTION -->
        <section class="landing-section animate-fade-in" style="animation-delay: 0.1s; background-color: white; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
            <h2 class="landing-section-title">Confidential & Secure Redressal</h2>
            <p class="landing-section-subtitle">Under institutional guidelines, your safety and privacy are our highest priority.</p>
            
            <div class="trust-grid">
                <div class="trust-card">
                    <div class="trust-icon-wrapper">
                        <span data-icon="shield" data-size="24"></span>
                    </div>
                    <h3 class="trust-title">Complete Confidentiality</h3>
                    <p class="trust-description">
                        Your identity remains confidential throughout the complaint process. Only authorized disciplinary administrators can access sensitive information.
                    </p>
                </div>
                
                <div class="trust-card">
                    <div class="trust-icon-wrapper">
                        <span data-icon="lock" data-size="24"></span>
                    </div>
                    <h3 class="trust-title">Secure & Encrypted</h3>
                    <p class="trust-description">
                        All complaint data is encrypted and securely stored. No faculty member, student, or hostel staff can access your information without proper authorization.
                    </p>
                </div>
                
                <div class="trust-card">
                    <div class="trust-icon-wrapper">
                        <span data-icon="list" data-size="24"></span>
                    </div>
                    <h3 class="trust-title">Fair & Transparent Process</h3>
                    <p class="trust-description">
                        Every complaint is reviewed fairly and forwarded to the appropriate department for investigation. Decisions are made objectively without revealing your identity.
                    </p>
                </div>
                
                <div class="trust-card">
                    <div class="trust-icon-wrapper">
                        <span data-icon="mail" data-size="24"></span>
                    </div>
                    <h3 class="trust-title">Automated Department Routing</h3>
                    <p class="trust-description">
                        Complaints are automatically sent to the concerned authority including Hostel Management, HODs, Discipline Committee, Bus Management, or Canteen Administration based on complaint type.
                    </p>
                </div>
            </div>
        </section>

        <!-- HOW IT WORKS TIMELINE -->
        <section class="landing-section animate-fade-in" style="animation-delay: 0.2s;">
            <h2 class="landing-section-title">How It Works</h2>
            <p class="landing-section-subtitle">Submit and resolve grievances in four easy, transparent steps.</p>
            
            <div class="how-it-works-timeline">
                <div class="how-line"></div>
                
                <div class="how-step">
                    <div class="how-node">1</div>
                    <h3 class="how-step-title">Login with College Email</h3>
                    <p class="how-step-desc">Authenticate using your official email ID. Your session is encrypted.</p>
                </div>
                
                <div class="how-step">
                    <div class="how-node">2</div>
                    <h3 class="how-step-title">Raise Complaint</h3>
                    <p class="how-step-desc">Fill in dynamic details, attach evidence, and submit. The system routes it instantly.</p>
                </div>
                
                <div class="how-step">
                    <div class="how-node">3</div>
                    <h3 class="how-step-title">Complaint Reviewed</h3>
                    <p class="how-step-desc">The designated HOD or warden initiates a strict, anonymous investigation.</p>
                </div>
                
                <div class="how-step">
                    <div class="how-node">4</div>
                    <h3 class="how-step-title">Resolution & Updates</h3>
                    <p class="how-step-desc">Receive notes, track the timeline, and verify final resolution on your dashboard.</p>
                </div>
            </div>
        </section>

        <!-- FREQUENTLY ASKED QUESTIONS -->
        <section class="landing-section animate-fade-in" style="animation-delay: 0.3s; background-color: white; border-top: 1px solid var(--border);">
            <h2 class="landing-section-title">Frequently Asked Questions</h2>
            <p class="landing-section-subtitle">Everything you need to know about the grievance submittal process.</p>
            
            <div class="faq-list">
                <div class="faq-item">
                    <h3 class="faq-question">Is my identity hidden?</h3>
                    <p class="faq-answer">Yes, absolutely. Student identities are masked and secured. They cannot be queried by staff, faculty, or department representatives.</p>
                </div>
                
                <div class="faq-item">
                    <h3 class="faq-question">Can faculty see my name?</h3>
                    <p class="faq-answer">No. Faculty HODs and canteen/hostel wardens only receive the complaint category, type, description, and attachments. They do not have decryption access keys to view student names.</p>
                </div>
                
                <div class="faq-item">
                    <h3 class="faq-question">Can I upload evidence?</h3>
                    <p class="faq-answer">Yes. You can attach supporting evidence such as images, scans, and documents (JPG, PNG, PDF up to 5MB) securely uploaded to Cloudflare R2.</p>
                </div>
                
                <div class="faq-item">
                    <h3 class="faq-question">Can I track complaint status?</h3>
                    <p class="faq-answer">Yes. You can track resolution workflows in real time using the unique tracking ID generated on grievance submission.</p>
                </div>
                
                <div class="faq-item">
                    <h3 class="faq-question">Who can access my complaint?</h3>
                    <p class="faq-answer">Only authorized central disciplinary administrators have decryption rights to audit student identities for institutional safety.</p>
                </div>
            </div>
        </section>

        <!-- PROFESSIONAL FOOTER -->
        <footer class="site-footer">
            <div class="footer-container">
                <div class="footer-brand">
                    <h3>DVR & Dr. HS MIC</h3>
                    <p class="text-sm" style="color: rgba(255, 255, 255, 0.7); margin-bottom: 8px;">College of Technology</p>
                    <p>Official student redressal portal designed to maintain a safe, fair, transparent, and supportive learning environment.</p>
                </div>
                
                <div class="footer-links">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><a href="#" onclick="event.preventDefault(); navigate('landing');">Home</a></li>
                        <li><a href="#" onclick="event.preventDefault(); navigate('login');">Student Login</a></li>
                        <li><a href="#" onclick="event.preventDefault(); navigate('track');">Track Resolution</a></li>
                    </ul>
                </div>
                
                <div class="footer-links">
                    <h4>Support & Policy</h4>
                    <ul>
                        <li><a href="#" onclick="event.preventDefault(); alert('Security policy: All complaints are encrypted via Supabase Auth RLS and stored confidentially.');">Privacy Policy</a></li>
                        <li><a href="#" onclick="event.preventDefault(); alert('Terms of Service: Zero retaliation policy protecting reporting students.');">Terms & Conditions</a></li>
                        <li><a href="#" onclick="event.preventDefault(); showHelpModal();">Contact Discipline Committee</a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom">
                <span>© 2026 DVR & Dr. HS MIC College of Technology. All Rights Reserved.</span>
                <span style="color: rgba(255, 255, 255, 0.5);">Grievance Management System (GMS)</span>
            </div>
        </footer>
    `;

    document.getElementById('landing-btn-raise').addEventListener('click', () => {
        if (AppState.currentStudent) {
            navigate('raise-complaint');
        } else {
            navigate('login');
        }
    });

    document.getElementById('landing-btn-track').addEventListener('click', () => {
        navigate('track');
    });
}

// 2. Login View
function renderLogin() {
    window.authMode = window.authMode || 'login';
    window.authRole = window.authRole || 'student'; // 'student' or 'admin'
    
    let headerTitle = "Portal Access";
    let headerDesc = "Identify yourself to access college grievance resources";
    
    if (window.authMode === 'register') {
        headerTitle = "Student Registration";
        headerDesc = "Create your secure credentials to submit complaints";
    } else if (window.authMode === 'forgot') {
        headerTitle = "Reset Password";
        headerDesc = "Verify your email to recover student credentials";
    } else if (window.authMode === 'otp') {
        headerTitle = "Verify Code";
        headerDesc = "Enter the 6-digit OTP code sent to your email";
    } else if (window.authMode === 'reset') {
        headerTitle = "Set New Password";
        headerDesc = "Enter your new credentials below";
    }

    let roleTabsHtml = '';
    if (window.authMode === 'login') {
        roleTabsHtml = `
            <div class="auth-tabs">
                <button class="auth-tab-btn ${window.authRole === 'student' ? 'active' : ''}" id="tab-student">Student Access</button>
                <button class="auth-tab-btn ${window.authRole === 'admin' ? 'active' : ''}" id="tab-admin">Administrator</button>
            </div>
        `;
    }

    let formContentHtml = '';
    
    if (window.authMode === 'login') {
        formContentHtml = `
            <div class="form-group">
                <label class="form-label" for="auth-email">College Email Address</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="mail" data-size="18"></span>
                    <input class="form-control" type="email" id="auth-email" placeholder="${window.authRole === 'student' ? 'rollnumber@mictech.ac.in' : 'admin@mictech.ac.in'}" required>
                </div>
                <span class="text-xs text-muted" style="margin-top:6px; display:block;" id="email-hint">
                    ${window.authRole === 'student' ? 'Must be a verified college address (e.g. @mictech.ac.in).' : 'Use your administrative college account details.'}
                </span>
            </div>
            
            <div class="form-group" id="pass-group">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <label class="form-label" for="auth-password" style="margin:0;">Password</label>
                    ${window.authRole === 'student' ? `<button type="button" id="link-forgot" style="background:none; border:none; color:var(--secondary); font-size:0.8rem; cursor:pointer; font-weight:600; padding:0;">Forgot Password?</button>` : ''}
                </div>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="lock" data-size="18"></span>
                    <input class="form-control" type="password" id="auth-password" placeholder="••••••••" required>
                </div>
            </div>
            
            <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px;" id="auth-submit-btn">
                Proceed Securely
            </button>
            
            ${window.authRole === 'student' ? `
                <div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                    Don't have an account? <button type="button" id="link-signup" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">Sign Up</button>
                </div>
            ` : ''}
        `;
    } else if (window.authMode === 'register') {
        formContentHtml = `
            <div class="form-group">
                <label class="form-label" for="auth-email">College Email Address</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="mail" data-size="18"></span>
                    <input class="form-control" type="email" id="auth-email" placeholder="rollnumber@mictech.ac.in" required>
                </div>
                <span class="text-xs text-muted" style="margin-top:6px; display:block;">
                    Must be a verified college address (e.g. @mictech.ac.in).
                </span>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="auth-password">Create Password</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="lock" data-size="18"></span>
                    <input class="form-control" type="password" id="auth-password" placeholder="••••••••" required>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label" for="auth-confirm-password">Confirm Password</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="lock" data-size="18"></span>
                    <input class="form-control" type="password" id="auth-confirm-password" placeholder="••••••••" required>
                </div>
            </div>

            <div class="form-group" style="margin-top:20px;">
                <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:0.85rem; color:var(--text-light); line-height:1.4;">
                    <input type="checkbox" id="auth-tos" required style="margin-top:3px;">
                    <span>I accept the Terms of Service & Privacy Policy, confirming my grievance rights.</span>
                </label>
            </div>
            
            <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px;" id="auth-submit-btn">
                Create Account
            </button>
            
            <div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                Already have an account? <button type="button" id="link-login" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">Log In</button>
            </div>
        `;
    } else if (window.authMode === 'forgot') {
        formContentHtml = `
            <div class="form-group">
                <label class="form-label" for="auth-email">College Email Address</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="mail" data-size="18"></span>
                    <input class="form-control" type="email" id="auth-email" placeholder="rollnumber@mictech.ac.in" required>
                </div>
                <span class="text-xs text-muted" style="margin-top:6px; display:block;">
                    An OTP verification code will be sent to this email to reset your credentials.
                </span>
            </div>
            
            <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px;" id="auth-submit-btn">
                Send Verification OTP
            </button>
            
            <div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                Back to <button type="button" id="link-login" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">Log In</button>
            </div>
        `;
    } else if (window.authMode === 'otp') {
        formContentHtml = `
            <div class="form-group">
                <label class="form-label" for="auth-otp">6-Digit Verification Code</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="shield" data-size="18"></span>
                    <input class="form-control" type="text" id="auth-otp" placeholder="123456" maxlength="6" pattern="[0-9]{6}" required style="text-align:center; letter-spacing:8px; font-size:1.2rem; font-weight:bold;">
                </div>
                <span class="text-xs text-muted" style="margin-top:6px; display:block;">
                    Check the outbox logs in the Admin Panel if testing locally.
                </span>
            </div>
            
            <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px;" id="auth-submit-btn">
                Verify Code
            </button>
            
            <div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                Back to <button type="button" id="link-login" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">Log In</button>
            </div>
        `;
    } else if (window.authMode === 'reset') {
        formContentHtml = `
            <div class="form-group">
                <label class="form-label" for="auth-password">New Password</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="lock" data-size="18"></span>
                    <input class="form-control" type="password" id="auth-password" placeholder="••••••••" required>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label" for="auth-confirm-password">Confirm New Password</label>
                <div class="input-icon-container">
                    <span class="input-icon" data-icon="lock" data-size="18"></span>
                    <input class="form-control" type="password" id="auth-confirm-password" placeholder="••••••••" required>
                </div>
            </div>
            
            <button class="btn btn-primary" type="submit" style="width:100%; margin-top:16px;" id="auth-submit-btn">
                Reset Password
            </button>
            
            <div style="text-align:center; margin-top:20px; font-size:0.85rem; color:var(--text-muted);">
                Back to <button type="button" id="link-login" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; padding:0;">Log In</button>
            </div>
        `;
    }

    appViewport.innerHTML = `
        <div class="auth-container animate-slide-up">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">${headerTitle}</h2>
                    <p class="text-sm text-muted">${headerDesc}</p>
                </div>
                
                ${roleTabsHtml}
                
                <div id="auth-error-msg" style="display:none; padding:12px; border-radius:var(--radius-sm); background-color:var(--danger-light); color:var(--danger); font-size:0.85rem; font-weight:500; margin-bottom:20px;"></div>
                
                <form id="auth-form">
                    ${formContentHtml}
                </form>
            </div>
        </div>
    `;

    replaceIcons(appViewport);

    // Event Bindings
    const errorMsg = document.getElementById('auth-error-msg');
    const authForm = document.getElementById('auth-form');

    // Role switcher tabs
    if (window.authMode === 'login') {
        const tabStudent = document.getElementById('tab-student');
        const tabAdmin = document.getElementById('tab-admin');
        
        tabStudent.addEventListener('click', () => {
            window.authRole = 'student';
            renderLogin();
        });
        
        tabAdmin.addEventListener('click', () => {
            window.authRole = 'admin';
            renderLogin();
        });
    }

    // Toggle Link click handlers
    const linkSignup = document.getElementById('link-signup');
    const linkLogin = document.getElementById('link-login');
    const linkForgot = document.getElementById('link-forgot');

    if (linkSignup) {
        linkSignup.addEventListener('click', () => {
            window.authMode = 'register';
            renderLogin();
        });
    }
    if (linkLogin) {
        linkLogin.addEventListener('click', () => {
            window.authMode = 'login';
            renderLogin();
        });
    }
    if (linkForgot) {
        linkForgot.addEventListener('click', () => {
            window.authMode = 'forgot';
            renderLogin();
        });
    }

    // Form Submission Actions
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.style.display = 'none';
        
        const submitBtn = document.getElementById('auth-submit-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.innerHTML = `<span class="skeleton-row" style="height:20px; width:100px; display:inline-block; margin:0;"></span>`;

        try {
            if (window.authMode === 'login') {
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                
                const user = await Api.authenticateUser(email, password, window.authRole);
                State.setCurrentUser(user);
                
                if (window.authRole === 'admin') {
                    AppState.currentAdmin = user;
                    showToast("Login Successful", "Welcome back, Administrator.", "success");
                    navigate('admin');
                } else {
                    AppState.currentStudent = user;
                    AppState.privacyAccepted = false;
                    showToast("Login Successful", `Welcome back, student.`, "success");
                    navigate('privacy');
                }
            } 
            else if (window.authMode === 'register') {
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                const confirmPassword = document.getElementById('auth-confirm-password').value;
                const tosChecked = document.getElementById('auth-tos').checked;
                
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match. Please verify.");
                }
                if (!tosChecked) {
                    throw new Error("You must accept the Terms of Service to register.");
                }

                await Api.registerStudent(email, password, tosChecked);
                showToast("Account Created", "Registration successful. You can now log in.", "success");
                window.authMode = 'login';
                renderLogin();
            } 
            else if (window.authMode === 'forgot') {
                const email = document.getElementById('auth-email').value.trim();
                
                const exists = await Api.checkStudentEmailExists(email);
                if (!exists) {
                    throw new Error("No account found with this email. Please sign up.");
                }

                const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                window.resetEmail = email;
                window.resetOtp = otpCode;

                await Api.sendPasswordResetOtp(email, otpCode);
                showToast("Verification Code Sent", "Verification OTP sent to your email. Check outbox logs.", "success");
                
                window.authMode = 'otp';
                renderLogin();
            } 
            else if (window.authMode === 'otp') {
                const enteredOtp = document.getElementById('auth-otp').value.trim();
                if (enteredOtp !== window.resetOtp) {
                    throw new Error("Invalid OTP code. Please check the logs and try again.");
                }
                showToast("OTP Verified", "Please choose a new password.", "success");
                window.authMode = 'reset';
                renderLogin();
            } 
            else if (window.authMode === 'reset') {
                const password = document.getElementById('auth-password').value;
                const confirmPassword = document.getElementById('auth-confirm-password').value;
                
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match.");
                }

                await Api.resetStudentPassword(window.resetEmail, password);
                showToast("Password Reset Successful", "You can now log in with your new password.", "success");
                
                window.resetOtp = null;
                window.resetEmail = null;
                window.authMode = 'login';
                renderLogin();
            }
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.style.display = 'block';
            submitBtn.removeAttribute('disabled');
            submitBtn.innerHTML = originalText;
            replaceIcons(authForm);
        }
    });
}

// 3. Privacy Notice View
function renderPrivacyNotice() {
    appViewport.innerHTML = `
        <div class="privacy-container animate-slide-up">
            <div class="card">
                <div class="card-header" style="text-align:left;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <div class="success-icon-badge" style="width:48px; height:48px; margin:0; background-color:var(--primary-light); color:var(--primary);">
                            <span data-icon="shield" data-size="24"></span>
                        </div>
                        <h2 class="card-title" style="margin:0; font-size:1.45rem;">Confidentiality & Privacy Agreement</h2>
                    </div>
                    <p class="text-sm text-muted">Review these protective protocols before submitting and tracking grievances</p>
                </div>
                
                <div class="privacy-notice-box">
                    <h4 class="font-semibold text-sm">Official College Safety Protocol</h4>
                    <p class="text-xs text-muted" style="margin-top:4px; line-height:1.5;">
                        DVR & Dr. HS MIC College of Technology ensures absolute protection under the university administrative charters. Your identity is legally protected.
                    </p>
                </div>

                <ul class="privacy-points">
                    <li>
                        <strong>Encrypted Identifiers:</strong> Your college roll number and email are locked at the database level (Supabase Auth RLS) and cannot be queried by general workers.
                    </li>
                    <li>
                        <strong>Direct Administrative Escapes:</strong> Only authorized members of the central college Discipline Board hold decryption credentials.
                    </li>
                    <li>
                        <strong>Non-Retaliation Policy:</strong> Zero-tolerance regulations protect students from faculty, staff, or student-led retaliation when reporting grievances.
                    </li>
                </ul>

                <div style="display:flex; gap:12px; justify-content:flex-end;">
                    <button class="btn btn-outline" id="privacy-decline-btn">Decline</button>
                    <button class="btn btn-primary" id="privacy-accept-btn">Agree and Continue</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('privacy-decline-btn').addEventListener('click', () => {
        State.setCurrentUser(null);
        AppState.currentStudent = null;
        AppState.privacyAccepted = false;
        navigate('landing');
    });

    document.getElementById('privacy-accept-btn').addEventListener('click', () => {
        AppState.privacyAccepted = true;
        navigate('student-dashboard');
    });
}

// 4. Student Dashboard View
function renderStudentDashboard() {
    // Filter complaints matching this student's email
    const studentEmail = AppState.currentStudent.email;
    const allComplaints = State.getComplaints();
    const studentComplaints = allComplaints.filter(c => c.studentEmail.toLowerCase() === studentEmail.toLowerCase());

    const activeCount = studentComplaints.filter(c => ['Submitted', 'Under Review', 'Assigned'].includes(c.status)).length;
    const resolvedCount = studentComplaints.filter(c => c.status === 'Resolved').length;
    const closedCount = studentComplaints.filter(c => c.status === 'Closed').length;

    appViewport.innerHTML = `
        <div class="animate-slide-up">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px; flex-wrap:wrap; gap:16px;">
                <div>
                    <h1 style="font-size:2rem;">Dashboard</h1>
                    <p class="text-sm text-muted">Securely manage grievances associated with <span class="font-semibold text-sm" style="color:var(--secondary);">${studentEmail}</span></p>
                </div>
                <button class="btn btn-primary" id="dash-btn-new-grv">
                    <span data-icon="plus" data-size="18"></span> Submit Grievance
                </button>
            </div>

            <!-- Stats Boxes -->
            <div class="admin-stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:32px;">
                <div class="stat-widget">
                    <div class="stat-widget-info">
                        <span class="stat-widget-label">Active Reports</span>
                        <span class="stat-widget-val">${activeCount}</span>
                    </div>
                    <div class="stat-widget-icon" style="background-color:var(--warning-light); color:var(--warning);">
                        <span data-icon="clock" data-size="24"></span>
                    </div>
                </div>
                
                <div class="stat-widget">
                    <div class="stat-widget-info">
                        <span class="stat-widget-label">Resolved</span>
                        <span class="stat-widget-val">${resolvedCount}</span>
                    </div>
                    <div class="stat-widget-icon" style="background-color:var(--success-light); color:var(--success);">
                        <span data-icon="check-circle" data-size="24"></span>
                    </div>
                </div>
                
                <div class="stat-widget">
                    <div class="stat-widget-info">
                        <span class="stat-widget-label">Closed Cases</span>
                        <span class="stat-widget-val">${closedCount}</span>
                    </div>
                    <div class="stat-widget-icon" style="background-color:#F1F5F9; color:var(--text-muted);">
                        <span data-icon="shield" data-size="24"></span>
                    </div>
                </div>
            </div>

            <!-- Dashboard Grid Action Cards -->
            <div class="dashboard-grid">
                <div class="action-card" id="card-new-grievance">
                    <div class="action-card-icon">
                        <span data-icon="plus" data-size="24"></span>
                    </div>
                    <h3 class="action-card-title">Raise Complaint</h3>
                    <p class="action-card-desc">Submit hostel cleaning, mess quality, classroom project, student bullying, or faculty issue reports securely.</p>
                </div>
                
                <div class="action-card" id="card-track-grievance">
                    <div class="action-card-icon">
                        <span data-icon="search" data-size="24"></span>
                    </div>
                    <h3 class="action-card-title">Track Complaint</h3>
                    <p class="action-card-desc">Enter your generated Complaint ID to check active workflows, assignee groups, and resolutions.</p>
                </div>
                
                <div class="action-card" id="card-history">
                    <div class="action-card-icon">
                        <span data-icon="history" data-size="24"></span>
                    </div>
                    <h3 class="action-card-title">Complaint History</h3>
                    <p class="action-card-desc">Access archives of your resolved and closed grievances, read logs, and verify department actions.</p>
                </div>
                
                <div class="action-card" id="card-help">
                    <div class="action-card-icon">
                        <span data-icon="help" data-size="24"></span>
                    </div>
                    <h3 class="action-card-title">Help & Support</h3>
                    <p class="action-card-desc">Learn about grievance policies, non-retaliation rules, and direct emergency board numbers.</p>
                </div>
            </div>

            <!-- Recent Grievance Submissions Table -->
            <div class="section-card" id="history-section">
                <div class="section-title-bar">
                    <h2 style="font-size:1.25rem;">My Submission Archive</h2>
                    <span class="text-xs text-muted">Updates are automated on change</span>
                </div>
                
                <div class="table-container">
                    ${studentComplaints.length === 0 ? `
                        <div class="empty-state">
                            <span class="empty-state-icon" data-icon="file" data-size="48"></span>
                            <h3 class="empty-state-title">No Grievances Submitted</h3>
                            <p class="empty-state-desc">You have not submitted any complaints yet. Use the Submit Grievance button above to report an issue.</p>
                        </div>
                    ` : `
                        <table class="table-custom">
                            <thead>
                                <tr>
                                    <th>Grievance ID</th>
                                    <th>Category</th>
                                    <th>Type</th>
                                    <th>Date Submitted</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${studentComplaints.map(c => `
                                    <tr>
                                        <td class="font-semibold text-sm" style="font-family:monospace;">${c.id}</td>
                                        <td>${c.category}</td>
                                        <td class="text-sm">${c.complaintType}</td>
                                        <td class="text-sm">${new Date(c.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <span class="badge badge-priority-${c.priority.toLowerCase()}">${c.priority}</span>
                                        </td>
                                        <td>
                                            <span class="badge badge-${getStatusClass(c.status)}">${c.status}</span>
                                        </td>
                                        <td class="text-right">
                                            <button class="btn btn-outline btn-sm btn-view-detail" data-id="${c.id}">
                                                <span data-icon="eye" data-size="14"></span> View Detail
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        </div>
    `;

    // Dynamic triggers
    document.getElementById('dash-btn-new-grv').addEventListener('click', () => navigate('raise-complaint'));
    document.getElementById('card-new-grievance').addEventListener('click', () => navigate('raise-complaint'));
    document.getElementById('card-track-grievance').addEventListener('click', () => navigate('track'));
    
    document.getElementById('card-history').addEventListener('click', () => {
        document.getElementById('history-section').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('card-help').addEventListener('click', () => {
        showHelpModal();
    });

    // View details button actions
    appViewport.querySelectorAll('.btn-view-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const complaintId = btn.getAttribute('data-id');
            const grievance = studentComplaints.find(c => c.id === complaintId);
            if (grievance) {
                showStudentGrievanceDetailModal(grievance);
            }
        });
    });
}

function getStatusClass(status) {
    if (status === 'Submitted') return 'submitted';
    if (status === 'Under Review') return 'review';
    if (status === 'Assigned') return 'assigned';
    if (status === 'Resolved') return 'resolved';
    return 'closed';
}

// Help & Support Modal
function showHelpModal() {
    const overlay = document.getElementById('global-modal-overlay');
    const windowEl = document.getElementById('global-modal-window');
    
    windowEl.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">Grievance Portal Help</h3>
            <button class="modal-close-btn" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <h4 class="font-semibold text-sm" style="color:var(--primary); margin-bottom:10px;">Security & Non-Retaliation Policy</h4>
            <p class="text-sm text-muted" style="margin-bottom:20px; line-height:1.6;">
                DVR & Dr. HS MIC College of Technology operates under a zero-retaliation charter. Submitting complaints is protected by law. 
                Your identity is automatically fetched from your authenticated Google workspace account, and is fully encrypted, hidden from all departmental workers, 
                and accessible only by the Central Discipline Head.
            </p>
            
            <h4 class="font-semibold text-sm" style="color:var(--primary); margin-bottom:10px;">Direct Escalation Channels</h4>
            <table class="table-custom text-sm" style="margin-top:10px;">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Emergency Channel</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Hostel Committee</td>
                        <td>9959593027 (Warden Office)</td>
                    </tr>
                    <tr>
                        <td>Food/Mess Services</td>
                        <td>9391781748 (Canteen Head)</td>
                    </tr>
                    <tr>
                        <td>Discipline Committee</td>
                        <td>discipline.committee@mictech.ac.in</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary btn-sm" id="modal-close-ok">Dismiss</button>
        </div>
    `;

    overlay.classList.add('show');

    const closeModal = () => overlay.classList.remove('show');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-close-ok').addEventListener('click', closeModal);
}

// Student View Detail Modal
function showStudentGrievanceDetailModal(grv) {
    const overlay = document.getElementById('global-modal-overlay');
    const windowEl = document.getElementById('global-modal-window');
    
    windowEl.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">Grievance: ${grv.id}</h3>
            <button class="modal-close-btn" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <div class="grv-details-meta">
                <div class="grv-meta-item">
                    <label>Category</label>
                    <span>${grv.category}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Complaint Type</label>
                    <span>${grv.complaintType}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Date Submitted</label>
                    <span>${new Date(grv.createdAt).toLocaleString()}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Workflow Status</label>
                    <span class="badge badge-${getStatusClass(grv.status)}">${grv.status}</span>
                </div>
            </div>

            ${grv.category === 'Bus Issues' ? `
                <div class="grv-details-meta" style="margin-top:-12px; margin-bottom:24px; background-color:var(--secondary-light); border:1px solid rgba(29, 112, 184, 0.15);">
                    <div class="grv-meta-item">
                        <label>Bus Number</label>
                        <span class="font-semibold text-sm" style="font-family:monospace; color:var(--primary);">${grv.busNumber || 'N/A'}</span>
                    </div>
                    <div class="grv-meta-item">
                        <label>Bus Route / Area</label>
                        <span class="font-semibold text-sm">${grv.busRoute || 'N/A'}</span>
                    </div>
                </div>
            ` : ''}

            <div class="grv-desc-box">
                <h4 class="font-semibold text-sm">Student Description</h4>
                <p class="text-sm" style="margin-top:6px; background-color:var(--bg-main); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border);">${grv.description}</p>
            </div>

            ${grv.attachmentUrl ? `
                <div style="margin-top:20px;">
                    <h4 class="font-semibold text-sm" style="margin-bottom:8px;">File Attachment</h4>
                    <a href="${grv.attachmentUrl}" target="_blank" class="btn btn-secondary btn-sm" style="width:100%;">
                        <span data-icon="file" data-size="14"></span> View Uploaded File (${grv.attachmentName || 'Open Attachment'})
                    </a>
                </div>
            ` : ''}

            ${grv.status === 'Resolved' || grv.status === 'Closed' ? `
                <div class="grv-resolution-box">
                    <h4 class="font-semibold text-sm">Resolution Action Details</h4>
                    <p class="text-sm" style="margin-top:6px; font-weight:500;">
                        ${grv.resolutionNotes || 'The issue has been resolved by the respective board. No comments left.'}
                    </p>
                    <span class="text-xs" style="color:var(--success); margin-top:8px; display:block;">Completed on: ${new Date(grv.updatedAt).toLocaleDateString()}</span>
                </div>
            ` : `
                <div style="margin-top:20px; border-left:3px solid var(--info); background-color:var(--info-light); padding:12px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
                    <p class="text-xs font-semibold" style="color:var(--info);">Review Process Active</p>
                    <p class="text-xs text-muted" style="margin-top:4px;">Discipline managers are actively reviewing details. Email routing has successfully alerted the board.</p>
                </div>
            `}
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary btn-sm" id="modal-close-done">OK</button>
        </div>
    `;

    overlay.classList.add('show');
    replaceIcons(windowEl);

    const closeModal = () => overlay.classList.remove('show');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-close-done').addEventListener('click', closeModal);
}

// 5. Raise Complaint Form View
function renderRaiseComplaint() {
    appViewport.innerHTML = `
        <div class="animate-slide-up" style="max-width:800px; margin:0 auto; padding-bottom: 60px;">
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:30px;">
                <button class="btn btn-outline btn-sm" id="form-btn-back">
                    <span data-icon="arrow-left" data-size="16"></span> Back
                </button>
                <div>
                    <h1 style="font-size:1.8rem; margin:0;">Raise Confidential Complaint</h1>
                    <p class="text-xs text-muted">All details are routed anonymously. Identity is restricted.</p>
                </div>
            </div>

            <div class="card">
                <form id="grievance-form">
                    <!-- Dropdown Category -->
                    <div class="form-group">
                        <label class="form-label" for="grv-category">Select Complaint Category</label>
                        <select class="form-control" id="grv-category" required>
                            <option value="" disabled selected>Choose a category...</option>
                            ${State.getCategories().map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Dropdown Sub-category (Dynamic) -->
                    <div class="form-group" id="group-grv-type" style="display:none;">
                        <label class="form-label" for="grv-type">Select Specific Issue Type</label>
                        <select class="form-control" id="grv-type" required>
                            <option value="" disabled selected>Select issue...</option>
                        </select>
                    </div>

                    <!-- Other Textbox (Dynamic) -->
                    <div class="form-group" id="group-grv-other" style="display:none;">
                        <label class="form-label" for="grv-other-specify">Specify Custom Issue</label>
                        <input type="text" class="form-control" id="grv-other-specify" placeholder="Type specific problem here...">
                    </div>

                    <!-- Bus Specific Fields (Dynamic, injected for Bus Issues) -->
                    <div id="group-grv-bus-fields" style="display:none;">
                        <div class="form-group">
                            <label class="form-label" for="grv-bus-number">Bus Number (Required)</label>
                            <input type="text" class="form-control" id="grv-bus-number" placeholder="e.g. AP16 XX 1234">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="grv-bus-route">Bus Route / Area (Required)</label>
                            <input type="text" class="form-control" id="grv-bus-route" placeholder="e.g. Vijayawada → College">
                        </div>
                    </div>

                    <!-- Description Textbox -->
                    <div class="form-group">
                        <label class="form-label" for="grv-description">Detailed Description of Concern</label>
                        <textarea class="form-control" id="grv-description" required 
                            placeholder="Explain details of the problem clearly. Include date, details, and specifics. Do NOT type your personal name or roll number here, your session details will automatically authenticate you for administrators."></textarea>
                    </div>

                    <!-- File Upload Component -->
                    <div class="form-group">
                        <label class="form-label">Supporting Evidence / Document (Optional)</label>
                        <div class="file-upload-zone" id="file-drop-zone">
                            <div class="upload-icon">
                                <span data-icon="file" data-size="32"></span>
                            </div>
                            <h4 class="font-semibold text-sm">Drag & Drop file here, or click to browse</h4>
                            <p class="text-xs text-muted" style="margin-top:4px;">Supports JPG, PNG, PDF files (Max 5MB)</p>
                            <input type="file" id="grv-file-input" class="file-upload-input" accept="image/jpeg,image/png,application/pdf">
                        </div>
                        <div id="file-preview-wrapper"></div>
                    </div>

                    <button class="btn btn-primary btn-lg" type="submit" style="width:100%; margin-top:20px;" id="grv-submit-btn">
                        Submit Complaint Securely
                    </button>
                </form>
            </div>
        </div>
    `;

    const backBtn = document.getElementById('form-btn-back');
    const form = document.getElementById('grievance-form');
    const categorySelect = document.getElementById('grv-category');
    const typeGroup = document.getElementById('group-grv-type');
    const typeSelect = document.getElementById('grv-type');
    const otherGroup = document.getElementById('group-grv-other');
    const otherInput = document.getElementById('grv-other-specify');
    const fileInput = document.getElementById('grv-file-input');
    const fileDropZone = document.getElementById('file-drop-zone');
    const filePreviewWrapper = document.getElementById('file-preview-wrapper');
    const submitBtn = document.getElementById('grv-submit-btn');

    let selectedFile = null;

    backBtn.addEventListener('click', () => navigate('student-dashboard'));

    // Dynamic dropdown cascade logic
    categorySelect.addEventListener('change', () => {
        const selectedCategory = categorySelect.value;
        const typesMap = State.getComplaintTypes();
        const subTypes = typesMap[selectedCategory] || [];
        
        typeSelect.innerHTML = `<option value="" disabled selected>Select issue...</option>`;
        subTypes.forEach(t => {
            typeSelect.innerHTML += `<option value="${t}">${t}</option>`;
        });

        typeGroup.style.display = 'block';
        otherGroup.style.display = 'none';
        otherInput.removeAttribute('required');

        // Dynamic Bus Issues toggle
        if (selectedCategory === "Bus Issues") {
            document.getElementById('group-grv-bus-fields').style.display = 'block';
            document.getElementById('grv-bus-number').setAttribute('required', 'true');
            document.getElementById('grv-bus-route').setAttribute('required', 'true');
        } else {
            document.getElementById('group-grv-bus-fields').style.display = 'none';
            document.getElementById('grv-bus-number').removeAttribute('required');
            document.getElementById('grv-bus-route').removeAttribute('required');
        }
    });

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'Other') {
            otherGroup.style.display = 'block';
            otherInput.setAttribute('required', 'true');
        } else {
            otherGroup.style.display = 'none';
            otherInput.removeAttribute('required');
        }
    });

    // File Upload Zones
    fileDropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--primary)';
        fileDropZone.style.backgroundColor = 'var(--primary-light)';
    });

    fileDropZone.addEventListener('dragleave', () => {
        fileDropZone.style.borderColor = 'var(--border)';
        fileDropZone.style.backgroundColor = 'var(--bg-main)';
    });

    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--border)';
        fileDropZone.style.backgroundColor = 'var(--bg-main)';
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        if (files && files.length > 0) {
            const file = files[0];
            const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!validTypes.includes(file.type)) {
                showToast("Invalid File Format", "Please attach a valid JPG, PNG, or PDF file.", "warning");
                return;
            }

            if (file.size > maxSize) {
                showToast("File Too Large", "Maximum size allowed is 5MB.", "warning");
                return;
            }

            selectedFile = file;
            renderFilePreview();
        }
    }

    function renderFilePreview() {
        if (selectedFile) {
            filePreviewWrapper.innerHTML = `
                <div class="file-preview-card">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span data-icon="file" data-size="18"></span>
                        <div style="display:flex; flex-direction:column;">
                            <span class="font-semibold text-sm" style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${selectedFile.name}</span>
                            <span class="text-xs text-muted">${(selectedFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm" id="btn-remove-file" style="padding:4px 8px;">Remove</button>
                </div>
            `;
            replaceIcons(filePreviewWrapper);
            
            document.getElementById('btn-remove-file').addEventListener('click', () => {
                selectedFile = null;
                filePreviewWrapper.innerHTML = '';
                fileInput.value = '';
            });
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const category = categorySelect.value;
        let type = typeSelect.value;
        if (type === 'Other') {
            type = `Other (${otherInput.value})`;
        }
        const description = document.getElementById('grv-description').value.trim();
        const studentEmail = AppState.currentStudent.email;

        // Validation Toast
        if (!category || !type || !description) {
            showToast("Please complete all required fields before submitting.", "", "warning");
            return;
        }

        // Parse Bus specific parameters
        const extraFields = {};
        if (category === 'Bus Issues') {
            const busNumber = document.getElementById('grv-bus-number').value.trim();
            const busRoute = document.getElementById('grv-bus-route').value.trim();
            if (!busNumber || !busRoute) {
                showToast("Please complete all required fields before submitting.", "", "warning");
                return;
            }
            extraFields.busNumber = busNumber;
            extraFields.busRoute = busRoute;
        }

        // Loading State: Disable button and show custom text
        submitBtn.setAttribute('disabled', 'true');
        submitBtn.innerHTML = `<span class="skeleton-row" style="height:20px; width:20px; display:inline-block; border-radius:50%; margin-right:8px; vertical-align:middle;"></span> Submitting your complaint...`;

        try {
            const complaint = await Api.createGrievance(category, type, description, selectedFile, studentEmail, extraFields);
            
            // Clear the form
            form.reset();
            selectedFile = null;
            if (filePreviewWrapper) filePreviewWrapper.innerHTML = '';
            
            // Success Toast
            showToast("Complaint Submitted Successfully", `Your Complaint ID: ${complaint.id}<br/>Your complaint has been securely forwarded to the appropriate authority.`, "success");
            
            // Redirect
            navigate('success', { complaint });
        } catch (error) {
            // Error Toast
            showToast("Unable to submit complaint.", "Please try again or contact the administrator.", "error");
            submitBtn.removeAttribute('disabled');
            submitBtn.innerHTML = "Submit Complaint Securely";
        }
    });
}

// 6. Success Screen View
function renderSuccessScreen() {
    const grv = AppState.lastSubmittedComplaint;
    if (!grv) {
        navigate('student-dashboard');
        return;
    }

    // Determine authority routed details based on category logic
    let authorityText = "the Central Discipline Head";
    if (grv.category === "Hostel Issues") {
        authorityText = "the Hostel Warden (routed with emergency contact 9959593027)";
    } else if (grv.category === "Food Issues") {
        authorityText = "the Mess/Canteen supervisor (routed with support contact 9391781748)";
    } else if (grv.category === "Campus Issues") {
        authorityText = "the respective Campus Facilities Head of Department (HOD)";
    } else if (grv.category === "Complaint Against Faculty") {
        authorityText = "the Special Discipline Review Committee directly (fully confidential)";
    } else if (grv.category === "Bus Issues") {
        authorityText = "the Bus Management team (routed with support contact 7330820239)";
    }

    appViewport.innerHTML = `
        <div class="card success-screen animate-slide-up">
            <div class="success-icon-badge">
                <span data-icon="check-circle" data-size="48"></span>
            </div>
            <h1 style="font-size:1.8rem; color:var(--success); margin-bottom:8px;">Grievance Logged Successfully</h1>
            <p class="text-sm text-muted">
                Your report has been encrypted and submitted. Real-time HTML alerts have been routed to ${authorityText}.
            </p>

            <div class="success-id-box">
                <span class="success-id-label">Your Tracking ID</span>
                <span class="success-id-val" id="copy-target">${grv.id}</span>
            </div>

            <p class="text-xs text-muted" style="margin-bottom:30px; line-height:1.5;">
                <strong>IMPORTANT:</strong> Save this ID to track resolution states. Your personal identity remains fully hidden inside database structures, complying with college security charters.
            </p>

            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                <button class="btn btn-outline" id="success-btn-dash">Back to Dashboard</button>
                <button class="btn btn-primary" id="success-btn-track">Track Progress</button>
            </div>
        </div>
    `;

    document.getElementById('success-btn-dash').addEventListener('click', () => navigate('student-dashboard'));
    document.getElementById('success-btn-track').addEventListener('click', () => {
        navigate('track', { searchId: grv.id });
    });
}

// 7. Track Complaint View
function renderTrackComplaint() {
    appViewport.innerHTML = `
        <div class="animate-slide-up" style="max-width:800px; margin:0 auto;">
            <div class="card track-search-card">
                <h1 style="font-size:1.5rem; text-align:center; margin-bottom:8px;">Track Grievance Resolution</h1>
                <p class="text-xs text-muted text-center" style="margin-bottom:24px;">Enter a unique Complaint ID to check real-time pipeline status</p>
                
                <form id="track-search-form">
                    <div style="display:flex; gap:12px;">
                        <div class="input-icon-container" style="flex:1;">
                            <span class="input-icon" data-icon="search" data-size="18"></span>
                            <input class="form-control" type="text" id="track-search-input" 
                                placeholder="GRV-XXXX-XX" required style="text-transform:uppercase;"
                                value="${AppState.searchId || ''}">
                        </div>
                        <button class="btn btn-primary" type="submit">Search</button>
                    </div>
                </form>
            </div>

            <div id="track-results-container"></div>
        </div>
    `;

    const searchForm = document.getElementById('track-search-form');
    const searchInput = document.getElementById('track-search-input');
    const resultsContainer = document.getElementById('track-results-container');

    // Run search if an ID was passed in context
    if (AppState.searchId) {
        performTrackingSearch(AppState.searchId, resultsContainer);
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = searchInput.value.trim().toUpperCase();
        AppState.searchId = id;
        performTrackingSearch(id, resultsContainer);
    });
}

function performTrackingSearch(id, container) {
    const allComplaints = State.getComplaints();
    const grv = allComplaints.find(c => c.id.toUpperCase() === id);

    if (!grv) {
        container.innerHTML = `
            <div class="card text-center" style="padding:40px;">
                <span class="empty-state-icon" data-icon="alert-circle" data-size="40" style="color:var(--danger);"></span>
                <h3 class="font-semibold text-sm" style="margin-top:12px;">Grievance ID Not Found</h3>
                <p class="text-xs text-muted" style="margin-top:6px; max-width:320px; margin-left:auto; margin-right:auto;">
                    We could not locate any complaint matching "${id}". Ensure you typed it correctly including format prefixes (e.g. GRV-1234-AB).
                </p>
            </div>
        `;
        replaceIcons(container);
        return;
    }

    // Draw the progress timeline
    const statuses = ['Submitted', 'Under Review', 'Assigned', 'Resolved', 'Closed'];
    const currentIdx = statuses.indexOf(grv.status);
    const progressPercent = Math.max(0, (currentIdx / (statuses.length - 1)) * 100);

    container.innerHTML = `
        <div class="card animate-fade-in" style="padding:32px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
                <div>
                    <span class="text-xs text-muted">Tracking ID: ${grv.id}</span>
                    <h2 style="font-size:1.3rem; color:var(--primary); margin:2px 0 0 0;">${grv.category}</h2>
                </div>
                <div style="text-align:right;">
                    <span class="badge badge-priority-${grv.priority.toLowerCase()}" style="margin-right:8px;">${grv.priority} Priority</span>
                    <span class="badge badge-${getStatusClass(grv.status)}">${grv.status}</span>
                </div>
            </div>

            <!-- Horizontal Timeline component -->
            <div class="track-timeline">
                <div class="timeline-progress-bar">
                    <div class="timeline-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="timeline-steps">
                    ${statuses.map((st, idx) => {
                        let stepClass = '';
                        if (idx < currentIdx) stepClass = 'completed';
                        else if (idx === currentIdx) stepClass = 'active';
                        
                        return `
                            <div class="timeline-step ${stepClass}">
                                <div class="timeline-step-node">
                                    ${idx < currentIdx ? '✓' : idx + 1}
                                </div>
                                <span class="timeline-step-label">${st}</span>
                                <span class="timeline-step-date">
                                    ${idx === 0 ? new Date(grv.createdAt).toLocaleDateString() : (idx === currentIdx ? new Date(grv.updatedAt).toLocaleDateString() : '')}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Concern Details Box -->
            <div class="timeline-details animate-slide-up">
                <div style="margin-bottom:16px;">
                    <span class="text-xs text-muted font-semibold" style="display:block; margin-bottom:4px;">Concern Type:</span>
                    <span class="text-sm font-semibold">${grv.complaintType}</span>
                </div>
                
                <div style="margin-bottom:16px;">
                    <span class="text-xs text-muted font-semibold" style="display:block; margin-bottom:4px;">Description:</span>
                    <p class="text-xs" style="color:var(--text); line-height:1.5;">${grv.description}</p>
                </div>

                ${grv.attachmentUrl ? `
                    <div style="margin-bottom:16px;">
                        <span class="text-xs text-muted font-semibold" style="display:block; margin-bottom:4px;">Uploaded Attachment:</span>
                        <a href="${grv.attachmentUrl}" target="_blank" class="text-xs" style="color:var(--secondary); text-decoration:underline;">
                            ${grv.attachmentName || 'View R2 file attachment'}
                        </a>
                    </div>
                ` : ''}

                ${grv.status === 'Resolved' || grv.status === 'Closed' ? `
                    <div style="background-color:var(--success-light); border-left:3px solid var(--success); padding:16px; border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin-top:20px;">
                        <span class="text-xs font-bold" style="color:var(--success); display:block; margin-bottom:4px;">Resolution Notes:</span>
                        <p class="text-xs font-medium">${grv.resolutionNotes || 'The complaint has been successfully resolved by the designated officer.'}</p>
                    </div>
                ` : `
                    <div style="background-color:var(--secondary-light); border-left:3px solid var(--secondary); padding:16px; border-radius:0 var(--radius-sm) var(--radius-sm) 0; margin-top:20px;">
                        <span class="text-xs font-bold" style="color:var(--secondary); display:block; margin-bottom:4px;">Active Pipeline Action:</span>
                        <p class="text-xs text-muted">Currently undergoing validation and routing protocols. Contact metrics sent to HODs.</p>
                    </div>
                `}
            </div>
        </div>
    `;
    replaceIcons(container);
}

// ==========================================================================
// ADMIN PORTAL MAIN VIEW
// ==========================================================================
function renderAdminPortal() {
    appViewport.innerHTML = `
        <div class="admin-layout animate-fade-in">
            <!-- Sidebar COLLAPSED state controlled by class -->
            <aside class="admin-sidebar ${AppState.sidebarCollapsed ? 'collapsed' : ''}" id="sidebar-el">
                <div class="admin-sidebar-header">
                    <div class="admin-logo-wrapper">
                        <img src="assets/mic-logo.png" alt="MIC Logo" onerror="this.src='https://via.placeholder.com/40?text=MIC'">
                        <span>MIC Grievance</span>
                    </div>
                    <button class="sidebar-toggle-btn" id="btn-sidebar-toggle">
                        <span data-icon="menu" data-size="20"></span>
                    </button>
                </div>
                
                <div class="admin-sidebar-menu">
                    <button class="admin-menu-item ${AppState.adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
                        <span data-icon="dashboard" data-size="18"></span>
                        <span>Dashboard</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'complaints' ? 'active' : ''}" data-tab="complaints">
                        <span data-icon="list" data-size="18"></span>
                        <span>Complaints Manager</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'categories' ? 'active' : ''}" data-tab="categories">
                        <span data-icon="category" data-size="18"></span>
                        <span>Categories</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'types' ? 'active' : ''}" data-tab="types">
                        <span data-icon="plus" data-size="18"></span>
                        <span>Complaint Types</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'contacts' ? 'active' : ''}" data-tab="contacts">
                        <span data-icon="phone" data-size="18"></span>
                        <span>Dept Contacts</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'email-logs' ? 'active' : ''}" data-tab="email-logs">
                        <span data-icon="mail" data-size="18"></span>
                        <span>Email Routing Logs</span>
                    </button>
                    <button class="admin-menu-item ${AppState.adminTab === 'settings' ? 'active' : ''}" data-tab="settings">
                        <span data-icon="settings" data-size="18"></span>
                        <span>Settings</span>
                    </button>
                    
                    <div style="flex:1;"></div>
                    
                    <button class="admin-menu-item logout-item" id="btn-admin-logout">
                        <span data-icon="logout" data-size="18"></span>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            
            <div class="admin-main-viewport ${AppState.sidebarCollapsed ? 'expanded' : ''}" id="main-viewport-el">
                <div class="admin-top-bar">
                    <h2 style="font-size:1.15rem; color:var(--text);" id="admin-view-title">Admin Panel</h2>
                    <div style="display:flex; align-items:center; gap:16px;">
                        <span class="badge badge-submitted" style="font-weight:600;">Developer Mock Mode</span>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="action-card-icon" style="width:32px; height:32px; margin:0; border-radius:50%; background-color:var(--primary-light); color:var(--primary);">
                                <span data-icon="user" data-size="16"></span>
                            </div>
                            <span class="text-xs font-semibold">${AppState.currentAdmin.email}</span>
                        </div>
                    </div>
                </div>
                
                <div class="admin-viewport-content" id="admin-tab-viewport">
                    <!-- Dynamic Sub-view injected here -->
                </div>
            </div>
        </div>
    `;

    // Collapsible Sidebar logic
    const sidebarEl = document.getElementById('sidebar-el');
    const mainViewportEl = document.getElementById('main-viewport-el');
    const sidebarToggle = document.getElementById('btn-sidebar-toggle');
    
    sidebarToggle.addEventListener('click', () => {
        AppState.sidebarCollapsed = !AppState.sidebarCollapsed;
        if (AppState.sidebarCollapsed) {
            sidebarEl.classList.add('collapsed');
            mainViewportEl.classList.add('expanded');
        } else {
            sidebarEl.classList.remove('collapsed');
            mainViewportEl.classList.remove('expanded');
        }
    });

    // Tab items routing
    const menuItems = document.querySelectorAll('.admin-menu-item:not(.logout-item)');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            const tabName = item.getAttribute('data-tab');
            AppState.adminTab = tabName;
            renderAdminSubTab();
        });
    });

    // Logout
    document.getElementById('btn-admin-logout').addEventListener('click', () => {
        State.setCurrentUser(null);
        AppState.currentAdmin = null;
        navigate('landing');
    });

    // Init display
    renderAdminSubTab();
}

function renderAdminSubTab() {
    const tabViewport = document.getElementById('admin-tab-viewport');
    const titleEl = document.getElementById('admin-view-title');
    
    // Clear display dropdown instances
    window.activeDropdownId = null;

    switch (AppState.adminTab) {
        case 'dashboard':
            titleEl.textContent = "Control Dashboard";
            renderAdminDashboard(tabViewport);
            break;
        case 'complaints':
            titleEl.textContent = "Grievance Record Manager";
            renderAdminComplaintsManager(tabViewport);
            break;
        case 'categories':
            titleEl.textContent = "Manage Categories";
            renderAdminCategories(tabViewport);
            break;
        case 'types':
            titleEl.textContent = "Manage Complaint Types";
            renderAdminComplaintTypes(tabViewport);
            break;
        case 'contacts':
            titleEl.textContent = "Department Contacts Setup";
            renderAdminContacts(tabViewport);
            break;
        case 'email-logs':
            titleEl.textContent = "Routed Email Notification Audits";
            renderAdminEmailLogs(tabViewport);
            break;
        case 'settings':
            titleEl.textContent = "System Configuration";
            renderAdminSettings(tabViewport);
            break;
    }

    replaceIcons(tabViewport);
}

// 8.1 Admin Dashboard Sub-view
function renderAdminDashboard(container) {
    const complaints = State.getComplaints();
    
    // Metrics calculations
    const total = complaints.length;
    const pending = complaints.filter(c => ['Submitted', 'Under Review', 'Assigned'].includes(c.status)).length;
    const resolved = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
    
    // Count created today
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const todayCount = complaints.filter(c => new Date(c.createdAt) >= startOfToday).length;

    // Category breakdown
    const categories = State.getCategories();
    const catData = {};
    categories.forEach(cat => {
        catData[cat] = complaints.filter(c => c.category === cat).length;
    });

    // Render stats
    container.innerHTML = `
        <div class="admin-stats-grid animate-slide-up">
            <div class="stat-widget hover-lift">
                <div class="stat-widget-info">
                    <span class="stat-widget-label">Total Grievances</span>
                    <span class="stat-widget-val">${total}</span>
                </div>
                <div class="stat-widget-icon" style="background-color:var(--primary-light); color:var(--primary);">
                    <span data-icon="list" data-size="24"></span>
                </div>
            </div>
            
            <div class="stat-widget hover-lift">
                <div class="stat-widget-info">
                    <span class="stat-widget-label">Pending Action</span>
                    <span class="stat-widget-val">${pending}</span>
                </div>
                <div class="stat-widget-icon" style="background-color:var(--warning-light); color:var(--warning);">
                    <span data-icon="clock" data-size="24"></span>
                </div>
            </div>
            
            <div class="stat-widget hover-lift">
                <div class="stat-widget-info">
                    <span class="stat-widget-label">Resolved / Closed</span>
                    <span class="stat-widget-val">${resolved}</span>
                </div>
                <div class="stat-widget-icon" style="background-color:var(--success-light); color:var(--success);">
                    <span data-icon="check-circle" data-size="24"></span>
                </div>
            </div>
            
            <div class="stat-widget hover-lift">
                <div class="stat-widget-info">
                    <span class="stat-widget-label">Submitted Today</span>
                    <span class="stat-widget-val">${todayCount}</span>
                </div>
                <div class="stat-widget-icon" style="background-color:var(--info-light); color:var(--info);">
                    <span data-icon="plus" data-size="24"></span>
                </div>
            </div>
        </div>

        ${total === 0 ? `
            <div class="card text-center animate-fade-in" style="padding: 48px; margin-top: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 280px;">
                <div class="success-icon-badge" style="width: 64px; height: 64px; background-color: var(--bg-main); border: 1px solid var(--border); color: var(--text-muted); margin-bottom: 20px;">
                    <span data-icon="mail" data-size="28"></span>
                </div>
                <h3 class="font-semibold text-base" style="color: var(--primary); margin-bottom: 8px;">No complaints have been submitted yet.</h3>
                <p class="text-xs text-muted" style="max-width: 400px; margin-bottom: 24px; line-height: 1.6;">
                    The system is active and monitoring database state. When a student logs a grievance, real-time metrics, logs, and categories will appear instantly.
                </p>
                <button class="btn btn-primary" id="btn-refresh-dashboard">
                    <span data-icon="refresh" data-size="16"></span> Refresh Dashboard
                </button>
            </div>
        ` : ''}

        <div class="analytics-section animate-fade-in" style="animation-delay: 0.15s; ${total === 0 ? 'margin-top: 24px;' : ''}">
            <!-- Category Charts -->
            <div class="chart-card" style="flex: 2;">
                <div class="chart-header">
                    <h3 class="font-semibold text-sm" style="color:var(--primary);">Category-wise Distribution Analytics</h3>
                    <span class="text-xs text-muted">Aggregated counts</span>
                </div>
                <div class="bar-chart-container">
                    ${categories.map(cat => {
                        const count = catData[cat] || 0;
                        const percent = total > 0 ? (count / total) * 100 : 0;
                        return `
                            <div class="bar-row">
                                <span class="bar-label">${cat}</span>
                                <div class="bar-track">
                                    <div class="bar-fill" style="width: ${percent}%;"></div>
                                </div>
                                <span class="bar-val">${count}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Quick Info Panel -->
            <div class="chart-card" style="flex: 1;">
                <h3 class="font-semibold text-sm" style="color:var(--primary); margin-bottom:16px;">Quick Actions</h3>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <button class="btn btn-primary" id="btn-quick-view-grv" style="width:100%;">
                        Manage Active Records
                    </button>
                    <button class="btn btn-outline" id="btn-quick-emails" style="width:100%;">
                        Inspect Routed Email Logs
                    </button>
                    <button class="btn btn-secondary" id="btn-quick-contacts" style="width:100%;">
                        Configure Department Numbers
                    </button>
                </div>
            </div>
        </div>
    `;

    if (total === 0 && document.getElementById('btn-refresh-dashboard')) {
        document.getElementById('btn-refresh-dashboard').addEventListener('click', () => {
            renderAdminSubTab();
        });
    }

    document.getElementById('btn-quick-view-grv').addEventListener('click', () => {
        AppState.adminTab = 'complaints';
        renderAdminPortal();
    });
    
    document.getElementById('btn-quick-emails').addEventListener('click', () => {
        AppState.adminTab = 'email-logs';
        renderAdminPortal();
    });

    document.getElementById('btn-quick-contacts').addEventListener('click', () => {
        AppState.adminTab = 'contacts';
        renderAdminPortal();
    });
}

// 8.2 Admin Complaint Management Sub-view
function renderAdminComplaintsManager(container) {
    const complaints = State.getComplaints();
    const categories = State.getCategories();

    // Filters matching state
    let filtered = complaints;

    if (AppState.selectedCategoryFilter !== 'all') {
        filtered = filtered.filter(c => c.category === AppState.selectedCategoryFilter);
    }
    if (AppState.selectedStatusFilter !== 'all') {
        filtered = filtered.filter(c => c.status === AppState.selectedStatusFilter);
    }
    if (AppState.selectedPriorityFilter !== 'all') {
        filtered = filtered.filter(c => c.priority === AppState.selectedPriorityFilter);
    }
    if (AppState.adminSearchQuery) {
        const query = AppState.adminSearchQuery.toLowerCase().trim();
        filtered = filtered.filter(c => 
            c.id.toLowerCase().includes(query) || 
            c.description.toLowerCase().includes(query) || 
            c.studentEmail.toLowerCase().includes(query) ||
            c.complaintType.toLowerCase().includes(query)
        );
    }

    container.innerHTML = `
        <div class="animate-slide-up">
            <!-- Filter Bar -->
            <div class="section-card" style="padding:20px; margin-bottom:24px;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
                    <!-- Search Input -->
                    <div>
                        <label class="form-label text-xs">Search records</label>
                        <div class="input-icon-container">
                            <span class="input-icon" data-icon="search" data-size="14"></span>
                            <input type="text" class="form-control text-sm" id="admin-search-input" 
                                placeholder="ID, Description, Student email..." value="${AppState.adminSearchQuery}">
                        </div>
                    </div>
                    
                    <!-- Category filter -->
                    <div>
                        <label class="form-label text-xs">Filter Category</label>
                        <select class="form-control text-sm" id="admin-filter-category">
                            <option value="all">All Categories</option>
                            ${categories.map(c => `<option value="${c}" ${AppState.selectedCategoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Status filter -->
                    <div>
                        <label class="form-label text-xs">Filter Status</label>
                        <select class="form-control text-sm" id="admin-filter-status">
                            <option value="all" ${AppState.selectedStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
                            <option value="Submitted" ${AppState.selectedStatusFilter === 'Submitted' ? 'selected' : ''}>Submitted</option>
                            <option value="Under Review" ${AppState.selectedStatusFilter === 'Under Review' ? 'selected' : ''}>Under Review</option>
                            <option value="Assigned" ${AppState.selectedStatusFilter === 'Assigned' ? 'selected' : ''}>Assigned</option>
                            <option value="Resolved" ${AppState.selectedStatusFilter === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="Closed" ${AppState.selectedStatusFilter === 'Closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    </div>

                    <!-- Priority filter -->
                    <div>
                        <label class="form-label text-xs">Filter Priority</label>
                        <select class="form-control text-sm" id="admin-filter-priority">
                            <option value="all" ${AppState.selectedPriorityFilter === 'all' ? 'selected' : ''}>All Priorities</option>
                            <option value="Low" ${AppState.selectedPriorityFilter === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${AppState.selectedPriorityFilter === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${AppState.selectedPriorityFilter === 'High' ? 'selected' : ''}>High</option>
                            <option value="Critical" ${AppState.selectedPriorityFilter === 'Critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Record Table -->
            <div class="section-card">
                <div class="table-container">
                    ${complaints.length === 0 ? `
                        <div class="empty-state animate-fade-in" style="padding: 60px 20px;">
                            <span class="empty-state-icon" data-icon="mail" data-size="48"></span>
                            <h3 class="empty-state-title">No complaints have been submitted yet.</h3>
                            <p class="empty-state-desc">As soon as students raise concerns, real-time reports and analytics will automatically populate here.</p>
                            <button class="btn btn-primary btn-sm" id="btn-refresh-complaints-manager" style="margin-top: 16px;">
                                <span data-icon="refresh" data-size="12"></span> Refresh Dashboard
                            </button>
                        </div>
                    ` : filtered.length === 0 ? `
                        <div class="empty-state">
                            <span class="empty-state-icon" data-icon="filter" data-size="48"></span>
                            <h3 class="empty-state-title">No Grievances Found</h3>
                            <p class="empty-state-desc">No complaints match your active search filter options.</p>
                        </div>
                    ` : `
                        <table class="table-custom">
                            <thead>
                                <tr>
                                    <th>Grievance ID</th>
                                    <th>Category</th>
                                    <th>Complaint Type</th>
                                    <th>Date Submitted</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(c => `
                                    <tr>
                                        <td class="font-semibold text-sm" style="font-family:monospace;">${c.id}</td>
                                        <td class="text-sm">${c.category}</td>
                                        <td class="text-sm">${c.complaintType}</td>
                                        <td class="text-sm">${new Date(c.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <span class="badge badge-priority-${c.priority.toLowerCase()}">${c.priority}</span>
                                        </td>
                                        <td>
                                            <span class="badge badge-${getStatusClass(c.status)}">${c.status}</span>
                                        </td>
                                        <td class="text-right">
                                            <div class="actions-dropdown-container">
                                                <button class="actions-menu-btn" data-id="${c.id}">
                                                    Actions <span data-icon="chevron-down" data-size="12"></span>
                                                </button>
                                                <!-- Dynamic drop-down list -->
                                                <div class="actions-dropdown" id="dropdown-${c.id}">
                                                    <button class="actions-dropdown-item btn-view-grv" data-id="${c.id}">
                                                        <span data-icon="eye" data-size="14"></span> View Detail
                                                    </button>
                                                    <button class="actions-dropdown-item btn-status-grv" data-id="${c.id}" data-status="Under Review">
                                                        <span data-icon="clock" data-size="14"></span> Under Review
                                                    </button>
                                                    <button class="actions-dropdown-item btn-status-grv" data-id="${c.id}" data-status="Assigned">
                                                        <span data-icon="user" data-size="14"></span> Assign Case
                                                    </button>
                                                    <button class="actions-dropdown-item btn-status-grv" data-id="${c.id}" data-status="Resolved">
                                                        <span data-icon="check-circle" data-size="14"></span> Mark Resolved
                                                    </button>
                                                    <button class="actions-dropdown-item btn-status-grv" data-id="${c.id}" data-status="Closed">
                                                        <span data-icon="shield" data-size="14"></span> Close File
                                                    </button>
                                                    <button class="actions-dropdown-item danger btn-delete-grv" data-id="${c.id}">
                                                        <span data-icon="trash" data-size="14"></span> Delete Log
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        </div>
    `;

    if (complaints.length === 0 && document.getElementById('btn-refresh-complaints-manager')) {
        document.getElementById('btn-refresh-complaints-manager').addEventListener('click', () => {
            renderAdminSubTab();
        });
    }

    // Filter event bindings
    const searchInput = document.getElementById('admin-search-input');
    const filterCat = document.getElementById('admin-filter-category');
    const filterStatus = document.getElementById('admin-filter-status');
    const filterPriority = document.getElementById('admin-filter-priority');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            AppState.adminSearchQuery = searchInput.value;
            renderAdminSubTab();
        });
    }
    
    if (filterCat) {
        filterCat.addEventListener('change', () => {
            AppState.selectedCategoryFilter = filterCat.value;
            renderAdminSubTab();
        });
    }
    
    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            AppState.selectedStatusFilter = filterStatus.value;
            renderAdminSubTab();
        });
    }
    
    if (filterPriority) {
        filterPriority.addEventListener('change', () => {
            AppState.selectedPriorityFilter = filterPriority.value;
            renderAdminSubTab();
        });
    }

    // Close any open actions dropdown when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.actions-dropdown-container')) {
            document.querySelectorAll('.actions-dropdown.show').forEach(el => el.classList.remove('show'));
        }
    });

    // Action button triggers
    container.querySelectorAll('.actions-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const targetDropdown = document.getElementById(`dropdown-${id}`);
            
            // Close other dropdowns
            document.querySelectorAll('.actions-dropdown.show').forEach(el => {
                if (el.id !== `dropdown-${id}`) el.classList.remove('show');
            });

            targetDropdown.classList.toggle('show');
        });
    });

    // Detail view action
    container.querySelectorAll('.btn-view-grv').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const grv = complaints.find(c => c.id === id);
            if (grv) showAdminGrievanceModal(grv);
        });
    });

    // Update Status action
    container.querySelectorAll('.btn-status-grv').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const status = btn.getAttribute('data-status');
            
            if (status === 'Resolved') {
                const grv = complaints.find(c => c.id === id);
                if (grv) showResolutionNotesForm(grv);
            } else {
                Api.updateGrievance(id, { status: status }).then(() => {
                    alert(`Grievance status changed successfully to: ${status}`);
                    renderAdminSubTab();
                }).catch(err => alert("Error updating status: " + err.message));
            }
        });
    });

    // Delete Log action
    container.querySelectorAll('.btn-delete-grv').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (confirm(`Are you absolutely sure you want to delete grievance ${id} permanently? This action is irreversible.`)) {
                Api.deleteGrievance(id).then(() => {
                    alert("Log deleted successfully.");
                    renderAdminSubTab();
                }).catch(err => alert("Error deleting grievance: " + err.message));
            }
        });
    });
}

// Show modal dialog to add resolution comments before marking 'Resolved'
function showResolutionNotesForm(grv) {
    const overlay = document.getElementById('global-modal-overlay');
    const windowEl = document.getElementById('global-modal-window');
    
    windowEl.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">Resolve Grievance: ${grv.id}</h3>
            <button class="modal-close-btn" id="modal-close">✕</button>
        </div>
        <form id="form-admin-resolve">
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label" for="grv-res-notes">Resolution Actions Taken</label>
                    <textarea class="form-control" id="grv-res-notes" required 
                        placeholder="Explain the changes made or fixes performed so the student knows their issue is resolved."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline btn-sm" id="btn-res-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">Complete Resolution</button>
            </div>
        </form>
    `;

    overlay.classList.add('show');

    const closeModal = () => overlay.classList.remove('show');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-res-cancel').addEventListener('click', closeModal);
    
    document.getElementById('form-admin-resolve').addEventListener('submit', (e) => {
        e.preventDefault();
        const notes = document.getElementById('grv-res-notes').value;
        Api.updateGrievance(grv.id, { 
            status: 'Resolved',
            resolutionNotes: notes
        }).then(() => {
            alert(`Grievance ${grv.id} has been marked as Resolved.`);
            closeModal();
            renderAdminSubTab();
        }).catch(err => alert("Error saving resolution notes: " + err.message));
    });
}

// Full admin view modal (with student identity decryption toggle)
function showAdminGrievanceModal(grv) {
    const overlay = document.getElementById('global-modal-overlay');
    const windowEl = document.getElementById('global-modal-window');
    
    windowEl.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title">Detailed Grievance Review: ${grv.id}</h3>
            <button class="modal-close-btn" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
            <!-- Security Privacy notice for Admin -->
            <div style="background-color:var(--warning-light); border-left:3px solid var(--warning); padding:12px; border-radius:4px; margin-bottom:20px; font-size:0.8rem; color:var(--warning-hover);">
                <strong>Confidential Student Data:</strong>
                Student identity is encrypted at rest and restricted via DB Policies. Access must be audited under college code-of-conduct bylaws.
            </div>

            <div class="grv-details-meta">
                <div class="grv-meta-item">
                    <label>Category</label>
                    <span>${grv.category}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Issue Type</label>
                    <span>${grv.complaintType}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Date Submited</label>
                    <span>${new Date(grv.createdAt).toLocaleString()}</span>
                </div>
                <div class="grv-meta-item">
                    <label>Current Status</label>
                    <span class="badge badge-${getStatusClass(grv.status)}">${grv.status}</span>
                </div>
            </div>

            ${grv.category === 'Bus Issues' ? `
                <div class="grv-details-meta" style="margin-top:-12px; margin-bottom:20px; background-color:var(--secondary-light); border:1px solid rgba(29, 112, 184, 0.15);">
                    <div class="grv-meta-item">
                        <label>Bus Number</label>
                        <span class="font-semibold text-sm" style="font-family:monospace; color:var(--primary);">${grv.busNumber || 'N/A'}</span>
                    </div>
                    <div class="grv-meta-item">
                        <label>Bus Route / Area</label>
                        <span class="font-semibold text-sm">${grv.busRoute || 'N/A'}</span>
                    </div>
                </div>
            ` : ''}

            <!-- Identity verification section -->
            <div style="background-color:var(--bg-main); border:1px solid var(--border); padding:16px; border-radius:var(--radius-md); margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="text-xs text-muted font-semibold" style="display:block;">Student Identity Status:</span>
                        <span id="student-identity-lbl" class="font-semibold text-sm" style="font-family:monospace; color:var(--text-light);">••••••••••••••••••••</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-reveal-identity">
                        <span data-icon="lock" data-size="12"></span> Reveal Identity
                    </button>
                </div>
            </div>

            <div class="grv-desc-box">
                <h4 class="font-semibold text-sm">Complaint Description</h4>
                <p class="text-sm" style="margin-top:6px; background-color:var(--bg-main); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border); white-space:pre-wrap;">${grv.description}</p>
            </div>

            ${grv.attachmentUrl ? `
                <div style="margin-top:20px;">
                    <h4 class="font-semibold text-sm" style="margin-bottom:8px;">File Attachment</h4>
                    <a href="${grv.attachmentUrl}" target="_blank" class="btn btn-secondary btn-sm" style="width:100%;">
                        <span data-icon="file" data-size="14"></span> View Uploaded File (${grv.attachmentName || 'Open Attachment'})
                    </a>
                </div>
            ` : ''}

            <!-- Change priority control -->
            <div class="form-group" style="margin-top:24px;">
                <label class="form-label" for="modal-priority-select">Set Case Priority</label>
                <select class="form-control text-sm" id="modal-priority-select">
                    <option value="Low" ${grv.priority === 'Low' ? 'selected' : ''}>Low</option>
                    <option value="Medium" ${grv.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="High" ${grv.priority === 'High' ? 'selected' : ''}>High</option>
                    <option value="Critical" ${grv.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                </select>
            </div>

            ${grv.resolutionNotes ? `
                <div class="grv-resolution-box">
                    <h4 class="font-semibold text-sm">Resolution Comments</h4>
                    <p class="text-sm">${grv.resolutionNotes}</p>
                </div>
            ` : ''}
        </div>
        <div class="modal-footer">
            <button class="btn btn-outline btn-sm" id="modal-close-grv">Dismiss</button>
            <button class="btn btn-primary btn-sm" id="modal-save-grv">Save Changes</button>
        </div>
    `;

    overlay.classList.add('show');
    replaceIcons(windowEl);

    const closeModal = () => overlay.classList.remove('show');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-close-grv').addEventListener('click', closeModal);

    // Decrypt / Reveal Identity trigger
    const revealBtn = document.getElementById('btn-reveal-identity');
    const identityLbl = document.getElementById('student-identity-lbl');
    let revealed = false;

    revealBtn.addEventListener('click', () => {
        revealed = !revealed;
        if (revealed) {
            identityLbl.textContent = grv.studentEmail;
            identityLbl.style.color = 'var(--danger)';
            revealBtn.innerHTML = `<span data-icon="shield" data-size="12"></span> Mask Identity`;
        } else {
            identityLbl.textContent = '••••••••••••••••••••';
            identityLbl.style.color = 'var(--text-light)';
            revealBtn.innerHTML = `<span data-icon="lock" data-size="12"></span> Reveal Identity`;
        }
        replaceIcons(revealBtn);
    });

    // Save changes
    document.getElementById('modal-save-grv').addEventListener('click', () => {
        const priority = document.getElementById('modal-priority-select').value;
        Api.updateGrievance(grv.id, { priority: priority }).then(() => {
            alert("Grievance properties updated successfully.");
            closeModal();
            renderAdminSubTab();
        }).catch(err => alert("Error updating priority: " + err.message));
    });
}

// 8.3 Admin Categories CRUD View
function renderAdminCategories(container) {
    const categories = State.getCategories();

    container.innerHTML = `
        <div class="animate-slide-up">
            <div class="crud-grid">
                <!-- Add category card -->
                <div class="crud-card">
                    <h3 class="crud-card-title" style="margin-bottom:16px;">Add New Category</h3>
                    <form id="form-add-category">
                        <div class="form-group">
                            <label class="form-label" for="add-cat-name">Category Title</label>
                            <input type="text" class="form-control" id="add-cat-name" placeholder="e.g. Laboratory Equipment Issues" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%;">Create Category</button>
                    </form>
                </div>

                <!-- Display active list -->
                <div class="crud-card" style="grid-column: span 2;">
                    <div class="crud-card-header">
                        <h3 class="crud-card-title">Active Complaint Categories</h3>
                        <span class="text-xs text-muted">${categories.length} total categories</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        ${categories.map(cat => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid var(--border); border-radius:var(--radius-md); background-color:var(--bg-main);">
                                <span class="font-semibold text-sm">${cat}</span>
                                <button class="btn btn-danger btn-sm btn-delete-cat" data-name="${cat}">
                                    <span data-icon="trash" data-size="12"></span> Delete
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add category trigger
    document.getElementById('form-add-category').addEventListener('submit', (e) => {
        e.preventDefault();
        const catName = document.getElementById('add-cat-name').value.trim();
        const success = State.addCategory(catName);
        if (success) {
            showToast("Category Added", `Category "${catName}" added successfully.`, "success");
            renderAdminSubTab();
        } else {
            showToast("Failed to Add Category", "Title may already exist.", "warning");
        }
    });

    // Delete category trigger
    container.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-name');
            if (confirm(`Warning: Deleting the category "${name}" will also delete all under-lying complaint types and contact numbers. Continue?`)) {
                State.deleteCategory(name);
                showToast("Category Removed", `Category "${name}" removed.`, "success");
                renderAdminSubTab();
            }
        });
    });
}

// 8.4 Admin Complaint Types CRUD View
function renderAdminComplaintTypes(container) {
    const categories = State.getCategories();
    const typesMap = State.getComplaintTypes();
    
    // Select first category as active if none chosen
    if (!window.activeCategoryTab && categories.length > 0) {
        window.activeCategoryTab = categories[0];
    }

    const currentTypes = typesMap[window.activeCategoryTab] || [];

    container.innerHTML = `
        <div class="animate-slide-up">
            <div class="crud-grid">
                <!-- Selector Sidebar -->
                <div class="crud-card" style="padding:16px;">
                    <h3 class="crud-card-title" style="margin-bottom:12px;">Categories</h3>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${categories.map(cat => `
                            <button class="admin-menu-item text-xs cat-selector-btn ${window.activeCategoryTab === cat ? 'active' : ''}" 
                                data-cat="${cat}" style="color:var(--text); padding:10px 12px;">
                                ${cat}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Types manager card -->
                <div class="crud-card" style="grid-column: span 2;">
                    <div class="crud-card-header">
                        <div>
                            <span class="text-xs text-muted">Category:</span>
                            <h3 class="crud-card-title" style="margin-top:2px;">${window.activeCategoryTab}</h3>
                        </div>
                        <span class="text-xs text-muted">${currentTypes.length} types registered</span>
                    </div>

                    <!-- Add form -->
                    <form id="form-add-type" style="display:flex; gap:12px; margin-bottom:24px;">
                        <input type="text" class="form-control text-sm" id="add-type-name" placeholder="Add custom issue under this category..." required>
                        <button type="submit" class="btn btn-primary" style="white-space:nowrap;">
                            <span data-icon="plus" data-size="16"></span> Add Type
                        </button>
                    </form>

                    <!-- List Pills -->
                    <div class="item-badge-list">
                        ${currentTypes.map(t => `
                            <span class="type-pill">
                                ${t}
                                ${t !== 'Other' ? `
                                    <button class="type-pill-delete btn-delete-type" data-type="${t}">✕</button>
                                ` : ''}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Selector triggers
    container.querySelectorAll('.cat-selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.activeCategoryTab = btn.getAttribute('data-cat');
            renderAdminSubTab();
        });
    });

    // Add Type trigger
    document.getElementById('form-add-type').addEventListener('submit', (e) => {
        e.preventDefault();
        const typeName = document.getElementById('add-type-name').value.trim();
        const success = State.addComplaintType(window.activeCategoryTab, typeName);
        if (success) {
            showToast("Issue Type Added", `Issue Type "${typeName}" added successfully.`, "success");
            renderAdminSubTab();
        } else {
            showToast("Failed to Add Type", "Name already exists under this category.", "warning");
        }
    });

    // Delete Type trigger
    container.querySelectorAll('.btn-delete-type').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            if (confirm(`Remove complaint type "${type}" from category "${window.activeCategoryTab}"?`)) {
                State.removeComplaintType(window.activeCategoryTab, type);
                showToast("Type Removed", "Type removed successfully.", "success");
                renderAdminSubTab();
            }
        });
    });
}

// 8.5 Admin Contacts Sub-view
function renderAdminContacts(container) {
    const contacts = State.getContacts();
    const categories = State.getCategories();

    container.innerHTML = `
        <div class="section-card animate-slide-up">
            <div class="section-title-bar">
                <div>
                    <h2 style="font-size:1.2rem; margin:0;">Emergency Department Contacts</h2>
                    <p class="text-xs text-muted">These numbers are automatically fetched and embedded in emails routed to Discipline Heads.</p>
                </div>
            </div>

            <div class="table-container">
                <table class="table-custom contacts-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Contact Detail / Phone Number</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categories.map(cat => `
                            <tr>
                                <td class="font-semibold text-sm">${cat}</td>
                                <td>
                                    <input type="text" class="form-control text-sm contact-input-val" 
                                        data-cat="${cat}" value="${contacts[cat] || 'Discipline Committee (Email Only)'}" 
                                        ${cat.includes('Student') || cat.includes('Faculty') ? 'disabled' : ''}>
                                </td>
                                <td class="text-right">
                                    ${cat.includes('Student') || cat.includes('Faculty') ? `
                                        <span class="text-xs text-muted">Email Lock</span>
                                    ` : `
                                        <button class="btn btn-secondary btn-sm btn-save-contact" data-cat="${cat}">
                                            Save Number
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Save Contact triggers
    container.querySelectorAll('.btn-save-contact').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-cat');
            const inputVal = container.querySelector(`.contact-input-val[data-cat="${cat}"]`).value.trim();
            State.updateContact(cat, inputVal);
            showToast("Contact Saved", `Contact details for category "${cat}" successfully updated.`, "success");
            renderAdminSubTab();
        });
    });
}

// 8.6 Admin Email logs view
function renderAdminEmailLogs(container) {
    const logs = State.getEmailLogs();

    if (!window.activeEmailLogId && logs.length > 0) {
        window.activeEmailLogId = logs[0].id;
    }

    const currentLog = logs.find(l => l.id === window.activeEmailLogId);

    container.innerHTML = `
        <div class="email-log-layout animate-slide-up">
            <!-- Left Logs List -->
            <div class="email-log-sidebar">
                <div class="email-log-sidebar-header">Routed Mail Outbox</div>
                <div class="email-log-list">
                    ${logs.length === 0 ? `
                        <div style="text-align:center; padding:30px 10px; color:var(--text-light);">
                            No emails logged yet. Submissions trigger alerts automatically.
                        </div>
                    ` : logs.map(l => `
                        <div class="email-log-item-card ${window.activeEmailLogId === l.id ? 'active' : ''}" data-id="${l.id}">
                            <div class="email-log-item-title">${l.recipient.split(',')[0]}</div>
                            <div class="email-log-item-meta" style="font-family:monospace; font-weight:600; margin:2px 0;">ID: ${l.complaintId}</div>
                            <div class="email-log-item-meta">${new Date(l.timestamp).toLocaleTimeString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Right Mail Viewer -->
            <div class="email-log-viewer">
                ${!currentLog ? `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-light);">
                        <span data-icon="mail" data-size="48"></span>
                        <p class="text-xs" style="margin-top:12px;">Select an email entry from the list to audit routed HTML bodies.</p>
                    </div>
                ` : `
                    <div class="email-log-viewer-header">
                        <h4 style="font-size:0.95rem; color:var(--primary);">${currentLog.subject}</h4>
                        <div style="display:flex; justify-content:space-between; margin-top:8px;" class="text-xs text-muted">
                            <span>To: <strong>${currentLog.recipient}</strong></span>
                            <span>Logged at: ${new Date(currentLog.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="email-log-viewer-pane">
                        <div class="email-iframe-container">
                            <!-- Injects raw html in safe sandbox frame -->
                            <iframe id="email-iframe-el" style="width:100%; height:100%; border:none; background-color:white;"></iframe>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;

    // Load iframe html body safely
    if (currentLog) {
        const iframe = document.getElementById('email-iframe-el');
        if (iframe) {
            iframe.srcdoc = currentLog.body;
        }
    }

    // List item selectors
    container.querySelectorAll('.email-log-item-card').forEach(card => {
        card.addEventListener('click', () => {
            window.activeEmailLogId = card.getAttribute('data-id');
            renderAdminSubTab();
        });
    });
}

// 8.7 Admin Settings & Config view
function renderAdminSettings(container) {
    container.innerHTML = `
        <div class="section-card animate-slide-up" style="max-width:600px;">
            <h3 class="crud-card-title" style="margin-bottom:16px;">Supabase Live Setup</h3>
            <p class="text-xs text-muted" style="margin-bottom:20px; line-height:1.5;">
                You can hook up a live database by defining credentials inside the <span style="font-family:monospace; font-weight:700;">js/supabase.js</span> configuration block. 
                If fields are empty, the application will automatically remain in Developer Mock Mode storing details securely in LocalStorage.
            </p>

            <table class="table-custom text-sm" style="margin-bottom:30px;">
                <tbody>
                    <tr>
                        <td><strong>Database Integration Status</strong></td>
                        <td>
                            <span class="badge ${Api.isLiveMode() ? 'badge-resolved' : 'badge-submitted'}">
                                ${Api.isLiveMode() ? 'Live Mode Active' : 'Local Mock Mode'}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Supabase Endpoint</strong></td>
                        <td><span style="font-family:monospace; color:var(--text-light);">${Api.SUPABASE_CONFIG.url || 'Not Set'}</span></td>
                    </tr>
                    <tr>
                        <td><strong>Cloudflare R2 Bucket</strong></td>
                        <td><span style="font-family:monospace; color:var(--text-light);">${Api.CLOUDFLARE_R2_CONFIG.bucketName}</span></td>
                    </tr>
                </tbody>
            </table>

            <h3 class="crud-card-title" style="margin-bottom:16px; border-top:1px solid var(--border); padding-top:20px;">Clear Simulated Memory</h3>
            <p class="text-xs text-muted" style="margin-bottom:16px;">
                Reset mock database state, emails, dynamic categories, and custom complaint types back to their original defaults.
            </p>
            <button class="btn btn-danger btn-sm" id="btn-reset-app-state">
                Reset Portal Database State
            </button>
        </div>
    `;

    document.getElementById('btn-reset-app-state').addEventListener('click', () => {
        if (confirm("This will erase all grievances, reset categories to college defaults, and wipe the routed email outbox history. Proceed?")) {
            localStorage.clear();
            alert("Database state reset. Reloading application...");
            window.location.reload();
        }
    });
}

// Real-time complaints database change subscription
Api.subscribeToComplaints(() => {
    console.log("Realtime refresh triggered by database change!");
    Api.syncComplaints().then(() => {
        if (AppState.view === 'admin') {
            renderAdminSubTab();
        } else if (AppState.view === 'student-dashboard') {
            renderStudentDashboard();
        } else if (AppState.view === 'track') {
            renderTrackComplaint();
        }
    }).catch(err => console.error("Error syncing realtime database changes:", err));
});

// Initial database sync then kick off router navigation
Api.syncComplaints().finally(() => {
    navigate();
});
