rem Run Clade 
rem
rem Three separate processes are started: Solr, Stanford NLP and the Clade server itself
rem It is necessary to pause after each one to allow server startup, this is done with a timed ping
rem 

start cmd.exe /k go1.bat
ping localhost -n 20 > nul
start cmd.exe /k go2.bat
ping localhost -n 15 > nul
start cmd.exe /k go3.bat 
