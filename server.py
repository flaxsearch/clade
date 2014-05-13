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

import json
import cPickle
from lib import web
from lib import taxonomy
from StringIO import StringIO
import sunburnt
import settings
import httplib2

urls = ('/ajax/(.*)', 'Ajax', '/*', 'Root', '/import', 'IO', '/export', 'IO')
app = web.application(urls, globals())

with open(settings.taxonomy_path) as f:
    taxes = cPickle.load(f)
term_map = {}

# FIXME: put this into taxonomy.py
def map_terms():
    term_map.clear()
    taxonomy.Term._uid = 0
    def map_term(term):
        term_map["term%s" % term.uid] = term
        taxonomy.Term._uid = max(taxonomy.Term._uid, term.uid)
    for term in taxes:
        term.walk(map_term)
map_terms()

def commit():
    """ Commit the taxonomy tree.
    
    """
    with open(settings.taxonomy_path, 'w') as f:
        cPickle.dump(taxes, f)

h = httplib2.Http(cache=settings.http_cache)
_solr = sunburnt.SolrInterface(settings.solr_url, http_connection=h)

def params(name):
    aname = "%s[]" % name
    p = { aname: [] }
    for x in getattr(web.input(**p), aname):
        yield x

class Ajax:
    def GET(self, fn):

        if fn == "taxonomies":
            # return taxonomy list
            return json.dumps([{ 'value': x[0], 'label': str(x[1]) } 
                               for x in enumerate(taxes)])

        if fn == "taxonomy":
            # return taxonomy data, and possibly create/rename/delete a taxonomy
            tax_idx = web.input(value=None).value
            name = web.input(name=None).name
            remove = web.input(remove=False).remove
            if tax_idx is None:
                if name is None or remove is not False:
                    return json.dumps({ "error": "no taxonomy index specified" })
                # create a new taxonomy with specified name
                for t in taxes:
                    if t.name == name:
                        return json.dumps({ "error": "a taxonomy with that name already exists" })
                term = taxonomy.Term(name)
                taxes.append(term)
                term_map["term%s" % term.uid] = term
                commit()
                return json.dumps({ "value": len(taxes) - 1 })
            try:
                tax_idx = int(tax_idx)
            except ValueError:
                return json.dumps({ "error": "invalid taxonomy index specified - not an integer" })
            if tax_idx < 0 or tax_idx >= len(taxes):
                return json.dumps({ "error": "invalid taxonomy index specified" })
            if remove is not False:
                if name is not None:
                    return json.dumps({ "error": "name specified for taxonomy removal" })
                # delete taxonomy
                del taxes[tax_idx]
                map_terms()
                commit()
                return json.dumps({})
            if name is not None:
                # rename taxonomy
                for t in taxes:
                    if t.name == name:
                        return json.dumps({ "error": "a taxonomy with that name already exists" })
                taxes[tax_idx].name = name
                commit()
                return json.dumps({ "value": tax_idx })
            # default - fetch taxonomy data
            return json.dumps([taxes[tax_idx].for_jtree(_solr)])
            
        if fn == "keywords":
            # return keywords for a taxonomy term
            term_id = web.input(id=None).id
            if term_id is None:
                return json.dumps({"error": "no term id specified"})
            term = term_map[term_id]
            return json.dumps([{ "data": [k], "metadata": p } for k, p in term.iter_clues()])

        if fn == "documents":
            # return documents matching a node (category) (and add/remove a keyword?)
            term_id = web.input(id=None).id
            if term_id is None:
                return json.dumps({"error": "no term id specified"})
            term = term_map[term_id]
            change = False
            for add in params("add"):
            	term.set_clue(add)
            	change = True
            for remove in params("remove"):
            	term.delete_clue(remove)
            	change = True
            for toggle in params("toggle"):
                term.toggle_clue(toggle)
            	change = True
            if change:
                commit()
            numFound, docs = taxonomy.get_docs_for_category(_solr, term)
            return json.dumps({"docs": [{"data": doc} for doc in docs], "count": numFound})

        if fn == "suggestions":
            # return suggested keywords based on matching documents
            term_id = web.input(id=None).id
            if term_id is None:
                return json.dumps({"error": "no term id specified"})
            term = term_map[term_id]
            clues = []
            for x, _ in term.iter_clues():
                clues.append(x)
                clues.extend(x.split(' '))
            clues = [clue.lower() for clue in clues]
            doc_ids = [x for x in taxonomy.get_doc_ids_for_category(_solr, term)]
            keywords = taxonomy.suggest_keywords(_solr, doc_ids, clues, 7)
            return json.dumps([{ "data": [k], "metadata": True } for k in keywords])

        if fn == "document":
            doc_id = web.input(id=None).id
            doc = _solr.query(doc_id=doc_id).execute()[0]
            ranked = [{"data": [x[0].uid, str(x[0]), str(int(x[1]*10000))]} for x in 
                      taxonomy.classify_doc(doc["text"], taxes)[:18]]
            return json.dumps({"title": doc["title"], "ranked": ranked, "text": doc["text"]})

        if fn == "category":
            # rename/create/remove a category
            category_id = web.input(id=None).id
            parent_id = web.input(parent_id=None).parent_id
            name = web.input(name=None).name
            if category_id is not None:
                if category_id not in term_map:
                    return json.dumps({"error": "no such category: %s" % category_id})
                category = term_map[category_id]
            else:
                category = None
            if category is not None:
                if name is not None:
                    # rename category
                    category.name = name
                else:
                    # remove category
                    category.parent.children.remove(category)
                    del term_map[category_id]
            else:
                if name is None:
                    return json.dumps({"error": "no name or category id specified"})
                elif parent_id is None:
                    return json.dumps({"error": "no parent id specified"})
                elif parent_id not in term_map:
                    return json.dumps({"error": "no such category: %s" % parent_id})
                else:
                    # create category
                    parent = term_map[parent_id]
                    child = parent.create_child(name)
                    term_map["term%s" % child.uid] = child
                    commit()
                    return json.dumps({ "id": "term%s" % child.uid })
            commit()
            return json.dumps({ })

        raise Exception("No such function: %s" % fn)


class IO:
    def POST(self):
        global taxes
        with open(settings.taxonomy_path, 'w') as f:
            try:
                x = web.input(myfile={})
                taxes = [taxonomy.parse_xml(x['myfile'].file)]
                raise web.seeother("/static/index.html")
            except Exception as e:
                taxes = []
                raise web.seeother("/static/index.html?%s" % e.message)
            finally:
                cPickle.dump(taxes, f)
                map_terms()

    def GET(self):
        xml = StringIO()
        rows = web.input(rows='-1').rows
        if rows != '-1':
            taxonomy.write_xml(xml, taxes, _solr, rows)
        else:
            taxonomy.write_xml(xml, taxes)
        try:
            return xml.getvalue()
        finally:
            xml.close()

class Root:
    def GET(self):
        raise web.seeother(settings.root_url)


if __name__ == "__main__":
    app.run()

