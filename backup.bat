@echo off
setlocal enabledelayedexpansion

:: Get current date and time
set "timestamp=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "timestamp=%timestamp: =0%"  :: Replace space with 0 for hours <10

:: Backup folder name
set "backupDir=backups\%timestamp%"

:: Create folder
if not exist "%backupDir%" mkdir "%backupDir%"

:: List of files/folders to backup (add more as needed)
copy "smartgeocode-frontend\app\dashboard\page.tsx" "%backupDir%\dashboard_page.tsx"
copy "smartgeocode-frontend\app\api\batch-geocode\route.ts" "%backupDir%\batch_geocode_route.ts"
copy "smartgeocode-frontend\app\api\checkout\route.ts" "%backupDir%\checkout_route.ts"
copy "smartgeocode-frontend\app\layout.tsx" "%backupDir%\layout.tsx"
copy "smartgeocode-frontend\ClientHeader.tsx" "%backupDir%\ClientHeader.tsx"
copy "src\main\java\io\smartgeocode\controller\GeocodeController.java" "%backupDir%\GeocodeController.java"
copy "smartgeocode-frontend\package.json" "%backupDir%\package.json"
copy "smartgeocode-frontend\next.config.js" "%backupDir%\next_config.js"

echo.
echo Backup completed to: %backupDir%
echo Files backed up: dashboard/page.tsx, batch-geocode/route.ts, checkout/route.ts, layout.tsx, ClientHeader.tsx, GeocodeController.java, package.json, next.config.js
pause