#! /bin/sh

if npm audit; then
  npm run-script document
  npm run-script api
  rm *orig* *toc\.*
  npm version patch -m "$1"
  git add .
  git commit -m "$1"
  git push origin master --tags
  npm publish
else
  echo "Not publishing due to security vulnerabilites"
fi
