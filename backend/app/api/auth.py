"""Auth API endpoints — password login, OTP login, token refresh, profile management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.auth import (
    AuthTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ProfileSetupRequest,
    ProfileSetupResponse,
    RefreshTokenRequest,
    RegisterRequest,
    RequestOTPRequest,
    RequestOTPResponse,
    ResetPasswordRequest,
    UserProfileResponse,
    VerifyOTPRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_response(user) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        user_type=user.user_type,
        target_role=user.target_role,
        years_of_experience=user.years_of_experience,
        is_profile_complete=user.is_profile_complete,
    )


@router.post("/register", response_model=AuthTokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user, tokens = await svc.register(body.email, body.password, body.display_name)
    return AuthTokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=tokens["expires_in"],
        is_profile_complete=user.is_profile_complete,
        user=_user_response(user),
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user, tokens = await svc.login_with_password(body.email, body.password)
    return AuthTokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=tokens["expires_in"],
        is_profile_complete=user.is_profile_complete,
        user=_user_response(user),
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    found = await svc.request_password_reset(body.email)
    if not found:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register first.")
    return MessageResponse(
        message="A reset token has been sent. Check your backend console (dev mode) for the token."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    await svc.reset_password(body.token, body.new_password)
    return MessageResponse(message="Password has been reset successfully")


@router.post("/request-otp", response_model=RequestOTPResponse)
async def request_otp(body: RequestOTPRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    expires_in = await svc.request_otp(body.email)
    return RequestOTPResponse(
        message="Verification code sent to your email",
        expires_in_seconds=expires_in,
    )


@router.post("/verify-otp", response_model=AuthTokenResponse)
async def verify_otp(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user, tokens = await svc.verify_otp(body.email, body.code)
    return AuthTokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=tokens["expires_in"],
        is_profile_complete=user.is_profile_complete,
        user=_user_response(user),
    )


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user, tokens = await svc.refresh_access_token(body.refresh_token)
    return AuthTokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=tokens["expires_in"],
        is_profile_complete=user.is_profile_complete,
        user=_user_response(user),
    )


@router.post("/logout")
async def logout(user: CurrentUser, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    await svc.logout(user)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user: CurrentUser):
    return _user_response(user)


@router.put("/profile", response_model=ProfileSetupResponse)
async def setup_profile(body: ProfileSetupRequest, user: CurrentUser):
    user.display_name = body.display_name
    user.user_type = body.user_type
    user.target_role = body.target_role
    user.years_of_experience = body.years_of_experience
    user.is_profile_complete = True
    return ProfileSetupResponse(
        user=_user_response(user),
        message="Profile updated successfully",
    )
