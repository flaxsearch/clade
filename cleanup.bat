rem cleanup.bat clears out Clade's data

call paths.bat

rd %SOLRPATH%\example\solr\collection1\data\index /s /q
rd %SOLRPATH%\example\solr\collection1\data\spellchecker /s /q

pause
