#!/bin/sh
URL=http://localhost:8983/solr/update?commit=true
curl $URL --data-binary '<delete><query>*:*</query></delete>' -H 'Content-type:application/xml'
echo
