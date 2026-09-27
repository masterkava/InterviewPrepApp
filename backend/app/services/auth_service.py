"""Authentication service — OTP generation/verification, password auth, JWT issuance, token rotation."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import AuthenticationError, ConflictError, RateLimitError
from app.models.otp import OTPCode
from app.models.user import User
from app.services.email_service import EmailService

logger = structlog.get_logger()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._email = EmailService()

    # --- Password auth ---

    async def register(self, email: str, password: str, display_name: str) -> tuple[User, dict]:
        """Create a new user with email + password. Returns (user, tokens)."""
        existing = (
            await self._db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if existing is not None:
            raise ConflictError("An account with this email already exists")

        user = User(
            email=email,
            password_hash=_hash_password(password),
            display_name=display_name,
        )
        self._db.add(user)
        await self._db.flush()

        tokens = self._issue_tokens(user)
        user.refresh_token_jti = tokens["jti"]

        logger.info("auth.register", user_id=str(user.id), email=email)
        return user, tokens

    async def login_with_password(self, email: str, password: str) -> tuple[User, dict]:
        """Authenticate with email + password. Returns (user, tokens)."""
        user = (
            await self._db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if user is None or not user.password_hash:
            raise AuthenticationError("Invalid email or password")

        if not _verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid email or password")

        if not user.is_active:
            raise AuthenticationError("Account is deactivated")

        tokens = self._issue_tokens(user)
        user.refresh_token_jti = tokens["jti"]

        logger.info("auth.login", user_id=str(user.id))
        return user, tokens

    # --- Password reset ---

    async def request_password_reset(self, email: str) -> bool:
        """Generate a reset token and send it. Returns False if no account found."""
        user = (
            await self._db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if user is None or not user.password_hash:
            logger.info("auth.reset_no_user", email=email)
            return False

        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(
            minutes=settings.password_reset_expire_minutes
        )

        await self._email.send_password_reset(email, token)
        logger.info("auth.reset_requested", user_id=str(user.id))
        return True

    async def reset_password(self, token: str, new_password: str) -> None:
        """Validate reset token and set new password."""
        now = datetime.now(timezone.utc)
        user = (
            await self._db.execute(
                select(User).where(
                    User.password_reset_token == token,
                    User.password_reset_expires > now,
                )
            )
        ).scalar_one_or_none()

        if user is None:
            raise AuthenticationError("Invalid or expired reset token")

        user.password_hash = _hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        user.refresh_token_jti = None

        logger.info("auth.password_reset", user_id=str(user.id))

    # --- OTP auth ---

    async def request_otp(self, email: str) -> int:
        """Generate and send an OTP. Returns expires_in_seconds."""
        now = datetime.now(timezone.utc)

        latest = (
            await self._db.execute(
                select(OTPCode)
                .where(OTPCode.email == email, OTPCode.is_used.is_(False))
                .order_by(OTPCode.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if latest and (now - latest.created_at).total_seconds() < settings.otp_cooldown_seconds:
            raise RateLimitError(
                f"Please wait {settings.otp_cooldown_seconds} seconds before requesting a new code"
            )

        # Invalidate old unused OTPs
        old_otps = (
            await self._db.execute(
                select(OTPCode).where(OTPCode.email == email, OTPCode.is_used.is_(False))
            )
        ).scalars().all()
        for otp in old_otps:
            otp.is_used = True

        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = now + timedelta(minutes=settings.otp_expire_minutes)

        otp_record = OTPCode(email=email, code=code, expires_at=expires_at)
        self._db.add(otp_record)
        await self._db.flush()

        await self._email.send_otp(email, code)
        logger.info("auth.otp_requested", email=email)
        return settings.otp_expire_minutes * 60

    async def verify_otp(self, email: str, code: str) -> tuple[User, dict]:
        """Verify OTP and return (user, tokens_dict)."""
        now = datetime.now(timezone.utc)

        otp = (
            await self._db.execute(
                select(OTPCode)
                .where(
                    OTPCode.email == email,
                    OTPCode.is_used.is_(False),
                    OTPCode.expires_at > now,
                )
                .order_by(OTPCode.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if otp is None:
            raise AuthenticationError("Invalid or expired code")

        if otp.attempts >= settings.otp_max_attempts:
            otp.is_used = True
            raise AuthenticationError("Too many attempts. Request a new code.")

        if otp.code != code:
            otp.attempts += 1
            raise AuthenticationError("Invalid code")

        otp.is_used = True

        user = (
            await self._db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if user is None:
            user = User(email=email)
            self._db.add(user)
            await self._db.flush()
            logger.info("auth.user_created", user_id=str(user.id), email=email)

        if not user.is_active:
            raise AuthenticationError("Account is deactivated")

        tokens = self._issue_tokens(user)
        user.refresh_token_jti = tokens["jti"]

        logger.info("auth.login", user_id=str(user.id))
        return user, tokens

    async def refresh_access_token(self, refresh_token: str) -> tuple[User, dict]:
        """Validate refresh token, rotate JTI, return (user, new_tokens)."""
        try:
            payload = jwt.decode(
                refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Refresh token expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type")

        user_id = payload.get("sub")
        jti = payload.get("jti")
        if not user_id or not jti:
            raise AuthenticationError("Invalid refresh token")

        user = (
            await self._db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        ).scalar_one_or_none()

        if user is None or not user.is_active:
            raise AuthenticationError("User not found or deactivated")

        if user.refresh_token_jti != jti:
            user.refresh_token_jti = None
            logger.warning("auth.token_reuse_detected", user_id=user_id)
            raise AuthenticationError("Token has been revoked")

        tokens = self._issue_tokens(user)
        user.refresh_token_jti = tokens["jti"]
        return user, tokens

    async def logout(self, user: User) -> None:
        user.refresh_token_jti = None
        logger.info("auth.logout", user_id=str(user.id))

    def _issue_tokens(self, user: User) -> dict:
        now = datetime.now(timezone.utc)
        jti = str(uuid.uuid4())

        access_payload = {
            "sub": str(user.id),
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        }
        refresh_payload = {
            "sub": str(user.id),
            "type": "refresh",
            "jti": jti,
            "iat": now,
            "exp": now + timedelta(days=settings.jwt_refresh_token_expire_days),
        }

        return {
            "access_token": jwt.encode(access_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm),
            "refresh_token": jwt.encode(refresh_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm),
            "expires_in": settings.jwt_access_token_expire_minutes * 60,
            "jti": jti,
        }
