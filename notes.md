Notes

move /solr-conf into /solr/solr-home/index/conf
schema.xml
solrconfig.xml
stopwords.txt


Created init project.

Wonder if this should all be under demo?




# take 2
bin/solr start
bin/solr create -c clade -d /Users/epugh/Documents/projects/clade-epugh/solr-conf


# take 3

cp -f solr-conf/* demo/solr-4.8.1/example/solr/collection1/conf
cd demo/solr-4.8.1/example
java -jar start.jar

python3 classify.py import taxonomy.csv

python3 classify.py textdir data/socpsy-pages

python3 server.py
