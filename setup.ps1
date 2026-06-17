#requires -Version 5.1
<#
.SYNOPSIS
  PickFit 로컬 DB 셋업 — 데이터베이스 생성 → 마이그레이션 → 시드(상품 200개) 적용.

.DESCRIPTION
  다른 PC에서 git pull 후 한 번만 실행하면 로컬 MySQL에 `pickfit` DB를
  스키마 + 무신사 카탈로그까지 그대로 복원합니다.
  (실제 DB 데이터 파일은 git에 없으므로 이 스크립트로 재생성합니다.)

  마이그레이션은 CREATE TABLE IF NOT EXISTS, 시드는 INSERT IGNORE 라
  여러 번 실행해도 안전합니다(이미 있으면 건너뜀).

  ※ 회원/추천기록 같은 런타임 데이터는 복원되지 않습니다(원래 각 PC 로컬).

.PARAMETER DbHost     MySQL 호스트 (기본 127.0.0.1)
.PARAMETER DbPort     포트 (기본 3306)
.PARAMETER DbUser     계정 (기본 root)
.PARAMETER DbPassword 비밀번호 (기본 빈 값 = 비번 없음)
.PARAMETER Database   DB 이름 (기본 pickfit)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\setup.ps1

.EXAMPLE
  .\setup.ps1 -DbUser root -DbPassword secret -Database pickfit
#>
[CmdletBinding()]
param(
    [string]$DbHost     = "127.0.0.1",
    [int]   $DbPort     = 3306,
    [string]$DbUser     = "root",
    [string]$DbPassword = "",
    [string]$Database   = "pickfit"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# 콘솔에 한글이 깨지지 않도록 출력 인코딩을 UTF-8 로 (실패해도 무시)
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Host "== PickFit DB 셋업 ==" -ForegroundColor Cyan

# 1) mysql.exe 찾기 — PATH 우선, 없으면 표준 설치 경로에서 최신 버전 선택
$mysql = $null
$onPath = Get-Command mysql.exe -ErrorAction SilentlyContinue
if ($onPath) {
    $mysql = $onPath.Source
} else {
    $found = Get-ChildItem "C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe" -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { $mysql = $found.FullName }
}
if (-not $mysql) {
    throw "mysql.exe를 찾을 수 없습니다. MySQL을 설치하거나 bin 폴더를 PATH에 추가하세요."
}
Write-Host "mysql 클라이언트: $mysql"

# 공통 접속 인자
#  --protocol=TCP    : 빈 host가 named pipe(localhost)로 빠져 실패하는 함정 회피
#  --default-character-set=utf8mb4 : 한글(상품명/리뷰) 보존
$common = @(
    "--host=$DbHost", "--port=$DbPort", "--protocol=TCP",
    "--user=$DbUser", "--default-character-set=utf8mb4"
)
if ($DbPassword -ne "") { $common += "--password=$DbPassword" }

# mysql 한 번 호출 헬퍼 (실패 시 예외)
function Invoke-Mysql {
    param([Parameter(Mandatory = $true)][string[]]$MysqlArgs)
    & $mysql @common @MysqlArgs
    if ($LASTEXITCODE -ne 0) { throw "mysql 명령 실패 (exit $LASTEXITCODE)" }
}

# SOURCE는 mysql 클라이언트가 cwd 기준으로 파일을 직접 읽으므로 프로젝트 루트에서 실행
Push-Location $root
try {
    # 2) 연결 확인 — 안 되면 MySQL 시작 방법 안내 후 중단
    try {
        Invoke-Mysql -MysqlArgs @("-e", "SELECT 1;") | Out-Null
    } catch {
        Write-Host ""
        Write-Host "MySQL($DbHost`:$DbPort) 접속 실패. 먼저 MySQL을 켜세요:" -ForegroundColor Yellow
        Write-Host '  mysqld --datadir="C:\Users\miso\.pickfit-mysql\data" --port=3306 --console' -ForegroundColor Yellow
        throw
    }
    Write-Host "MySQL 연결 OK"

    # 3) 데이터베이스 생성(없으면)
    Write-Host "데이터베이스 '$Database' 준비..."
    Invoke-Mysql -MysqlArgs @("-e",
        "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")

    # 4) 마이그레이션 — 파일명 오름차순(001→…)으로 순서대로 적용
    $migrations = Get-ChildItem "database\migrations\*.sql" -ErrorAction SilentlyContinue | Sort-Object Name
    if (-not $migrations) { throw "database\migrations 에 .sql 파일이 없습니다." }
    foreach ($m in $migrations) {
        Write-Host ("  마이그레이션: {0}" -f $m.Name)
        # mysql 클라이언트가 직접 파일을 읽는 SOURCE 사용 → PowerShell 파이프 인코딩 깨짐 회피
        Invoke-Mysql -MysqlArgs @($Database, "-e", "SOURCE database/migrations/$($m.Name)")
    }

    # 5) 시드 — 무신사 카탈로그(상품 200개 + 리뷰)
    $seedRel = "database/seeds/musinsa_catalog_seed.sql"
    if (Test-Path $seedRel) {
        Write-Host "  시드: musinsa_catalog_seed.sql"
        Invoke-Mysql -MysqlArgs @($Database, "-e", "SOURCE $seedRel")
    } else {
        Write-Host "  (시드 파일 없음 — 건너뜀)" -ForegroundColor Yellow
    }

    # 6) 검증 — 상품 수 출력
    $count = (& $mysql @common $Database "-N" "-e" "SELECT COUNT(*) FROM products;") -join ""
    Write-Host ""
    Write-Host ("완료. products 행 수: {0}" -f $count) -ForegroundColor Green
    Write-Host ".env 가 없으면: copy .env.example .env  (그리고 OPENAI_API_KEY 등 채우기)" -ForegroundColor Green
    Write-Host "서버 실행:  php -S 127.0.0.1:8002 -t public public/index.php" -ForegroundColor Green
}
finally {
    Pop-Location
}
