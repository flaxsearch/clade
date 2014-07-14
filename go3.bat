rem go3.bat
rem This is one of the three batch files to be run to set up Clade on Windows. 
rem Each must run in its own command line shell

call paths.bat

if "%1%"=="CLASSIFY" python classify.py textdir data\socpsy-pages
python server.py
