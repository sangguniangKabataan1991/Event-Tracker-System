import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM      = process.env.EMAIL_FROM || `SK System <${process.env.EMAIL_USER}>`;
const ADMIN_URL = process.env.ADMIN_URL  || 'http://localhost:5173';
const USER_URL  = process.env.USER_URL   || 'http://localhost:5174';

// ── Shared HTML wrapper ────────────────────────────────────────────────────
function htmlWrap(content) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      body { margin:0; padding:0; background:#F5F7FA; font-family: Arial, sans-serif; }
      .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      .header { background:#0A1F44; padding:32px 40px 24px; text-align:center; }
      .header h1 { color:#fff; font-size:18px; margin:0 0 4px; font-weight:700; }
      .header p  { color:rgba(255,255,255,0.5); font-size:12px; margin:0; }
      .body   { padding:32px 40px; }
      .body p { color:#374151; font-size:14px; line-height:1.6; margin:0 0 16px; }
      .btn    { display:inline-block; background:#0A1F44; color:#fff !important; text-decoration:none;
                padding:12px 28px; border-radius:10px; font-size:14px; font-weight:600; margin:8px 0 20px; }
      .info-box { background:#F5F7FA; border-radius:10px; padding:16px 20px; margin:16px 0; }
      .info-box p { margin:4px 0; color:#374151; font-size:13px; }
      .info-box strong { color:#0A1F44; }
      .footer { padding:20px 40px; border-top:1px solid #F1F5F9; text-align:center; }
      .footer p { color:#9CA3AF; font-size:11px; margin:0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <h1>SK Beneficiary Tracking System</h1>
        <p>Official SK Portal Notification</p>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
  </html>`;
}

// ── Welcome email — sent when admin creates a new OFFICER account ──────────
export async function sendWelcomeEmail({ to, full_name, username, password, position }) {
  const html = htmlWrap(`
    <p>Hello <strong>${full_name}</strong>,</p>
    <p>Your account for the <strong>SK Beneficiary Tracking and Management System</strong> has been successfully created by the SK Admin.</p>
    <div class="info-box">
      <p><strong>Position:</strong> ${position || 'SK Staff'}</p>
      <p><strong>Username:</strong> ${username}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
    </div>
    <p>Click the button below to log in to your account:</p>
    <a href="${ADMIN_URL}/login" class="btn">Login to SK Admin Portal</a>
    <p style="color:#9CA3AF; font-size:12px;">For security purposes, please change your password after logging in.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: ' Your SK Portal Account has been Created',
    html,
  });
}

// ── Password reset email ───────────────────────────────────────────────────
export async function sendPasswordResetEmail({ to, full_name, token, role }) {
  const baseUrl  = (role === 'admin' || role === 'staff') ? ADMIN_URL : USER_URL;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const html = htmlWrap(`
    <p>Hello <strong>${full_name}</strong>,</p>
    <p>We received a request to reset your password for the SK Portal.</p>
    <p>Click the button below to choose a new password. <strong>This link will expire after 1 hour.</strong></p>
    <a href="${resetUrl}" class="btn">Reset My Password</a>
    <p style="color:#9CA3AF; font-size:12px;">
      If you did not request this, please ignore this email.
      Your password will remain unchanged.
    </p>
    <div class="info-box">
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break:break-all; color:#0A1F44; font-size:12px;">${resetUrl}</p>
    </div>
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'SK Portal Password Reset Request',
    html,
  });
}

// ── Application approved notification ─────────────────────────────────────
export async function sendApplicationApprovedEmail({ to, full_name, program_title, notes }) {
  const html = htmlWrap(`
    <p>Hello <strong>${full_name}</strong>,</p>
    <p>Great news! Your application for the following SK program has been <strong style="color:#059669;">approved</strong>.</p>
    <div class="info-box">
      <p><strong>Program:</strong> ${program_title}</p>
      ${notes ? `<p><strong>Notes from SK Staff:</strong> ${notes}</p>` : ''}
    </div>
    <p>Please visit the SK portal or contact your local SK office for the next steps.</p>
    <a href="${USER_URL}/applications" class="btn">View My Applications</a>
    <p style="color:#9CA3AF; font-size:12px;">
      If you have questions, please reach out to your SK Barangay office directly.
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `✅ Application Approved — ${program_title}`,
    html,
  });
}

// ── Application rejected notification ─────────────────────────────────────
export async function sendApplicationRejectedEmail({ to, full_name, program_title, notes }) {
  const html = htmlWrap(`
    <p>Hello <strong>${full_name}</strong>,</p>
    <p>We regret to inform you that your application for the following SK program has been <strong style="color:#dc2626;">rejected</strong>.</p>
    <div class="info-box">
      <p><strong>Program:</strong> ${program_title}</p>
      ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : '<p>No specific reason was provided.</p>'}
    </div>
    <p>You may contact your local SK office if you have questions or would like to re-apply in the future.</p>
    <a href="${USER_URL}/applications" class="btn">View My Applications</a>
    <p style="color:#9CA3AF; font-size:12px;">
      Thank you for your interest in the SK Beneficiary program.
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: ` Application Update — ${program_title}`,
    html,
  });
}

// ── Test connection (call once at startup) ────────────────────────────────
export async function verifyEmailConnection() {
  try {
    await transporter.verify();
    console.log(' Email service connected');
  } catch (e) {
    console.warn('Email service not configured:', e.message);
    console.warn('   Set EMAIL_USER and EMAIL_PASS in .env to enable email features.');
  }
}