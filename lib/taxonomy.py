# Copyright 2012 Lemur Consulting Limited
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#    http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import csv
import re
import string
from xml.etree.ElementTree import ElementTree
from xml.etree.ElementTree import TreeBuilder
from lxml import etree

WORD_RE = re.compile(r'[\w\-\']+')
RE_WORD_DELIM = re.compile(r'[\w\-\']+|[\.\,\:\;\!\?\"\(\)\[\]]')
DELIMS = '.,:;!?"()[]'
CSV_RE = re.compile(r'[ |,:;]+')


class ClassificationError(Exception):
    pass


class Term(object):
    """ A taxonomy category with clues/keywords (each of which is a string
        plus a boolean flag which if False indicates a NOT term).
    """

    _uid = 0
    def __init__(self, name=None, level=0, clues=None, uid=None):
        self.parent = None
        self.name = name
        self.level = level
        if clues is None or len(clues) == 0 and name is not None:
            self._clues = dict((word, True) for word in WORD_RE.findall(name.lower()))
        else:
            self._clues = clues
        self.children = []
        if uid is not None:
            Term._uid = max(uid, Term._uid)
            self.uid = uid
        else:
            self.uid = Term._uid = Term._uid + 1

    def add_child(self, child):
        self.children.append(child)
        child.parent = self
    
    def create_child(self, name):
        child = Term(name, self.level + 1, None)
        self.add_child(child)
        return child
        
    def iter_clues(self):
        for clue in self._clues.iteritems():
            yield clue
        
    def set_clue(self, clue, positive=True):
        self._clues[clue] = positive

    def toggle_clue(self, clue):
        self._clues[clue] = not self._clues[clue]
    	
    def delete_clue(self, clue):
        if clue in self._clues:
            del self._clues[clue]
    
    def display(self):
        """Display this Term and all its descendants.
        
        """
        print '%s%s: %s' % ('  ' * self.level, self.name, self.clues)
        for c in self.children:
            c.display()
    
    def __str__(self):
        """Return the path to this Term from the root as a string.
        
        """
        l = []
        while self:
            l.append(self.name)
            self = self.parent        
        return '/'.join(l[::-1])
    
    def walk(self, f_pre=None, f_post=None):
        """ Walk the tree, calling f_pre(self) and f_post(self) before and after
            calling on each child.
        
        """
        if f_pre is not None:
            f_pre(self)
        for c in self.children:
            c.walk(f_pre, f_post)
        if f_post is not None:
            f_post(self)
    
    def for_jtree(self, solr):
        count = get_category_doc_count(solr, self)
        word = "document" if count == 1 else "documents"
        return {
                'attr': { "id": "term%s" % self.uid },
                'data': { "title": self.name, "attr": { "title": "%d %s" % (count, word) } },
                'children': [x.for_jtree(solr) for x in self.children]
               }


def term_for_path(taxes, term_path):
    """ Return a Term for the given path, e.g. "Software/Operating Systems/Ubuntu".
    """
    names = term_path.split("/")
    assert len(names) > 0
    terms = taxes
    for name in names:
        for term in terms:
            if term.name == name:
                terms = term.children
                break
        else:
            return None
    return term

def parse_csv_file(path):
    def f_clue(x):
        if x[0] == '-':
            return (x[1:], False)
        return (x, True)
    
    stack = [None] * 100  # should be plenty
    with open(path) as f:
        for line in csv.reader(f):
            # get level
            for level in xrange(100):
                if line[level]: break
            
            name = line[level]
            clues = []
            cluestr = ''
            try:
                cluestr = line[level+1]
            except IndexError:
                pass

            if cluestr:
                assert cluestr.startswith('clues:')
                clues = dict(f_clue(x) for x in CSV_RE.split(cluestr[6:]))

            if level == 0:
                assert stack[0] == None
                stack[0] = Term(name, level, clues)
            else:
                stack[level] = Term(name, level, clues)
                stack[level-1].add_child(stack[level])

    return stack[0]

def parse_xml_file(path):
    context = etree.iterparse(path, events=("start", "end"))
    term = None
    level = 0
    for event, elem in context:
        print event, elem.tag, elem.text, elem.attrib
        if event == 'start' and elem.tag == 'category':
            t = Term(uid=elem.attrib.get('id'), clues={}, level=level)
            if term is not None:
                term.add_child(t)
            term = t
            level += 1
        elif event == 'end' and elem.tag == 'name':
            term.name = elem.text
        elif event == 'end' and elem.tag == 'clue':
            term._clues[elem.text] = elem.attrib.get('negative') != 'true'
        elif event == 'end' and elem.tag == 'category':
            if term.parent is None:
                return term
            term = term.parent
            level -= 1
    assert False

def write_csv_file(f, taxes):
    """ Export a CSV file for the given taxonomies to the (open) file handle
        specified.
        
    """
    write_csv_file.level = 0
    def f_clue(clue, positive):
        sign = '' if positive else '-'
        return '%s%s' % (sign, clue)
    
    def f_pre(term):
        for _ in xrange(write_csv_file.level):
            f.write(',')
        f.write('"%s"' % term.name)
        f.write(',"clues:')
        f.write(' '.join([f_clue(clue, positive) for clue, positive in term.iter_clues()]))
        f.write('"\r\n')
        write_csv_file.level += 1
                    
    def f_post(term):
        write_csv_file.level -= 1
    
    for term in taxes:
        term.walk(f_pre, f_post)

def write_xml_file(f, taxes):
    """ Export an XML file for the given taxonomies to the (open) file handle
        specified.
    
    """
    x = TreeBuilder()
    x.start("taxonomy", {})
    
    def f_pre(term):
        x.start("category", { "id": str(term.uid) })
        x.start("name", {})
        x.data(term.name)
        x.end("name")
        for clue, positive in term.iter_clues():
            attrs = {}
            if not positive:
                attrs["negative"] = 'true'
            x.start("clue", attrs)
            x.data(clue)
            x.end("clue")
    
    def f_post(term):
        x.end("category")
        
    for term in taxes:
        term.walk(f_pre, f_post)

    x.end("taxonomy")
    
    xml = ElementTree(x.close())
    xml.write(f, xml_declaration=True, encoding="utf-8")

def classify_doc(text, tax):
    """ Classify some document text using the supplied taxonomy tree(s). Return
        a list of (Term, score) ordered by score.
    
    """
    results = []
    parsed_text = parse_text(text)
    
    def calc(term):
        count = 0
        total = 0.0
        for clue, p in term.iter_clues():
            parsed_clue = [x.lower() for x in WORD_RE.findall(clue)]
            count += 1
            m = 1 if p else -1 #FIXME: is this correct?
            total += m * calc_score(parsed_text, parsed_clue)
        
        total = total / count       # normalisation(?)
        results.append((term, total))
    
    if isinstance(tax, Term):
        tax.walk(calc)              # walk a single taxonomy
    else:
        for t in tax:               # walk several taxonomies
            t.walk(calc)
    
    return sorted((x for x in results if x[1]),        # remove zero scores
                  key=lambda x: x[1], reverse=True)

def write_classification(solr, f, taxes):
    """ Export document classifications in CSV format:
    
        doc id, doc title, category id, category name
    
    """
    out = csv.writer(f)
    first = 0
    while True:
        docs = solr.query().paginate(rows=100, start=first).execute().result.docs
        for doc in docs:
            terms = classify_doc(doc["text"], taxes)
            if len(terms) == 0:
                out.writerow([doc["doc_id"], doc["title"].encode("UTF-8"), None, None])
            else:
                out.writerow([doc["doc_id"], doc["title"].encode("UTF-8"), terms[0][0].uid, str(terms[0][0])])
        if len(docs) < 100:
            break
        first += 100

def parse_text(text):
    """Return a dict of word (lowercase) -> [positions]. Where there are
    periods, add 10 to the position so that phrases do not match across
    sentences etc (crude but should work).
    
    """
    pos = 0
    ret = {}
    
    for tok in RE_WORD_DELIM.findall(text):
        if tok in DELIMS:
            pos += 10
        else:
            pos += 1
            ret.setdefault(tok.lower(), []).append(pos)
    
    return ret

def calc_score(parsed_text, clue):
    """Calculate a score for text parsed with parse_text() and a clue (as an
    iterable).
    
    """

    # match whole phrases, score len(phrase) x tf
    # FIXME use IDF too?

    matches = parsed_text.get(clue[0], [])
    for word in clue[1:]:
        tmp = []
        newmatches = parsed_text.get(word, [])
        for pos in matches:
            if pos + 1 in newmatches:
                tmp.append(pos + 1)
        matches = tmp
    
    return float(len(matches) * len(clue)) / len(parsed_text)
    
def _category_doc_query(_solr, term):
    """ Return a sunburnt query for category documents.
    
    """
    assert isinstance(term, Term)

    pos = None
    neg = None
    for clue, p in term.iter_clues():
        words = [x.lower() for x in WORD_RE.findall(clue)]
        if len(words) == 1:
            q = _solr.Q(text=words[0])
        elif len(words) > 1:
            q = _solr.Q(text=' '.join(words))
        if p:
            if pos is None:
                pos = q
            else:
                pos |= q
        else:
            if neg is None:
                neg = q
            else:
                neg |= q
                
    if pos is not None:
        if neg is not None:
            query = pos & ~neg
        else:
            query = pos
    else:
        if neg is not None:
            query = ~neg
        else:
            return None

    return _solr.query(query)

def get_category_doc_count(_solr, term):
    """ Return the number of documents in the category.
    
    """
    query = _category_doc_query(_solr, term)
    return query.paginate(rows=0).execute().result.numFound

def get_docs_for_category(_solr, term):
    """ Return a tuple (numFound, docs) where numFound is the number of
        documents found in a category, and docs is a list of tuples
        (docid, title, score) for each document in the category.
    
    """
    query = _category_doc_query(_solr, term)
    if query is None:
        return (0, [])
    results = query.field_limit(["doc_id", "title"], score=True).paginate(rows=10).execute()
    return (results.result.numFound, [(doc["doc_id"], doc["title"], doc["score"]) for doc in results])

def get_doc_ids_for_category(_solr, term):
    """ Return doc ids for each document in a category.
    
    """
    query = _category_doc_query(_solr, term)
    if query is None:
        return []
    return [doc["doc_id"] for doc in query.field_limit("doc_id").paginate(rows=100).execute()]

def num_docs(solr):
    """ Return the number of documents in the index.
    """
    r = solr.query().paginate(rows=0).execute()
    return r.result.numFound

from math import log

def suggest_keywords(solr, dids, exclude, count):
    """ Return suggested terms for a set of document IDs.
    
    """
    if len(dids) == 0:
        return []
    q = None
    for doc_id in dids:
        if q is None:
            q = solr.Q(doc_id=doc_id)
        else:
            q |= solr.Q(doc_id=doc_id)
    field = "text_mlt"
    opts = { "q": q, "rows": 100, "fl": "_", "tv": True, "tv.fl": field, "tv.df": True, "tv.tf": True }
    r = solr.search(**opts)
    root = etree.fromstring(r.original_xml)
    # find the term vectors info
    tvEl = root.xpath('/response/lst[@name="termVectors"]')[0]
    # echo any warnings
    for warnEl in tvEl.xpath('lst[@name="warnings"]/arr'):
        msg = warnEl.attrib["name"]
        field = warnEl.xpath('str')[0].text
        print "WARNING: '%s' for field '%s'" % (msg, field)
        
    N = num_docs(solr)
    R = int(root.xpath('/response/result[@name="response"]')[0].attrib["numFound"])
    # for each doc element...
    keywords = {}
    totalL = 0
    for docEl in tvEl.xpath('lst[@name!="warnings"]'):
        doc_id = docEl.xpath('str[@name="uniqueKey"]')[0].text
        keywordList = docEl.xpath('lst[@name="%s"]/lst' % field)
        L = len(keywordList)
        totalL += L
        for keywordEl in keywordList:
            keyword = keywordEl.attrib["name"]
            if keyword in exclude or len(keyword) < 5:
                continue
            n = int(keywordEl.xpath('int[@name="df"]')[0].text)
            wdf = int(keywordEl.xpath('int[@name="tf"]')[0].text)
            if keyword not in keywords:
                keywords[keyword] = [n, []]
            keywords[keyword][1].append((wdf, L))
    keywords = [(keyword, n, m) for keyword, (n, m) in keywords.iteritems()]
    avgL = float(totalL) / R
    def wt(n, m):
        r = len(m)
        v = 0
        for wdf, L in m:
            Ld = float(L) / avgL
            v += 2 * wdf / (Ld + wdf)
        return v * float(r) * log((r+0.5)*(N-R-n+r+0.5)/((R-r+0.5)*(n-r+0.5)))
    keywords.sort(key=lambda k: wt(k[1], k[2]), reverse=True)
    #print keywords
    return [k[0] for k in keywords[:count]]

