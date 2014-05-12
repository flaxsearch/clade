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

import socket

def get_entities(host, port, text):

    if isinstance(text, unicode):
        text = text.encode('utf-8', 'ignore')

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, port))
    s.send(text.replace('\n', ' ') + '\n')
    data = []
    while True:
        d = s.recv(1024)
        if not d: break
        data.append(d)

    s.close()
    
    lasttag = ''
    stack = []
    for word in (x.split('/') for x in ''.join(data).split(' ')):
        if len(word) == 2:
            if word[1] == 'O':
                if stack:
                    yield ' '.join(stack)
                    stack = []
            else:
                if word[1] == lasttag or not stack:
                    stack.append(word[0].strip())
                else:
                    yield ' '.join(stack)
                    stack = []
                    yield word[0].strip()
            
            lasttag = word[1]


if __name__ == '__main__':
    test = """The fate of Lehman Brothers, the beleaguered investment bank, 
    hung in the balance on Sunday as Federal Reserve officials and the leaders 
    of major financial institutions continued to gather in emergency meetings 
    trying to complete a plan to rescue the stricken bank. John said."""

    print list(get_entities('localhost', 9000, test))