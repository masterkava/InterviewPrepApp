"""Pydantic schemas for authentication."""

from pydantic import BaseModel, EmailStr, Field


class RequestOTPRequest(BaseModel):
    email: EmailStr


class RequestOTPResponse(BaseModel):
    message: str
    expires_in_seconds: int


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    user_type: str | None
    target_role: str | None
    years_of_experience: int | None
    is_profile_complete: bool


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    is_profile_complete: bool
    user: UserProfileResponse


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)


class MessageResponse(BaseModel):
    message: str


class ProfileSetupRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    user_type: str = Field(pattern=r"^(student|fresher|experienced)$")
    target_role: str = Field(min_length=1, max_length=100)
    years_of_experience: int | None = Field(default=None, ge=0, le=50)


class ProfileSetupResponse(BaseModel):
    user: UserProfileResponse
    message: str
