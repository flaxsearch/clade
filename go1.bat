rem go1.bat

call \work\py27.bat
call \work\java6.bat
python classify.py import data\socpsy.csv
copy solr-conf\*.* \work\tools\apache-solr-3.6.0\example\solr\conf /Y
cd \work\tools\apache-solr-3.6.0\example
java -jar start.jar &