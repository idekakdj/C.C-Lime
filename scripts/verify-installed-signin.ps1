param(
 [Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$ExpectedVersion,
 [string]$NodeExecutable='node'
)
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT'){throw 'Installed sign-in verification requires the ordinary Windows desktop context.'}
$taskWorkspace=Split-Path -Parent $PSScriptRoot
$taskOutput=Join-Path $taskWorkspace ('test-results/installed-signin-'+$ExpectedVersion+'-'+[Guid]::NewGuid().ToString('N')+'.json')
New-Item -ItemType Directory -Path (Split-Path $taskOutput) -Force|Out-Null
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Text;using System.Runtime.InteropServices;
public static class LimeSignInPhysical {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(IntPtr handle,StringBuilder path,uint size,uint flags);
 public static string Resolve(string file){using(var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite)){var text=new StringBuilder(4096);var count=GetFinalPathNameByHandle(stream.SafeFileHandle.DangerousGetHandle(),text,4096,0);if(count==0||count>=4096)throw new IOException("Physical identity unavailable");return text.ToString();}}
}
'@
try{
 $taskProfile=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'C.C. Lime'
 $taskEnvironment=Join-Path $taskProfile '.local/.env'
 $taskExe=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('cc_lime/app-'+$ExpectedVersion+'/cc-lime.exe')
 foreach($taskFile in @($taskEnvironment,$taskExe)){
  if([LimeSignInPhysical]::Resolve($taskFile) -ine ('\\?\'+[IO.Path]::GetFullPath($taskFile))){throw 'Redirected physical configuration/executable cannot prove normal-launch readiness.'}
 }
 $taskBefore=(Get-FileHash -LiteralPath $taskEnvironment -Algorithm SHA256).Hash
 Push-Location $taskWorkspace
 try{$taskText=& $NodeExecutable (Join-Path $PSScriptRoot 'signin-readiness.mjs') $taskExe $taskEnvironment $ExpectedVersion; $taskExit=$LASTEXITCODE}finally{Pop-Location}
 if($taskExit-ne0){throw 'Installed fresh/restart sign-in readiness failed.'}
 $taskResult=($taskText -join [Environment]::NewLine)|ConvertFrom-Json -Depth 12
 if($taskResult.version-ne$ExpectedVersion-or-not$taskResult.normalExit-or$taskResult.freshAndRestart.Count-ne2-or-not$taskResult.privateEnvironmentRemoved){throw 'Invalid installed sign-in result.'}
 foreach($taskCycle in $taskResult.freshAndRestart){if(-not$taskCycle.configured-or-not$taskCycle.googleConfigured-or-not$taskCycle.emailControlEnabled-or-not$taskCycle.googleControlEnabled-or-not$taskCycle.resetControlEnabled){throw 'Authentication controls are unavailable.'}}
 if((Get-FileHash -LiteralPath $taskEnvironment -Algorithm SHA256).Hash -cne $taskBefore){throw 'Private normal environment changed during verification.'}
 $taskReport=[pscustomobject]@{ok=$true;observedAt=[DateTime]::UtcNow.ToString('o');version=$ExpectedVersion;physicalNormalConfigurationVerified=$true;physicalInstalledExecutableVerified=$true;configurationUnchanged=$true;executableSha256=(Get-FileHash -LiteralPath $taskExe).Hash.ToLowerInvariant();archiveSha256=(Get-FileHash -LiteralPath (Join-Path (Split-Path $taskExe) 'resources/app.asar')).Hash.ToLowerInvariant();readiness=$taskResult;scope='Normal-context private configuration plus actual installed executable in an isolated fresh profile; owner account/calendar untouched. Live authentication is a separate gate.'}
 $taskReport|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $taskOutput -Encoding utf8
 Write-Output ('Installed '+$ExpectedVersion+' email/Google controls verified across fresh start and restart; private configuration unchanged.')
}catch{
 [pscustomobject]@{ok=$false;version=$ExpectedVersion;error='Installed sign-in verification failed; inspect normal desktop configuration and expected executable without publishing private values.'}|ConvertTo-Json|Set-Content -LiteralPath $taskOutput
 throw 'Installed sign-in gate failed. No update-complete claim is permitted.'
}
