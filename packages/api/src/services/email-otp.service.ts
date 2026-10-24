import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { emailService } from './email.service';

interface OtpSession {
  email: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  purpose: string;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// In-memory OTP storage with TTL
const otpStore = new Map<string, OtpSession>();

export const emailOtpService = {
  /**
   * Generate 6-digit OTP and send via Resend email
   */
  async sendOtp(email: string, purpose: string = 'verification'): Promise<{ success: boolean; message: string; testOtp?: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Generate random 6-digit numeric OTP code
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = Date.now() + OTP_TTL_MS;

    otpStore.set(normalizedEmail, {
      email: normalizedEmail,
      otpHash,
      expiresAt,
      attempts: 0,
      purpose,
    });

    // Send via Resend
    const res = await emailService.sendOtpVerification({
      to: normalizedEmail,
      otpCode: otp,
      purpose,
    });

    console.log(`[OTP] Generated 6-digit code for ${normalizedEmail}: ${otp} (sent: ${res.success})`);

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      testOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  },

  /**
   * Verify an OTP code
   */
  async verifyOtp(email: string, otp: string, purpose: string = 'verification'): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const session = otpStore.get(normalizedEmail);

    if (!session) {
      return false;
    }

    if (Date.now() > session.expiresAt) {
      otpStore.delete(normalizedEmail);
      return false;
    }

    if (session.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return false;
    }

    const isValid = await bcrypt.compare(otp.trim(), session.otpHash);

    if (!isValid) {
      session.attempts++;
      return false;
    }

    // Successfully verified -> consume/delete session
    otpStore.delete(normalizedEmail);
    return true;
  },
};
