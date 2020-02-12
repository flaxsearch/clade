#!/bin/sh
java -mx1000m -cp stanford-ner.jar \
    edu.stanford.nlp.ie.NERServer \
    -loadClassifier classifiers/english.all.3class.distsim.crf.ser.gz \
    -port 9000
