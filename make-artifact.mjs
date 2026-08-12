import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');

// Strip the outer document tags so the content slots into the Artifact skeleton.
// Keep <title>, <style>, #root, and <script> bodies intact (no splitting inside scripts).
let out = html
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head[^>]*>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body[^>]*>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta[^>]*>/gi, '')       // artifact wrapper supplies its own <head> meta
  .replace(/<link[^>]*>/gi, '')       // drop manifest/other external links (blocked by CSP)
  .trim();

fs.writeFileSync('dist/artifact.html', out, 'utf8');
console.log('wrote dist/artifact.html —', out.length, 'chars');
console.log('has #root:', /id="root"/.test(out), '| script tags:', (out.match(/<script/gi) || []).length, '| style tags:', (out.match(/<style/gi) || []).length);
