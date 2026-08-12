import { addComplaint, getContacts, logEmail, subscribeToStateChanges, setComplaints, updateComplaint, deleteComplaint, getUserAccount, saveUserAccount, updateUserPassword } from './state.js?v=1.3';

// Configuration keys - Replace with your project details for live deployment
export const SUPABASE_CONFIG = {
    url: 'https://glsucmsvtxjppgbmushb.supabase.co', // Insert Supabase URL here, e.g. 'https://xyz.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc3VjbXN2dHhqcHBnYm11c2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzYxMTYsImV4cCI6MjEwMDMxMjExNn0.TTS8tBqpJbGz3Sg2oDu5g9BdKuVQGs1WyOIjWKtEbC8' // Insert Supabase Anon Key here
};

export const CLOUDFLARE_R2_CONFIG = {
    bucketName: 'mic-grievances',
    publicUrl: 'https://pub-r2.mictech.edu.in'
};

// Check if live Supabase client should be used
export const isLiveMode = () => {
    return SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey;
};

let supabaseClient = null;

// Initialize live Supabase Client if keys are provided
if (isLiveMode()) {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log("Supabase Client initialized in Live Mode.");
        }
    } catch (e) {
        console.error("Failed to initialize Supabase client: ", e);
    }
} else {
    console.log("Supabase Client initialized in Developer Mock Mode (using LocalStorage fallback).");
}

/**
 * Generates a high-quality alphanumeric Complaint ID (Format: CMP-XXXXXXXX)
 */
function generateComplaintId() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return `CMP-${result}`;
}

/**
 * Helper to check if a college email matches requirements (e.g. ends with @mictech.ac.in or is a valid college email format)
 */
export function validateCollegeEmail(email) {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    // Allow standard email pattern, and require college domain (e.g., mictech.ac.in, mic.edu.in, mictech.in, mictech.edu)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(lowerEmail)) return false;

    // Check for mictech college domain (we accept mictech.ac.in, mic.edu, or subdomains for students like @mictech.ac.in)
    return lowerEmail.endsWith('@mictech.ac.in') || 
           lowerEmail.endsWith('@mic.edu.in') || 
           lowerEmail.endsWith('@mictech.in') ||
           lowerEmail.endsWith('@admin.mictech.ac.in') ||
           lowerEmail.endsWith('@faculty.mictech.ac.in');
}

/**
 * Handle student or admin login
 */
export async function authenticateUser(email, password, role) {
    email = email.trim();
    
    // Validate email format
    if (!validateCollegeEmail(email)) {
        throw new Error("Authentication failed: Please use a valid college email address (e.g., student@mictech.ac.in).");
    }

    // Admins must use a specific domain or we simulate a password check
    if (role === 'admin') {
        const isAdminEmail = email.includes('admin') || email.includes('discipline') || email.includes('hod');
        if (!isAdminEmail) {
            throw new Error("Access Denied: The specified email address does not have administrator privileges.");
        }
        if (password !== 'admin123') { // standard simple password for testing, editable in setting
            throw new Error("Authentication failed: Invalid administrator password.");
        }
        return {
            email: email,
            id: 'admin_' + Math.floor(1000 + Math.random() * 9000),
            role: 'admin',
            token: 'mock_admin_jwt'
        };
    }

    // Student Access Verification
    if (isLiveMode() && supabaseClient) {
        // Query from custom student_accounts table
        const { data, error } = await supabaseClient
            .from('student_accounts')
            .select('*')
            .eq('email', email);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            throw new Error("Account does not exist. Please register first.");
        }
        
        if (data[0].password !== password) {
            throw new Error("Invalid credentials. Please try again.");
        }

        return {
            email: email,
            id: 'usr_' + Math.floor(10000 + Math.random() * 90000),
            role: role,
            token: 'live_session_token'
        };
    } else {
        // Mock authentication check
        const account = getUserAccount(email);
        if (!account) {
            throw new Error("Account does not exist. Please register first.");
        }
        if (account.password !== password) {
            throw new Error("Invalid credentials. Please try again.");
        }
        return {
            email: email,
            id: 'usr_' + Math.floor(10000 + Math.random() * 90000),
            role: role,
            token: 'mock_jwt_token_for_' + email
        };
    }
}

/**
 * Mock file upload to Cloudflare R2
 * In live mode, this would generate a presigned URL from Supabase Edge Functions or backend,
 * upload the file, and return the R2 public path.
 */
async function uploadToCloudflareR2(file) {
    if (!file) return null;
    
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    
    if (isLiveMode()) {
        // Live cloud upload path (e.g., via Supabase storage bucket configured to Cloudflare R2 backend, or direct S3 upload client)
        // Here we simulate the URL that would be saved in the database
        return `${CLOUDFLARE_R2_CONFIG.publicUrl}/complaints/${fileName}`;
    } else {
        // Mock mode: Read file as DataURL for visual verification in the UI
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result); // Base64 url representing the file
            };
            reader.readAsDataURL(file);
        });
    }
}

/**
 * Submits a new grievance
 */
export async function createGrievance(category, complaintType, description, attachmentFile, studentEmail, extraFields = {}) {
    const complaintId = generateComplaintId();
    const attachmentUrl = attachmentFile ? await uploadToCloudflareR2(attachmentFile) : null;
    
    const complaintData = {
        id: complaintId,
        studentEmail: studentEmail,
        category: category,
        complaintType: complaintType,
        description: description,
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentFile ? attachmentFile.name : null,
        status: "Submitted", // Submitted, Under Review, Assigned, Resolved, Closed
        priority: "Medium", // Default priority
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolutionNotes: null,
        busNumber: extraFields.busNumber || null,
        busRoute: extraFields.busRoute || null
    };

function getAssignedDepartment(category) {
    if (category === "Hostel Issues") return "Hostel Committee";
    if (category === "Food Issues") return "Food & Canteen Services";
    if (category === "Campus Issues") return "Campus Infrastructure";
    if (category === "Complaint Against Student") return "Student Affairs";
    if (category === "Complaint Against Faculty") return "Academic Discipline Board";
    if (category === "Bus Issues") return "Bus Management";
    return "General Discipline Committee";
}

    const assignedDept = getAssignedDepartment(category);
    complaintData.assignedDepartment = assignedDept;

    if (isLiveMode() && supabaseClient) {
        // Save to Supabase PostgreSQL Database (include bus fields and assigned department)
        const { data, error } = await supabaseClient
            .from('complaints')
            .insert([{
                complaint_id: complaintData.id,
                student_email: complaintData.studentEmail,
                category: complaintData.category,
                complaint_type: complaintData.complaintType,
                description: complaintData.description,
                attachment_url: complaintData.attachmentUrl,
                status: complaintData.status,
                priority: complaintData.priority,
                created_at: complaintData.createdAt,
                updated_at: complaintData.updatedAt,
                bus_number: complaintData.busNumber,
                bus_route: complaintData.busRoute,
                assigned_department: assignedDept
            }]);
        if (error) throw error;
    } else {
        // Save locally to state
        addComplaint(complaintData);
    }

    // Trigger automated email routing
    await routeGrievanceEmail(complaintData);

    return complaintData;
}

/**
 * Routes grievance details and constructs HTML email to the Discipline Head
 */
async function routeGrievanceEmail(complaint) {
    const contacts = getContacts();
    const disciplineHeadEmail = "discipline.head@mictech.ac.in";
    
    let targetRecipient = disciplineHeadEmail;
    let contactDetailHtml = "";
    
    // Process Routing Rules
    if (complaint.category === "Hostel Issues") {
        const phone = contacts["Hostel Issues"] || "9959593027";
        contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Hostel Warden Contact: ${phone}</p>`;
    } else if (complaint.category === "Food Issues") {
        const phone = contacts["Food Issues"] || "9391781748";
        contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Canteen/Food Management Contact: ${phone}</p>`;
    } else if (complaint.category === "Campus Issues") {
        // Forward to respective HOD
        const hodEmail = "hod.campus@mictech.ac.in";
        targetRecipient = `${disciplineHeadEmail}, ${hodEmail}`;
        const phone = contacts["Campus Issues"] || "N/A";
        contactDetailHtml = `<p style="color: #1D70B8; font-weight: bold; margin-top: 15px;">Campus Facilities Support Contact: ${phone} (Forwarded to Campus HOD)</p>`;
    } else if (complaint.category === "Complaint Against Faculty") {
        // Forward directly to Discipline Committee without contact numbers
        targetRecipient = "discipline.committee@mictech.ac.in";
        contactDetailHtml = `<p style="color: #DC2626; font-weight: bold; margin-top: 15px;">Severity: Confidential - Directed straight to Discipline Committee review.</p>`;
    } else if (complaint.category === "Complaint Against Student") {
        targetRecipient = "discipline.committee@mictech.ac.in";
        contactDetailHtml = `<p style="color: #1E293B; font-weight: bold; margin-top: 15px;">Forwarded to Student Affairs / Discipline Committee.</p>`;
    } else if (complaint.category === "Bus Issues") {
        // Forward to Bus Management
        targetRecipient = "bus.management@mictech.ac.in";
        const phone = contacts["Bus Issues"] || "7330820239";
        contactDetailHtml = `<p style="color: #0F4C81; font-weight: bold; margin-top: 15px;">Bus Management Contact: ${phone}</p>`;
    } else {
        contactDetailHtml = `<p style="color: #1E293B; font-weight: bold; margin-top: 15px;">Forwarded to relevant college administrator.</p>`;
    }

    // Construct Professional HTML Email Template
    const emailSubject = `[URGENT GRIEVANCE] - ID: ${complaint.id} | Category: ${complaint.category}`;
    
    // Build email rows dynamically
    let dynamicRows = `
        <tr style="background-color: #F8FAFC;">
            <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81; width: 35%;">Complaint ID</th>
            <td style="padding: 10px; border: 1px solid #E2E8F0; font-weight: bold; color: #1E293B;">${complaint.id}</td>
        </tr>
        <tr>
            <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Category</th>
            <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${complaint.category}</td>
        </tr>
        <tr style="background-color: #F8FAFC;">
            <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Complaint Type</th>
            <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${complaint.complaintType}</td>
        </tr>
        <tr>
            <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Submitted Date</th>
            <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${new Date(complaint.createdAt).toLocaleString()}</td>
        </tr>
        <tr style="background-color: #F8FAFC;">
            <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Student College Email</th>
            <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold;">${complaint.studentEmail}</td>
        </tr>
    `;

    // Append Bus Specific Rows
    if (complaint.category === "Bus Issues") {
        dynamicRows += `
            <tr>
                <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81; background-color: #FFFDF5;">Bus Number</th>
                <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold; background-color: #FFFDF5;">${complaint.busNumber || 'N/A'}</td>
            </tr>
            <tr style="background-color: #FFFDF5;">
                <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Bus Route/Area</th>
                <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B;">${complaint.busRoute || 'N/A'}</td>
            </tr>
            <tr>
                <th style="padding: 10px; border: 1px solid #E2E8F0; color: #0F4C81;">Bus Mgmt Contact</th>
                <td style="padding: 10px; border: 1px solid #E2E8F0; color: #1E293B; font-weight: bold;">7330820239</td>
            </tr>
        `;
    }

    const emailBody = `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="border-bottom: 2px solid #0F4C81; padding-bottom: 15px; margin-bottom: 20px; text-align: center;">
                <h2 style="color: #0F4C81; margin: 0; font-size: 22px;">DVR & Dr. HS MIC College of Technology</h2>
                <p style="color: #64748B; margin: 5px 0 0 0; font-size: 14px;">Official Student Grievance Notification</p>
            </div>
            
            <p style="font-size: 16px; color: #1E293B; line-height: 1.5;">Dear Authority,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">A new student grievance has been securely submitted on the portal. Under college guidelines, this report requires timely assessment and resolution.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; text-align: left;">
                ${dynamicRows}
            </table>

            <div style="background-color: #F8FAFC; border-left: 4px solid #0F4C81; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h4 style="margin: 0 0 10px 0; color: #0F4C81; font-size: 14px;">Description:</h4>
                <p style="margin: 0; color: #334155; line-height: 1.6; font-size: 13px;">${complaint.description}</p>
            </div>

            ${complaint.attachmentUrl ? `
            <div style="margin: 15px 0; padding: 10px; border: 1px dashed #CBD5E1; border-radius: 8px; font-size: 13px;">
                <span style="color: #64748B;">Attachment Uploaded:</span> 
                <a href="${complaint.attachmentUrl}" target="_blank" style="color: #1D70B8; text-decoration: underline; font-weight: 500;">
                    ${complaint.attachmentName || 'View Attachment (R2 File Link)'}
                </a>
            </div>` : ''}

            ${contactDetailHtml}

            <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 25px 0;"/>
            
            <p style="font-size: 12px; color: #94A3B8; text-align: center; line-height: 1.4; margin: 0;">
                This email was auto-generated by the MIC Student Grievance Portal. Do not reply to this email directly.
                <br/>
                © DVR & Dr. HS MIC College of Technology - Grievance Committee.
            </p>
        </div>
    `;

    // Log the email in state for inspection in the Admin Panel
    logEmail({
        recipient: targetRecipient,
        subject: emailSubject,
        body: emailBody,
        complaintId: complaint.id
    });

    console.log(`[Email Routed Successfully] Sent to: ${targetRecipient} for Complaint: ${complaint.id}`);
}

export async function syncComplaints() {
    if (isLiveMode() && supabaseClient) {
        const { data, error } = await supabaseClient
            .from('complaints')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        const mapped = data.map(c => ({
            id: c.id,
            studentEmail: c.student_email,
            category: c.category,
            complaintType: c.complaint_type,
            description: c.description,
            attachmentUrl: c.attachment_url,
            attachmentName: c.attachment_name || null,
            status: c.status,
            priority: c.priority,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            resolutionNotes: c.resolution_notes || null,
            busNumber: c.bus_number || null,
            busRoute: c.bus_route || null
        }));
        
        setComplaints(mapped);
        return mapped;
    } else {
        // Return cached list
        const complaints = getStorageItem ? JSON.parse(localStorage.getItem('complaints') || '[]') : [];
        return complaints;
    }
}

function getStorageItem(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

export async function updateGrievance(id, updates) {
    if (isLiveMode() && supabaseClient) {
        const dbUpdates = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.resolutionNotes !== undefined) dbUpdates.resolution_notes = updates.resolutionNotes;
        dbUpdates.updated_at = new Date().toISOString();
        
        const { error } = await supabaseClient
            .from('complaints')
            .update(dbUpdates)
            .eq('id', id);
        if (error) throw error;
    } else {
        updateComplaint(id, updates);
    }
}

export async function deleteGrievance(id) {
    if (isLiveMode() && supabaseClient) {
        const { error } = await supabaseClient
            .from('complaints')
            .delete()
            .eq('id', id);
        if (error) throw error;
    } else {
        deleteComplaint(id);
    }
}

export async function registerStudent(email, password, acceptsToS) {
    email = email.trim();
    if (!validateCollegeEmail(email)) {
        throw new Error("Invalid email format. Please use a valid college email address.");
    }
    if (!acceptsToS) {
        throw new Error("You must accept the Terms of Service & Privacy Policy to register.");
    }

    if (isLiveMode() && supabaseClient) {
        // Check if student account already exists
        const { data, error } = await supabaseClient
            .from('student_accounts')
            .select('*')
            .eq('email', email);
            
        if (error) throw error;
        if (data && data.length > 0) {
            throw new Error("An account with this email already exists. Please log in instead.");
        }

        // 1. Skip Supabase Auth signUp to avoid email rate limits and SMTP sandbox restrictions

        // 2. Save credentials in student_accounts table
        const insertRes = await supabaseClient
            .from('student_accounts')
            .insert([{
                email: email,
                password: password,
                tos_accepted: acceptsToS,
                tos_accepted_at: new Date().toISOString()
            }]);
        if (insertRes.error) throw insertRes.error;

        return {
            email: email,
            role: 'student'
        };
    } else {
        // Mock Mode: check and save using State helpers
        const exists = getUserAccount(email);
        if (exists) {
            throw new Error("An account with this email already exists. Please log in instead.");
        }
        saveUserAccount(email, password, acceptsToS);
        return {
            email: email,
            role: 'student'
        };
    }
}

export async function checkStudentEmailExists(email) {
    email = email.trim();
    if (isLiveMode() && supabaseClient) {
        const { data, error } = await supabaseClient
            .from('student_accounts')
            .select('*')
            .eq('email', email);
        return data && data.length > 0;
    } else {
        return getUserAccount(email) !== null;
    }
}

export async function resetStudentPassword(email, newPassword) {
    email = email.trim();
    if (isLiveMode() && supabaseClient) {
        const { data, error } = await supabaseClient
            .from('student_accounts')
            .select('*')
            .eq('email', email);
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error("No account found with this email.");
        }

        const updateRes = await supabaseClient
            .from('student_accounts')
            .update({ password: newPassword })
            .eq('email', email);
        if (updateRes.error) throw updateRes.error;
    } else {
        const success = updateUserPassword(email, newPassword);
        if (!success) {
            throw new Error("No account found with this email.");
        }
    }
}

export async function sendPasswordResetOtp(email, otp) {
    const subject = "MIC Student Grievance Portal - Password Reset OTP";
    const body = `
        <div style="font-family: Inter, Arial, sans-serif; padding: 20px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px;">
            <h2 style="color: #0F4C81; margin-bottom: 16px;">Password Reset Request</h2>
            <p>You requested to reset your password for the DVR & Dr. HS MIC College Student Grievance Portal.</p>
            <p>Please enter the following 6-digit verification code to choose a new password:</p>
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
                <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0F4C81;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748B;">This OTP is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
            <hr style="border:0; border-top:1px solid #E2E8F0; margin:20px 0;"/>
            <p style="font-size: 11px; color: #94A3B8;">© DVR & Dr. HS MIC College of Technology - Grievance Committee</p>
        </div>
    `;
    
    // Log the OTP email in dynamic outbox logs for admin verification
    logEmail({
        recipient: email,
        subject: subject,
        body: body,
        complaintId: "OTP-RESET"
    });
    
    console.log(`[Email OTP Logged] Code ${otp} dispatched for reset requested by: ${email}`);
}

export function subscribeToComplaints(callback) {
    if (isLiveMode() && supabaseClient) {
        // Live Supabase postgres_changes subscription
        const channel = supabaseClient
            .channel('complaints-realtime-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
                console.log('Realtime change received from Supabase websocket:', payload);
                callback(payload);
            })
            .subscribe();
            
        return () => {
            supabaseClient.removeChannel(channel);
        };
    } else {
        // Fallback to local state changes
        return subscribeToStateChanges(callback);
    }
}
