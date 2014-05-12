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

import zipfile
from StringIO import StringIO
from lxml import etree
import sys

NSMAIN = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def parse_docx(path):
    """Return ([analysts], service number, document text, document title).
    
    """
    analysts = []
    service_number = None

    mydoc = zipfile.ZipFile(path)    
    doc = etree.parse(mydoc.open('word/settings.xml'))
    els = doc.xpath("//w:docVar[@w:name='dvMetaData']", namespaces={'w':NSMAIN})
    if els:
        data = els[0].attrib['{%s}val' % NSMAIN]
        if isinstance(data, unicode):
            data = data.encode('utf-8', 'ignore')    # HACK
        doc = etree.parse(StringIO(data))
        els = doc.xpath("//analysts")
        if els:
            analysts = [x.strip() for x in els[0].text.split(';')]
    
        els = doc.xpath("//service_number")
        if els:
            service_number = int(els[0].text)

    # get the document text
    doc = etree.parse(mydoc.open('word/document.xml'))
    paratextlist=[]
    doctitle = ''
    for el in doc.iter():
        if el.tag == '{%s}p' % NSMAIN:
            for para in el:
                paratext=[]
                for el2 in para.iter():
                    if (el2.tag == '{%s}instrText' % NSMAIN and 
                        'DocTitle' in el2.text):
                        doctitle = True

                    elif (el2.tag == '{%s}fldSimple' % NSMAIN and
                        'DocTitle' in el2.get('{%s}instr' % NSMAIN)):
                        doctitle = True

                    elif el2.tag == '{%s}t' % NSMAIN and el2.text:
                        paratext.append(el2.text)

                if not len(paratext) == 0:
                    paratextlist.append(''.join(paratext))

            if doctitle is True:
                doctitle = ''.join(paratext)

    return analysts, service_number, '\n\n'.join(paratextlist), doctitle

    
if __name__ == '__main__':
    import os
    for f in os.listdir(sys.argv[1]):
        if f.endswith('.docx'):
            print f, parse_docx(os.path.join(sys.argv[1], f))[3]
