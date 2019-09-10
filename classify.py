#!/usr/bin/env python
#-*- coding: utf-8 -*-

"""
Copyright 2012 Lemur Consulting Limited

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import os
import re
#import cPickle
import pickle
import csv
import time

from lib import docx
from lib import xmldoc
from lib import taxonomy
from lib import ner
from lib import csv_unicode
#import sunburnt
import pysolr
import httplib2

import settings

csv.field_size_limit(1000000000)

WORD_RE = re.compile(r'[\w\-\']+')
RE_WORD_DELIM = re.compile(r'[\w\-\']+|[\.\,\:\;\!\?\"\(\)\[\]]')
DELIMS = '.,:;!?"()[]'
LINKWORDS = set(('and', 'of', 'the'))


def process_dir(solr, dir):
    """ Process the .docx files in dir, using the supplied taxonomies to
        classify them, and storing the results in the xapian index.

    """
    def f(arg, dirname, names):
        for name in names:
            if name.lower().endswith('.docx'):
                process_file(solr, os.path.join(dirname, name))

    os.path.walk(dir, f, None)
    solr.commit()

def process_dir_xml(solr, dir):
    """ Process the .xml files in dir, using the supplied taxonomies to
        classify them, and storing the results in the xapian index.

    """
    def f(arg, dirname, names):
        for name in names:
            if name.lower().endswith('.xml'):
                process_xml_file(solr, os.path.join(dirname, name))

    os.path.walk(dir, f, None)
    solr.commit()

def process_dir_text(solr, dir):
    """ Process the text files in dir, etc.
    """
    docidbase = int(time.time()) - 1262304000
    for count, name in enumerate(os.listdir(dir)):
        if name[0] != '.':
            with open(os.path.join(dir, name)) as f:
                text = f.read()
                #print('naame:',name)
                #print(text)
                #name = name.decode('utf8', 'ignore') # dep  Getting a message this doesn't exist
                #text = text.decode('utf8')
                docid = '%s.%s' % (docidbase, count)
                update_solr(solr, docid, name, text)

    solr.commit()

def process_file(solr, file):
    _, _, text, title = docx.parse_docx(file)
    filename = os.path.basename(file)
    update_solr(solr, filename, title or filename, text)
    solr.commit()

def process_xml_file(solr, file):
    _, _, text, title = xmldoc.parse_xml(file)
    filename = os.path.basename(file)
    update_solr(solr, filename, title or filename, text)
    solr.commit()

def process_csv(solr, path):
    with open(path) as f:
        for line in csv_unicode.UnicodeReader(f):
            text = "%s\n\n%s" % (line[0], line[1])
            update_solr(solr, line[2], line[6] or 'no title', text)
    solr.commit()

def update_solr(solr, unique_term, title, text):
    print ('updating', unique_term, title)
    doc = {'id': '1'}
    doc = { 'title': title, 'text': text, 'doc_id': unique_term }
    doc['entity'] = tuple(set(x for x in iter_entity_terms(text)))
    solr.add([doc])

def iter_entity_terms(text):
    for term in ner.get_entities(settings.ner_host, settings.ner_port, text):
        if len(term) < 50:
            #yield unicode(term, "utf-8")  DEP
            print('yielding',term)
            yield term

def iter_text_terms(text):
    phrase = []
    not1st = False

    for word in RE_WORD_DELIM.findall(text):
        if word in DELIMS:
            if (len(phrase) > 1 and len(phrase) < 6 and
                phrase[0] not in LINKWORDS and
                phrase[-1] not in LINKWORDS):
                yield ' '.join(phrase)
            phrase = []
        else:
            if word[0].isalnum():
                w = word.lower()
                if w not in settings.stopwords:
                    yield w

            if not1st:
                if word[0].isupper():
                    phrase.append(word.lower())
                elif phrase and word.lower() in LINKWORDS:
                    phrase.append(word.lower())
            else:
                if (len(phrase) > 1 and len(phrase) < 6 and
                    phrase[0] not in LINKWORDS and
                    phrase[-1] not in LINKWORDS):
                    yield ' '.join(phrase)
                phrase = []

        not1st = (word not in '.?!')

def get_doctext(solr, did):
    """ Return the text for a document ID.

    """
    return solr.query(doc_id=did).execute()[0]["text"]


if __name__ == '__main__':
    import sys
    #import cPickle
    import pickle

    # FIXME - help message

    def _parse(path):
        with open(path) as f:
            if path.endswith('.xml'):
                return taxonomy.parse_xml(f)
            elif path.endswith('.csv'):
                return taxonomy.parse_csv(f)
            else:
                print ('unrecognized input file extension (use .xml or .csv)')
                sys.exit(1)

    if sys.argv[1] == 'import':
        with open(settings.taxonomy_path, 'wb') as f:
            taxes = [_parse(x) for x in sys.argv[2:]]
            pickle.dump(taxes, f)
            print ('imported', len(taxes), 'taxonomies')
    else:
        with open(settings.taxonomy_path, 'rb') as f:
            taxes = pickle.load(f)

        h = httplib2.Http(cache=settings.http_cache)
        _solr = pysolr.Solr(settings.solr_url, timeout=100)
        #_solr = sunburnt.SolrInterface(settings.solr_url, http_connection=h) // dep http_cnnection??

        if sys.argv[1] == 'export':
            with open(sys.argv[2], 'w') as f:
                if sys.argv[2].endswith('.xml'):
                    if len(sys.argv) > 3:
                        solr = _solr
                        try:
                            rows = int(sys.argv[3])
                        except ValueError:
                            print ('rows value must be integer')
                            sys.exit(1)
                    else:
                        solr = None
                        rows = None
                    taxonomy.write_xml(f, taxes, _solr=solr, rows=rows)
                elif sys.argv[2].endswith('.csv'):
                    taxonomy.write_csv(f, taxes)
                else:
                    print ('unrecognized output file extension (use .xml or .csv)')

        elif sys.argv[1] == 'lscat':
            tax = taxonomy.term_for_path(taxes, sys.argv[2])
            if tax:
                print ('tax:', tax)
                for doc in taxonomy.get_docs_for_category(_solr, tax):
                    print (doc)
            else:
                print ('no matching taxonomy')

        elif sys.argv[1] == 'classify':
            with open(sys.argv[2], 'w') as f:
                taxonomy.write_classification(_solr, f, taxes)

        elif sys.argv[1] == 'doctext':
            print (get_doctext(_solr, int(sys.argv[2])))

        elif sys.argv[1] == 'suggest':
            for term in taxonomy.suggest_keywords(_solr, sys.argv[2:], [], 7):
                print (term)

        elif sys.argv[1] == 'docdir':
            process_dir(_solr, sys.argv[2])

        elif sys.argv[1] == 'xmldocdir':
            process_dir_xml(_solr, sys.argv[2])

        elif sys.argv[1] == 'docfile':
            process_file(_solr, sys.argv[2])

        elif sys.argv[1] == 'csvfile':
            process_csv(_solr, sys.argv[2])

        elif sys.argv[1] == 'textdir':
            process_dir_text(_solr, sys.argv[2])
