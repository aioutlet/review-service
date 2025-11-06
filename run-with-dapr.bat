@echo off
REM Dapr run script for Review Service

echo.
echo ============================================
echo Starting Review Service with Dapr...
echo ============================================
echo.

REM Set Dapr app configuration
set DAPR_APP_ID=review-service
set DAPR_HTTP_PORT=3501
set DAPR_GRPC_PORT=50002
set DAPR_APP_PORT=9001

echo Dapr Configuration:
echo    App ID: %DAPR_APP_ID%
echo    HTTP Port: %DAPR_HTTP_PORT%
echo    gRPC Port: %DAPR_GRPC_PORT%
echo    App Port: %DAPR_APP_PORT%
echo.

REM Check if Dapr is installed
where dapr >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Dapr CLI is not installed!
    echo Please install Dapr CLI: https://docs.dapr.io/getting-started/install-dapr-cli/
    pause
    exit /b 1
)

echo Checking dependencies...
echo.

REM Check if RabbitMQ is available
docker ps --filter "name=rabbitmq-message-broker" --format "table {{.Names}}" | findstr "rabbitmq-message-broker" >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: RabbitMQ container is not running!
    echo Please start RabbitMQ: docker-compose -f scripts/docker-compose/docker-compose.yml up -d rabbitmq
    pause
    exit /b 1
) else (
    echo [OK] RabbitMQ container is running
)

REM Check if MongoDB is available
docker ps --filter "name=review-mongodb" --format "table {{.Names}}" | findstr "review-mongodb" >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: MongoDB container is not running!
    echo Please start MongoDB: docker-compose -f scripts/docker-compose/docker-compose.yml up -d review-mongodb
    pause
    exit /b 1
) else (
    echo [OK] MongoDB container is running
)

echo.
echo ============================================
echo Starting Review Service with Dapr sidecar...
echo ============================================
echo.

REM Check and kill any process using the ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%DAPR_APP_PORT% ^| findstr LISTENING') do (
    echo Port %DAPR_APP_PORT% is in use by PID %%a, killing process...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 >nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%DAPR_HTTP_PORT% ^| findstr LISTENING') do (
    echo Port %DAPR_HTTP_PORT% is in use by PID %%a, killing process...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 >nul
)

REM Start the review service with Dapr
dapr run ^
  --app-id %DAPR_APP_ID% ^
  --app-port %DAPR_APP_PORT% ^
  --dapr-http-port %DAPR_HTTP_PORT% ^
  --dapr-grpc-port %DAPR_GRPC_PORT% ^
  --resources-path .dapr/components ^
  --config .dapr/config.yaml ^
  --enable-api-logging=false ^
  --placement-host-address "" ^
  --log-level warn ^
  -- npm run dev
