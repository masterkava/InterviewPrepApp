"""Email service for sending OTP codes via SMTP."""

from email.message import EmailMessage

import aiosmtplib
import structlog

from app.config import settings

logger = structlog.get_logger()


class EmailService:
    @property
    def _smtp_configured(self) -> bool:
        return bool(settings.smtp_username and settings.smtp_password)

    async def send_otp(self, to_email: str, otp_code: str) -> None:
        if not self._smtp_configured:
            logger.warning(
                "email.dev_mode",
                to=to_email,
                otp_code=otp_code,
                msg="SMTP not configured — OTP logged to console instead of emailed",
            )
            print(f"\n{'='*50}")
            print(f"  DEV MODE — OTP for {to_email}: {otp_code}")
            print(f"{'='*50}\n")
            return

        msg = EmailMessage()
        msg["Subject"] = f"InterviewPrep - Your login code: {otp_code}"
        msg["From"] = settings.smtp_from_email
        msg["To"] = to_email
        msg.set_content(
            f"Your InterviewPrep login code is: {otp_code}\n\n"
            f"This code expires in {settings.otp_expire_minutes} minutes.\n"
            f"If you didn't request this, please ignore this email."
        )
        msg.add_alternative(
            f"<h2>Your login code</h2>"
            f"<p style='font-size:32px;font-weight:bold;letter-spacing:8px'>{otp_code}</p>"
            f"<p>This code expires in {settings.otp_expire_minutes} minutes.</p>"
            f"<p style='color:#666'>If you didn't request this, please ignore this email.</p>",
            subtype="html",
        )

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username,
                password=settings.smtp_password,
                start_tls=settings.smtp_use_tls,
            )
            logger.info("email.otp_sent", to=to_email)
        except Exception as exc:
            logger.error("email.send_failed", to=to_email, error=str(exc))
            raise

    async def send_password_reset(self, to_email: str, token: str) -> None:
        if not self._smtp_configured:
            logger.warning(
                "email.dev_mode",
                to=to_email,
                reset_token=token,
                msg="SMTP not configured — reset token logged to console",
            )
            print(f"\n{'='*50}")
            print(f"  DEV MODE — Password reset for {to_email}")
            print(f"  Token: {token}")
            print(f"  Expires in {settings.password_reset_expire_minutes} minutes")
            print(f"{'='*50}\n")
            return

        msg = EmailMessage()
        msg["Subject"] = "InterviewPrep - Password Reset"
        msg["From"] = settings.smtp_from_email
        msg["To"] = to_email
        msg.set_content(
            f"Your password reset token is: {token}\n\n"
            f"This token expires in {settings.password_reset_expire_minutes} minutes.\n"
            f"If you didn't request this, please ignore this email."
        )
        msg.add_alternative(
            f"<h2>Password Reset</h2>"
            f"<p>Your reset token:</p>"
            f"<p style='font-size:14px;font-weight:bold;background:#f3f4f6;padding:12px;border-radius:8px;word-break:break-all'>{token}</p>"
            f"<p>This token expires in {settings.password_reset_expire_minutes} minutes.</p>"
            f"<p style='color:#666'>If you didn't request this, please ignore this email.</p>",
            subtype="html",
        )

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username,
                password=settings.smtp_password,
                start_tls=settings.smtp_use_tls,
            )
            logger.info("email.reset_sent", to=to_email)
        except Exception as exc:
            logger.error("email.send_failed", to=to_email, error=str(exc))
            raise
