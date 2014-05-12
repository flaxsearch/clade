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

from lxml import etree

def parse_xml(path):
    """Return ([analysts], service number, document text, document title).
    
    """
    with open(path) as f:
        doc = etree.parse(f)
        analysts = [x.text.encode('utf-8', 'ignore') 
            for x in doc.xpath('//authors/author/author-name')]

        title = ''
        els = doc.xpath('//document-title')
        if els:
            title = els[0].text.encode('utf-8', 'ignore')
        
        text = []
        for el in doc.xpath('//abstract1/P'):
            text.append(el.text.encode('utf-8', 'ignore'))
        
        for el in doc.xpath('//element.body/*'):
            if el.text:
                text.append(el.text.encode('utf-8', 'ignore'))
        
        return analysts, 0, '\n\n'.join(text), title


if __name__ == '__main__':
    import sys
    print parse_xml(sys.argv[1])

