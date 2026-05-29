@echo off
title Hugging Face Space Deployment
color 0b
echo ====================================================
echo      Hugging Face Space Deployment Script
echo ====================================================
echo.
echo Make sure you have created a Space on Hugging Face 
echo and selected "Docker" as the SDK before running this.
echo.

set /p SPACE_URL="Enter your Space Git URL (e.g., https://huggingface.co/spaces/username/space-name): "

if "%SPACE_URL%"=="" (
    color 0c
    echo.
    echo [ERROR] Space URL cannot be empty!
    echo.
    pause
    exit /b
)

echo.
echo [1/3] Removing old links...
git remote remove hf >nul 2>&1

echo [2/3] Connecting local repository to Hugging Face...
git remote add hf %SPACE_URL%

echo [3/3] Pushing your code to Hugging Face...
echo.
echo (If prompted, enter your Hugging Face username and your Access Token as the password.)
echo.
git push hf main --force

if %errorlevel% neq 0 (
    color 0c
    echo.
    echo [ERROR] Push failed. If it asked for a password, make sure you use
    echo a Hugging Face "Write" Access Token, NOT your regular password.
    echo.
) else (
    color 0a
    echo.
    echo ====================================================
    echo [SUCCESS] Your code was pushed successfully!
    echo Hugging Face is now building your container.
    echo ====================================================
    echo.
)

pause
