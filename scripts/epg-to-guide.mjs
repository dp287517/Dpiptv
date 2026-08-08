#!/usr/bin/env node
/**
 * Dpiptv — convertit un guide XMLTV (produit par iptv-org/epg) en guide.json
 * compact consommé par player.html.
 *
 * Usage : node scripts/epg-to-guide.mjs <guide.xml> <guide.json>
 *
 * Format de sortie (contrat avec le lecteur) :
 *   { "generatedAt": ISO8601,
 *     "channels": {
 *       "<xmltv_id>": { "name": "...",
 *         "programs": [ { "start": epochMs, "stop": epochMs, "title": "..." } ] } } }
 *
 * XMLTV bien formé (une balise <programme> par bloc), donc parsing par blocs
 * sans dépendance externe. Les temps XMLTV "YYYYMMDDHHmmss +ZZZZ" sont
 * convertis en millisecondes epoch.
 */
import fs from 'node:fs'

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&') // en dernier
}

// "20260807200000 +0000" -> epoch ms (UTC)
function xmltvTime(str) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{2})(\d{2}))?/.exec(str.trim())
  if (!m) return null
  const [, Y, Mo, D, H, Mi, S, offH, offM] = m
  let t = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)
  if (offH != null) t -= (parseInt(offH, 10) * 60 + Math.sign(parseInt(offH, 10)) * +offM) * 60000
  return t
}

function attr(tag, name) {
  const m = new RegExp(name + '="([^"]*)"').exec(tag)
  return m ? m[1] : ''
}
function innerTag(block, name) {
  const m = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>').exec(block)
  return m ? decodeEntities(m[1].trim()) : ''
}

function convert(xml) {
  const channelNames = {}
  const chRe = /<channel\b[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/channel>/g
  let cm
  while ((cm = chRe.exec(xml)) !== null) {
    channelNames[cm[1]] = innerTag(cm[2], 'display-name') || cm[1]
  }

  const channels = {}
  const prRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g
  let pm
  while ((pm = prRe.exec(xml)) !== null) {
    const head = pm[1]
    const body = pm[2]
    const id = attr(head, 'channel')
    if (!id) continue
    const start = xmltvTime(attr(head, 'start'))
    const stop = xmltvTime(attr(head, 'stop'))
    if (start == null || stop == null) continue
    if (!channels[id]) channels[id] = { name: channelNames[id] || id, programs: [] }
    // On ne garde que start/stop/title : le lecteur n'affiche pas la description,
    // et l'omettre réduit fortement la taille de guide.json (mobile).
    channels[id].programs.push({ start, stop, title: innerTag(body, 'title') })
  }
  // Tri par début + limite raisonnable par chaîne (72 h autour de maintenant suffit)
  for (const id of Object.keys(channels)) {
    channels[id].programs.sort((a, b) => a.start - b.start)
  }
  return { generatedAt: new Date().toISOString(), channels }
}

const [, , inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('Usage: node scripts/epg-to-guide.mjs <guide.xml> <guide.json>')
  process.exit(1)
}
const xml = fs.readFileSync(inPath, 'utf8')
const guide = convert(xml)
fs.writeFileSync(outPath, JSON.stringify(guide))
const n = Object.keys(guide.channels).length
const p = Object.values(guide.channels).reduce((s, c) => s + c.programs.length, 0)
console.log(`guide.json écrit : ${n} chaîne(s), ${p} programme(s).`)
