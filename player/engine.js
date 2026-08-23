/**
 * Small, dependency-free player helpers shared by the static browser player
 * and Jest. Keep expensive fuzzy operations bounded because the global catalog
 * can contain tens of thousands of channels.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.DpiptvEngine = factory()
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict'

  function fold(value) {
    return String(value || '')
      .slice(0, 512)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function distance(left, right) {
    var a = fold(left).slice(0, 48)
    var b = fold(right).slice(0, 48)
    if (a === b) return 0
    if (!a) return b.length
    if (!b) return a.length
    var previous = []
    var current = []
    var i
    var j
    for (j = 0; j <= b.length; j++) previous[j] = j
    for (i = 1; i <= a.length; i++) {
      current[0] = i
      for (j = 1; j <= b.length; j++) {
        current[j] = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        )
      }
      var swap = previous
      previous = current
      current = swap
    }
    return previous[b.length]
  }

  function fuzzyScore(value, query) {
    var haystack = fold(value)
    var needle = fold(query)
    if (!needle) return 1
    if (!haystack) return 0
    if (haystack === needle) return 1
    if (haystack.indexOf(needle) === 0) return 0.96
    if (haystack.indexOf(needle) >= 0) return 0.84

    var words = haystack.split(' ')
    var queries = needle.split(' ')
    var total = 0
    queries.forEach(function (part) {
      var best = 0
      words.forEach(function (word) {
        if (word.indexOf(part) === 0) best = Math.max(best, 0.9)
        else {
          var size = Math.max(word.length, part.length) || 1
          best = Math.max(best, 1 - distance(word, part) / size)
        }
      })
      total += best
    })
    return total / queries.length
  }

  function parseQuery(value) {
    var group = ''
    var source = ''
    var text = String(value || '').slice(0, 512).replace(/(^|\s)([#@])(\S+)/g, function (_all, space, op, token) {
      if (op === '#') group = fold(token.replace(/_/g, ' '))
      else source = fold(token.replace(/_/g, ' '))
      return space
    })
    return { text: fold(text), group: group, source: source }
  }

  function searchChannels(channels, rawQuery, limit) {
    var query = parseQuery(rawQuery)
    var cap = Math.max(1, Math.min(Number(limit) || 400, 500))
    var results = []
    ;(Array.isArray(channels) ? channels : []).forEach(function (channel) {
      if (!channel || typeof channel.name !== 'string') return
      if (query.group && fold(channel.group).indexOf(query.group) < 0) return
      if (query.source && fold(channel.src).indexOf(query.source) < 0) return
      var score = query.text
        ? Math.max(fuzzyScore(channel.name, query.text), fuzzyScore(channel.group, query.text) * 0.6)
        : 1
      if (query.text && score < 0.55) return
      results.push({ channel: channel, score: score })
    })
    results.sort(function (a, b) {
      return b.score - a.score || a.channel.name.localeCompare(b.channel.name)
    })
    return results.slice(0, cap).map(function (result) { return result.channel })
  }

  function currentProgram(guide, channelId, now) {
    if (!guide || !guide.channels || typeof channelId !== 'string' || !channelId) return null
    var channel = guide.channels[channelId] || guide.channels[channelId.split('@')[0]]
    if (!channel || !Array.isArray(channel.programs)) return null
    var timestamp = Number.isFinite(now) ? now : Date.now()
    for (var i = 0; i < channel.programs.length; i++) {
      var program = channel.programs[i]
      if (!program || !Number.isFinite(program.start) || !Number.isFinite(program.stop)) continue
      if (program.start <= timestamp && timestamp < program.stop) {
        return { now: program, next: channel.programs[i + 1] || null }
      }
    }
    return null
  }

  function mirrorUrls(channel, mirrorGroups) {
    var source = channel && channel.mirror && mirrorGroups && mirrorGroups[channel.mirror]
    var urls = Array.isArray(source) ? source : []
    var first = channel && channel.url
    var seen = Object.create(null)
    return [first].concat(urls).filter(function (url) {
      if (typeof url !== 'string' || seen[url]) return false
      try {
        var parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
      } catch (_error) {
        return false
      }
      seen[url] = true
      return true
    })
  }

  return {
    currentProgram: currentProgram,
    fold: fold,
    fuzzyScore: fuzzyScore,
    mirrorUrls: mirrorUrls,
    parseQuery: parseQuery,
    searchChannels: searchChannels
  }
})
