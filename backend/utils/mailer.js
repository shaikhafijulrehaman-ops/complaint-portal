import nodemailer from 'nodemailer';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || 465;
  const user = process.env.SMTP_USER || 'complaintportal40@gmail.com';
  const pass = process.env.SMTP_PASS || 'uohpvebgmwkdiego';

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

/**
 * Sends a highly confidential student grievance email using Gmail SMTP / Nodemailer.
 * Guarantees zero student identity disclosure in the message payload.
 *
 * @param {Object} options
 * @param {Object} options.complaint - Sanitized complaint data
 * @param {string} options.recipient - Recipient email addresses
 * @param {Object} [options.managementContact] - Custom management helper phone number depending on category
 */
export async function sendGrievanceEmail({
  complaint,
  recipient,
  managementContact
}) {
  const client = getTransporter();
  const fromEmail = process.env.SMTP_FROM || `"Grievance Desk" <${process.env.SMTP_USER || 'complaintportal40@gmail.com'}>`;
  const subject = `[CONFIDENTIAL GRIEVANCE] - ID: ${complaint.id} | Category: ${complaint.category}`;

  // Formulate category-specific layout fields
  let categorySpecificHtml = "";
  if (complaint.category === "Bus Issues") {
    categorySpecificHtml = `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Bus Number:</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #334155;">${complaint.busNumber || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Route / Area:</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${complaint.busRoute || 'N/A'}</td>
      </tr>
    `;
  }

  // Formulate management contact row
  let managementContactHtml = "";
  if (managementContact && managementContact.phone) {
    managementContactHtml = `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Responsible Contact:</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #0b3c5d;">
          ${managementContact.label} – ${managementContact.phone}
        </td>
      </tr>
    `;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #0b3c5d; padding: 20px; text-align: center; color: #ffffff; border-bottom: 3px solid #f59e0b;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">DVR & Dr. HS MIC College of Technology</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Confidential Student Grievance Notification</p>
      </div>
      
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p style="margin-top: 0; font-size: 15px; color: #1e293b;">Dear Authority,</p>
        <p style="font-size: 14px; color: #475569;">A confidential student grievance has been lodged on the portal. Under institutional guidelines, this requires your immediate assessment and resolution.</p>
        
        <h3 style="margin-top: 24px; color: #0b3c5d; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; font-size: 16px;">Grievance Log</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d; width: 35%;">Complaint ID:</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${complaint.id}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Category:</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${complaint.category}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Complaint Type:</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${complaint.complaintType}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Submitted At:</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">${new Date(complaint.createdAt).toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc; color: #0b3c5d;">Current Status:</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #334155;">
                <span style="background-color: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">
                  ${complaint.status}
                </span>
              </td>
            </tr>
            ${categorySpecificHtml}
            ${managementContactHtml}
          </tbody>
        </table>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #0b3c5d; padding: 15px; border-radius: 0 4px 4px 0; margin: 20px 0;">
          <h4 style="margin: 0 0 8px; color: #0b3c5d; font-size: 14px;">Grievance Description:</h4>
          <p style="margin: 0; white-space: pre-wrap; font-size: 13px; color: #334155;">${complaint.description}</p>
        </div>
      </div>
      
      <div style="background-color: #f1f5f9; padding: 18px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 4px 0; font-weight: bold; color: #475569;">Confidentiality Notice:</p>
        <p style="margin: 0; line-height: 1.5;">This grievance has been submitted through the Student Grievance Portal. Student identity and contact information are intentionally excluded from this notification.</p>
      </div>
    </div>
  `;

  const info = await client.sendMail({
    from: fromEmail,
    to: recipient,
    subject: subject,
    html: htmlBody
  });

  console.log(`[Gmail SMTP Dispatched] MessageID: ${info.messageId || info.message} | Recipient: ${recipient}`);
  return info;
}

/**
 * Confirms that the SMTP settings and connections are functional.
 */
export async function verifyTransporter() {
  const client = getTransporter();
  if (!client) {
    console.warn('[SMTP Verification Warning] SMTP transporter could not be initialized (missing configuration).');
    return false;
  }
  try {
    await client.verify();
    console.log('[SMTP Connection Success] SMTP server connection verified successfully.');
    return true;
  } catch (error) {
    console.error('[SMTP Connection Error] SMTP server verification failed:', error.message);
    return false;
  }
}
