rem go1.bat
rem This is one of the three batch files to be run to set up Clade on Windows. 
rem Each must run in its own command line shell

call paths.bat

python classify.py import data\socpsy.csv
copy solr-conf\*.* %SOLRPATH%\example\solr\collection1\conf /Y
cd %SOLRPATH%\example
java -jar start.jar &
