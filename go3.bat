rem go3.bat

call \work\py27.bat
call \work\java6.bat
python classify.py textdir data\socpsy-pages
python server.py
