import { Resend } from 'resend';
import { config } from '../config';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export const emailService = {
  /**
   * Send new account welcome email with credentials
   */
  async sendWelcomeCredentials(params: {
    to: string;
    employeeName: string;
    temporaryPassword: string;
    role: string;
    companyName?: string;
  }) {
    if (!resend) {
      console.log(`[Email Mock] Welcome email for ${params.to}: Temp password is ${params.temporaryPassword}`);
      return { success: true, mocked: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: config.resendFromEmail,
        to: params.to,
        subject: `Welcome to ${params.companyName || 'Vektor HCM'} - Your Account Credentials`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: white; width: 44px; height: 44px; border-radius: 12px; font-size: 24px; font-weight: 800; line-height: 44px;">V</div>
              <h2 style="color: #111827; margin: 12px 0 4px 0;">Welcome to Vektor HCM</h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0;">AI-assisted Human Capital Management</p>
            </div>
            
            <p style="color: #374151; font-size: 15px;">Hello <strong>${params.employeeName}</strong>,</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.5;">Your account has been created for ${params.companyName || 'your organization'}. You can now sign in using your temporary credentials below:</p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
              <p style="margin: 4px 0; color: #4b5563;"><strong>Email:</strong> <span style="font-family: monospace; color: #111827;">${params.to}</span></p>
              <p style="margin: 4px 0; color: #4b5563;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #4f46e5; font-weight: bold; background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">${params.temporaryPassword}</span></p>
              <p style="margin: 4px 0; color: #4b5563;"><strong>Role:</strong> <span style="text-transform: capitalize; color: #111827;">${params.role}</span></p>
            </div>

            <p style="color: #6b7280; font-size: 13px;"><em>Note: Company security policy will require you to set your own permanent personal password upon your first sign-in.</em></p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="http://localhost:5173/login" style="background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Sign In to Dashboard &rarr;</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Saylani Hackathon 2026 · Vektor HCM System</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      console.error('Email dispatch failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Send password reset confirmation email
   */
  async sendPasswordReset(params: {
    to: string;
    temporaryPassword: string;
    employeeName?: string;
  }) {
    if (!resend) {
      console.log(`[Email Mock] Password reset for ${params.to}: Temp password is ${params.temporaryPassword}`);
      return { success: true, mocked: true };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: config.resendFromEmail,
        to: params.to,
        subject: `Your Temporary Password - Vektor HCM`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: white; width: 44px; height: 44px; border-radius: 12px; font-size: 24px; font-weight: 800; line-height: 44px;">V</div>
              <h2 style="color: #111827; margin: 12px 0 4px 0;">Password Reset Request</h2>
            </div>
            
            <p style="color: #374151; font-size: 14px;">Hello ${params.employeeName || 'there'},</p>
            <p style="color: #374151; font-size: 14px; line-height: 1.5;">A temporary password has been issued for your Vektor HCM account. Use this temporary passcode to sign in and set your new permanent password:</p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="font-family: monospace; font-size: 20px; font-weight: bold; color: #4f46e5; letter-spacing: 1px;">
                ${params.temporaryPassword}
              </div>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="http://localhost:5173/login" style="background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Sign In & Reset Password &rarr;</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you did not request this reset, please contact your administrator.</p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend reset email error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      console.error('Reset email dispatch failed:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Send 6-digit OTP code for email verification or password reset
   */
  async sendOtpVerification(params: {
    to: string;
    otpCode: string;
    purpose?: string;
  }) {
    if (!resend) {
      console.log(`[Email Mock] OTP code for ${params.to}: ${params.otpCode}`);
      return { success: true, mocked: true };
    }

    try {
      const isReset = params.purpose === 'password_reset';
      const subject = isReset
        ? `Your Password Reset Code: ${params.otpCode} - Vektor HCM`
        : `Your Email Verification Code: ${params.otpCode} - Vektor HCM`;
      const title = isReset ? 'Password Reset Verification' : 'Email Verification Code';
      const promptText = isReset
        ? 'Enter the single-use 6-digit verification code below to securely reset your password:'
        : 'Use the single-use 6-digit verification code below to verify your email address:';

      const { data, error } = await resend.emails.send({
        from: config.resendFromEmail,
        to: params.to,
        subject,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: white; width: 44px; height: 44px; border-radius: 12px; font-size: 22px; font-weight: 800; line-height: 44px;">V</div>
              <h2 style="color: #111827; margin: 12px 0 4px 0; font-size: 20px;">${title}</h2>
              <p style="color: #6b7280; font-size: 13px; margin: 0;">Vektor HCM Identity Security</p>
            </div>
            
            <p style="color: #374151; font-size: 14px; text-align: center; line-height: 1.5;">
              ${promptText}
            </p>
            
            <div style="background-color: #f5f3ff; border: 1.5px dashed #818cf8; border-radius: 12px; padding: 18px; margin: 24px 0; text-align: center;">
              <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; color: #4338ca; letter-spacing: 8px;">
                ${params.otpCode}
              </div>
              <p style="color: #6366f1; font-size: 11px; font-weight: 600; margin: 8px 0 0 0; text-transform: uppercase;">
                Valid for 10 minutes · Do not share this code
              </p>
            </div>

            <p style="color: #6b7280; font-size: 12px; line-height: 1.5; text-align: center;">
              If you did not request this code, you can safely ignore this message. Someone may have entered your email address by mistake.
            </p>

            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
              Saylani Hackathon 2026 · Vektor HCM System
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Resend OTP email error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: any) {
      console.error('OTP email dispatch failed:', err);
      return { success: false, error: err.message };
    }
  },
};
