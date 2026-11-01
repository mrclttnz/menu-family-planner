#!/bin/bash

watch -n 1 "find . -type f -mmin -90 -not -path '*/.*' -not -path '*.pyc' -exec ls -lt {} +"