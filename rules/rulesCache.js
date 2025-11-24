// rules/rulesCache.js
let rulesContent = null;
let lastLoaded = null;

export function setRules(content) {
  rulesContent = content;
  lastLoaded = Date.now();
}

export function getRules() {
  return rulesContent;
}

export function getLastLoaded() {
  return lastLoaded;
}
