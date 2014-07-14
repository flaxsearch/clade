rem Run Clade 
rem
rem Three separate processes are started: Solr, Stanford NLP and the Clade server itself
rem It is necessary to pause after each one to allow server startup, this is done with a timed ping
rem 

start cmd.exe /k go1.bat
ping localhost -n 5 > nul
start cmd.exe /k go2.bat
ping localhost -n 2 > nul
start cmd.exe /k go3.bat 
